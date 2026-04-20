import { readFile, stat } from 'fs/promises'
import { logger } from '@/lib/logger'
import type { PublishResult } from '@/lib/publishers/tiktok'

/**
 * YouTube Shorts — publisher via YouTube Data API v3 (Lot 11B)
 *
 * Documentation : https://developers.google.com/youtube/v3/guides/uploading_a_video
 *
 * Credentials requis :
 * - YOUTUBE_ACCESS_TOKEN : OAuth2 user access token avec scope youtube.upload
 * - YOUTUBE_CHANNEL_ID   : identifiant de la chaîne (optionnel, pour le profileUrl)
 *
 * Obtenir un access token :
 * 1. Créer un projet sur https://console.cloud.google.com
 * 2. Activer YouTube Data API v3
 * 3. Créer des credentials OAuth 2.0 (Application Web)
 * 4. Ajouter le scope https://www.googleapis.com/auth/youtube.upload
 * 5. Récupérer un access_token via OAuth Playground (https://developers.google.com/oauthplayground)
 *    ou Postman, puis le coller dans .env.local
 */

const ACCESS_TOKEN = process.env.YOUTUBE_ACCESS_TOKEN || ''
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || ''
const YOUTUBE_API = 'https://www.googleapis.com'

const YOUTUBE_CREDENTIALS_INSTRUCTIONS = [
  'Pour publier sur YouTube Shorts, configurer dans .env.local :',
  '',
  '  YOUTUBE_ACCESS_TOKEN=<user_access_token>',
  '  YOUTUBE_CHANNEL_ID=<channel_id>  (optionnel)',
  '',
  'Obtenir ces credentials :',
  '  1. Créer un projet sur https://console.cloud.google.com',
  '  2. Activer YouTube Data API v3',
  '  3. Créer des credentials OAuth 2.0 (type : Application Web)',
  '  4. Ajouter le scope https://www.googleapis.com/auth/youtube.upload',
  '  5. Récupérer un access_token via OAuth Playground ou Postman',
  '  6. Coller le token dans .env.local puis redémarrer l\'app',
  '',
  'Documentation : https://developers.google.com/youtube/v3/guides/uploading_a_video',
  '',
  'En mode test, utiliser privacyStatus: "private" — vidéo non publique.',
].join('\n')

function getYouTubeChannelUrl(): string | undefined {
  if (!CHANNEL_ID) return undefined
  return `https://www.youtube.com/channel/${CHANNEL_ID}`
}

/**
 * Publie une vidéo sur YouTube Shorts via l'API YouTube Data v3.
 *
 * Flow en 2 étapes :
 * 1. Démarrer un upload résumable (POST /upload/youtube/v3/videos?uploadType=resumable)
 *    → reçoit une Location header avec l'URL d'upload
 * 2. Uploader le fichier (PUT {upload_url})
 *    → reçoit l'ID de la vidéo créée
 *
 * Si YOUTUBE_ACCESS_TOKEN est absent : retourne NO_CREDENTIALS avec les instructions.
 * Si la vidéo est absente : retourne NO_MEDIA.
 * En cas d'erreur API : retourne FAILED avec le message exact.
 */
export async function publishToYouTubeShorts(opts: {
  runId: string
  videoPath: string
  title: string
  hashtags: string[]
  mediaMode: string
}): Promise<PublishResult> {
  const credentials = {
    hasAccessToken: !!ACCESS_TOKEN,
    hasClientKey: false,
  }

  logger.info({
    event: 'youtube_publish_start',
    runId: opts.runId,
    hasAccessToken: credentials.hasAccessToken,
    mediaMode: opts.mediaMode,
  })

  // Gating credentials — honnête, non silencieux
  if (!ACCESS_TOKEN) {
    logger.warn({ event: 'youtube_no_credentials', runId: opts.runId })
    return {
      platform: 'youtube_shorts',
      status: 'NO_CREDENTIALS',
      credentials,
      instructions: YOUTUBE_CREDENTIALS_INSTRUCTIONS,
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
    logger.warn({ event: 'youtube_no_media', runId: opts.runId, path: opts.videoPath })
    return {
      platform: 'youtube_shorts',
      status: 'NO_MEDIA',
      error: `Fichier vidéo introuvable : ${opts.videoPath}`,
      credentials,
      runId: opts.runId,
      title: opts.title,
      hashtags: opts.hashtags,
      mediaMode: opts.mediaMode,
    }
  }

  // Étape 1 — Démarrer un upload résumable
  let uploadUrl: string

  try {
    const hashtagText = opts.hashtags.join(' ')
    const description = `${opts.title}\n\n${hashtagText}\n\n#Shorts`

    const initRes = await fetch(
      `${YOUTUBE_API}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': String(videoSize),
        },
        body: JSON.stringify({
          snippet: {
            title: opts.title.slice(0, 100), // YouTube max 100 chars
            description,
            tags: opts.hashtags.map((h) => h.replace(/^#/, '')),
            categoryId: '22', // People & Blogs
          },
          status: {
            privacyStatus: 'private', // Privé pour test — non public
            selfDeclaredMadeForKids: false,
          },
        }),
      },
    )

    if (!initRes.ok) {
      const err = await initRes.text()
      throw new Error(`YouTube init HTTP ${initRes.status}: ${err}`)
    }

    const location = initRes.headers.get('Location')
    if (!location) {
      throw new Error('YouTube init : header Location absent dans la réponse')
    }
    uploadUrl = location
  } catch (e) {
    const errorMsg = (e as Error).message
    logger.warn({ event: 'youtube_init_failed', runId: opts.runId, error: errorMsg })
    return {
      platform: 'youtube_shorts',
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

  logger.info({ event: 'youtube_init_ok', runId: opts.runId })

  // Étape 2 — Uploader le fichier vidéo
  let videoId: string | undefined

  try {
    const videoBuffer = await readFile(opts.videoPath)
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(videoSize),
      },
      body: videoBuffer,
    })

    // YouTube répond 200 ou 201 en fin d'upload résumable
    if (!uploadRes.ok && uploadRes.status !== 201) {
      const err = await uploadRes.text()
      throw new Error(`YouTube upload HTTP ${uploadRes.status}: ${err}`)
    }

    const data = await uploadRes.json().catch(() => null) as { id?: string } | null
    videoId = data?.id
  } catch (e) {
    const errorMsg = (e as Error).message
    logger.warn({ event: 'youtube_upload_failed', runId: opts.runId, error: errorMsg })
    return {
      platform: 'youtube_shorts',
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

  logger.info({ event: 'youtube_upload_ok', runId: opts.runId, videoId, sizeBytes: videoSize })

  return {
    platform: 'youtube_shorts',
    status: 'SUCCESS',
    videoId,
    shareUrl: videoId ? `https://www.youtube.com/shorts/${videoId}` : undefined,
    profileUrl: getYouTubeChannelUrl(),
    credentials,
    publishedAt: new Date().toISOString(),
    runId: opts.runId,
    title: opts.title,
    hashtags: opts.hashtags,
    mediaMode: opts.mediaMode,
    mediaSizeBytes: videoSize,
  }
}

/**
 * Healthcheck YouTube — vérifie si les credentials sont configurés.
 * Ne fait pas d'appel réseau si ACCESS_TOKEN est absent.
 */
export async function youtubeHealthCheck(): Promise<{
  status: 'ready' | 'no_credentials' | 'error'
  details: string
}> {
  if (!ACCESS_TOKEN) {
    return {
      status: 'no_credentials',
      details: 'YOUTUBE_ACCESS_TOKEN absent — publication impossible',
    }
  }

  try {
    const res = await fetch(
      `${YOUTUBE_API}/youtube/v3/channels?part=snippet&mine=true`,
      {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        signal: AbortSignal.timeout(5000),
      },
    )
    if (res.ok) {
      return { status: 'ready', details: 'Credentials YouTube valides' }
    }
    if (res.status === 401) {
      return { status: 'error', details: 'YOUTUBE_ACCESS_TOKEN invalide ou expiré (HTTP 401)' }
    }
    return { status: 'error', details: `YouTube healthcheck HTTP ${res.status}` }
  } catch (e) {
    return { status: 'error', details: `YouTube non joignable : ${(e as Error).message}` }
  }
}
