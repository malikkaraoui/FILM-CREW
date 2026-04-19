import { readFile, writeFile, mkdir, stat } from 'fs/promises'
import { join } from 'path'
import { logger } from '@/lib/logger'

/**
 * TikTok Content Posting API — client réel v2
 *
 * Documentation officielle : https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
 *
 * Credentials requis :
 * - TIKTOK_ACCESS_TOKEN : user access token OAuth avec scopes video.upload + video.publish
 * - TIKTOK_CLIENT_KEY   : optionnel, utilisé pour le healthcheck et la doc
 *
 * Obtenir un access token :
 * 1. Créer une app sur https://developers.tiktok.com
 * 2. Activer les scopes video.upload et video.publish
 * 3. Implémenter le flow OAuth 2.0 pour obtenir un access token
 *    ou utiliser le mode Sandbox de l'app TikTok Developer
 * 4. Définir TIKTOK_ACCESS_TOKEN dans .env.local
 */

const ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN || ''
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || ''
const BASE_URL = 'https://open.tiktokapis.com/v2'

const TIKTOK_CREDENTIALS_INSTRUCTIONS = [
  'Pour publier sur TikTok, configurer dans .env.local :',
  '',
  '  TIKTOK_ACCESS_TOKEN=<user_access_token>',
  '  TIKTOK_CLIENT_KEY=<client_key>  (optionnel)',
  '',
  'Obtenir ces credentials :',
  '  1. Créer une app sur https://developers.tiktok.com',
  '  2. Activer les scopes : video.upload, video.publish',
  '  3. Obtenir un access token via le flow OAuth 2.0',
  '     ou via le mode Sandbox de votre app TikTok Developer',
  '',
  'Sandbox officielle TikTok :',
  '  https://developers.tiktok.com/doc/content-posting-api-get-started/',
  '',
  'En mode Sandbox, les vidéos sont postées en mode privé sur',
  'un compte de test — aucune publication publique.',
].join('\n')

export type PublishStatus =
  | 'SUCCESS'
  | 'PROCESSING'
  | 'FAILED'
  | 'NO_CREDENTIALS'
  | 'NO_MEDIA'

export type PublishResult = {
  platform: 'tiktok'
  status: PublishStatus
  publishId?: string
  videoId?: string
  shareUrl?: string
  error?: string
  credentials: {
    hasAccessToken: boolean
    hasClientKey: boolean
  }
  instructions?: string
  publishedAt?: string
  runId: string
  title: string
  hashtags: string[]
  mediaMode: string
  mediaSizeBytes?: number
}

/**
 * Publie une vidéo sur TikTok via l'API Content Posting.
 *
 * Si TIKTOK_ACCESS_TOKEN est absent, retourne NO_CREDENTIALS avec les instructions.
 * Si la vidéo est absente, retourne NO_MEDIA.
 * En cas d'erreur API, retourne FAILED avec le message d'erreur exact.
 */
export async function publishToTikTok(opts: {
  runId: string
  videoPath: string
  title: string
  hashtags: string[]
  mediaMode: string
}): Promise<PublishResult> {
  const credentials = {
    hasAccessToken: !!ACCESS_TOKEN,
    hasClientKey: !!CLIENT_KEY,
  }

  logger.info({
    event: 'tiktok_publish_start',
    runId: opts.runId,
    hasAccessToken: credentials.hasAccessToken,
    hasClientKey: credentials.hasClientKey,
    mediaMode: opts.mediaMode,
  })

  // Gating credentials — honest, non silencieux
  if (!ACCESS_TOKEN) {
    logger.warn({ event: 'tiktok_no_credentials', runId: opts.runId })
    return {
      platform: 'tiktok',
      status: 'NO_CREDENTIALS',
      credentials,
      instructions: TIKTOK_CREDENTIALS_INSTRUCTIONS,
      runId: opts.runId,
      title: opts.title,
      hashtags: opts.hashtags,
      mediaMode: opts.mediaMode,
    }
  }

  // Vérifier l'existence du fichier vidéo
  let videoSize: number
  try {
    const s = await stat(opts.videoPath)
    videoSize = s.size
  } catch {
    logger.warn({ event: 'tiktok_no_media', runId: opts.runId, path: opts.videoPath })
    return {
      platform: 'tiktok',
      status: 'NO_MEDIA',
      error: `Fichier vidéo introuvable : ${opts.videoPath}`,
      credentials,
      runId: opts.runId,
      title: opts.title,
      hashtags: opts.hashtags,
      mediaMode: opts.mediaMode,
    }
  }

  // Étape 1 — Initialiser l'upload TikTok
  let publishId: string
  let uploadUrl: string

  try {
    const initRes = await fetch(`${BASE_URL}/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: opts.title.slice(0, 150), // TikTok max 150 chars
          privacy_level: 'SELF_ONLY',      // Privé pour test — non masqué
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: videoSize,            // upload en 1 seul chunk
          total_chunk_count: 1,
        },
      }),
    })

    if (!initRes.ok) {
      const err = await initRes.text()
      throw new Error(`TikTok init HTTP ${initRes.status}: ${err}`)
    }

    const initData = await initRes.json() as {
      data?: { publish_id: string; upload_url: string }
      error?: { code: string; message: string; log_id?: string }
    }

    if (!initData.data?.publish_id || !initData.data?.upload_url) {
      throw new Error(
        `TikTok init erreur : ${initData.error?.message ?? 'publish_id ou upload_url manquant'} (code=${initData.error?.code})`,
      )
    }

    publishId = initData.data.publish_id
    uploadUrl = initData.data.upload_url
  } catch (e) {
    const errorMsg = (e as Error).message
    logger.warn({ event: 'tiktok_init_failed', runId: opts.runId, error: errorMsg })
    return {
      platform: 'tiktok',
      status: 'FAILED',
      error: errorMsg,
      credentials,
      runId: opts.runId,
      title: opts.title,
      hashtags: opts.hashtags,
      mediaMode: opts.mediaMode,
      mediaSizeBytes: videoSize,
    }
  }

  logger.info({ event: 'tiktok_init_ok', runId: opts.runId, publishId })

  // Étape 2 — Uploader le fichier vidéo
  try {
    const videoBuffer = await readFile(opts.videoPath)
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
        'Content-Length': String(videoSize),
      },
      body: videoBuffer,
    })

    if (!uploadRes.ok && uploadRes.status !== 206) {
      const err = await uploadRes.text()
      throw new Error(`TikTok upload HTTP ${uploadRes.status}: ${err}`)
    }
  } catch (e) {
    const errorMsg = (e as Error).message
    logger.warn({ event: 'tiktok_upload_failed', runId: opts.runId, publishId, error: errorMsg })
    return {
      platform: 'tiktok',
      status: 'FAILED',
      publishId,
      error: errorMsg,
      credentials,
      runId: opts.runId,
      title: opts.title,
      hashtags: opts.hashtags,
      mediaMode: opts.mediaMode,
      mediaSizeBytes: videoSize,
    }
  }

  logger.info({ event: 'tiktok_upload_ok', runId: opts.runId, publishId, sizeBytes: videoSize })

  // Étape 3 — Polling du statut (max 60s)
  const MAX_POLLS = 12
  const POLL_INTERVAL_MS = 5000

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

    try {
      const statusRes = await fetch(`${BASE_URL}/post/publish/status/fetch/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ publish_id: publishId }),
      })

      if (!statusRes.ok) continue

      const statusData = await statusRes.json() as {
        data?: {
          status: string
          fail_reason?: string
          publicaly_available_post_id?: string[]
        }
        error?: { code: string; message: string }
      }

      const tiktokStatus = statusData.data?.status

      if (tiktokStatus === 'PUBLISH_COMPLETE') {
        const videoId = statusData.data?.publicaly_available_post_id?.[0]
        logger.info({ event: 'tiktok_publish_success', runId: opts.runId, publishId, videoId })
        return {
          platform: 'tiktok',
          status: 'SUCCESS',
          publishId,
          videoId,
          shareUrl: videoId ? `https://www.tiktok.com/@user/video/${videoId}` : undefined,
          credentials,
          publishedAt: new Date().toISOString(),
          runId: opts.runId,
          title: opts.title,
          hashtags: opts.hashtags,
          mediaMode: opts.mediaMode,
          mediaSizeBytes: videoSize,
        }
      }

      if (tiktokStatus === 'FAILED' || tiktokStatus === 'REVOKED') {
        const reason = statusData.data?.fail_reason ?? 'Publication TikTok échouée'
        logger.warn({ event: 'tiktok_publish_failed', runId: opts.runId, publishId, reason })
        return {
          platform: 'tiktok',
          status: 'FAILED',
          publishId,
          error: reason,
          credentials,
          runId: opts.runId,
          title: opts.title,
          hashtags: opts.hashtags,
          mediaMode: opts.mediaMode,
          mediaSizeBytes: videoSize,
        }
      }

      logger.info({ event: 'tiktok_publish_polling', runId: opts.runId, publishId, tiktokStatus, attempt: i + 1 })
    } catch { /* polling non bloquant */ }
  }

  // Timeout — retourner PROCESSING (publish_id connu, peut être vérifié manuellement)
  logger.warn({ event: 'tiktok_publish_timeout', runId: opts.runId, publishId })
  return {
    platform: 'tiktok',
    status: 'PROCESSING',
    publishId,
    credentials,
    runId: opts.runId,
    title: opts.title,
    hashtags: opts.hashtags,
    mediaMode: opts.mediaMode,
    mediaSizeBytes: videoSize,
  }
}

/**
 * Persiste le résultat de publication dans storage/runs/{runId}/final/publish-result.json.
 */
export async function savePublishResult(runId: string, result: PublishResult): Promise<void> {
  const finalDir = join(process.cwd(), 'storage', 'runs', runId, 'final')
  await mkdir(finalDir, { recursive: true })
  await writeFile(
    join(finalDir, 'publish-result.json'),
    JSON.stringify(result, null, 2),
  )
}

/**
 * Lit le publish-result.json existant, ou null si absent.
 */
export async function readPublishResult(runId: string): Promise<PublishResult | null> {
  try {
    const raw = await readFile(
      join(process.cwd(), 'storage', 'runs', runId, 'final', 'publish-result.json'),
      'utf-8',
    )
    return JSON.parse(raw) as PublishResult
  } catch {
    return null
  }
}

/**
 * Healthcheck TikTok — vérifie si les credentials sont configurés.
 * Ne fait pas d'appel réseau si ACCESS_TOKEN est absent.
 */
export async function tiktokHealthCheck(): Promise<{
  status: 'ready' | 'no_credentials' | 'error'
  details: string
}> {
  if (!ACCESS_TOKEN) {
    return {
      status: 'no_credentials',
      details: 'TIKTOK_ACCESS_TOKEN absent — publication impossible',
    }
  }

  try {
    // Vérifier le token via l'endpoint user/info/
    const res = await fetch(`${BASE_URL}/user/info/`, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      return { status: 'ready', details: 'Credentials TikTok valides' }
    }
    if (res.status === 401) {
      return { status: 'error', details: 'TIKTOK_ACCESS_TOKEN invalide ou expiré (HTTP 401)' }
    }
    return { status: 'error', details: `TikTok healthcheck HTTP ${res.status}` }
  } catch (e) {
    return { status: 'error', details: `TikTok non joignable : ${(e as Error).message}` }
  }
}
