import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { isAbsolute, join } from 'path'
import { publishToTikTok, savePublishResult, readPublishResult, tiktokHealthCheck } from '@/lib/publishers/tiktok'
import { logger } from '@/lib/logger'

type PreviewManifest = {
  mode: 'video_finale' | 'animatic' | 'storyboard_only' | 'none'
  playableFilePath: string | null
  mediaType: string | null
  hasAudio: boolean
}

/**
 * GET /api/runs/[id]/publish
 * Retourne le statut de publication actuel du run.
 * Si aucun publish-result.json n'existe : { status: 'not_published' }.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const result = await readPublishResult(id)

    if (!result) {
      // Retourner le healthcheck TikTok pour informer l'UI sur l'état des credentials
      const health = await tiktokHealthCheck()
      return NextResponse.json({
        data: {
          status: 'not_published',
          tiktokHealth: health,
        },
      })
    }

    logger.info({ event: 'publish_status_fetched', runId: id, status: result.status })
    return NextResponse.json({ data: result })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'PUBLISH_STATUS_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}

/**
 * POST /api/runs/[id]/publish
 * Déclenche la publication sur TikTok.
 *
 * Body : { platform: 'tiktok' }
 *
 * Retourne toujours un PublishResult honnête :
 *   - NO_CREDENTIALS si TIKTOK_ACCESS_TOKEN absent
 *   - NO_MEDIA si aucun fichier vidéo disponible
 *   - SUCCESS / PROCESSING / FAILED selon le résultat réel
 *
 * Le résultat est toujours persisté dans storage/runs/{id}/final/publish-result.json.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: { platform: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Corps JSON invalide' } },
      { status: 400 },
    )
  }

  if (body.platform !== 'tiktok') {
    return NextResponse.json(
      { error: { code: 'UNSUPPORTED_PLATFORM', message: `Plateforme "${body.platform}" non supportée. Seul "tiktok" est disponible.` } },
      { status: 400 },
    )
  }

  const storagePath = join(process.cwd(), 'storage', 'runs', id)

  logger.info({ event: 'publish_start', runId: id, platform: 'tiktok' })

  // Lire le preview-manifest pour obtenir le fichier vidéo
  let previewManifest: PreviewManifest
  try {
    const raw = await readFile(join(storagePath, 'preview-manifest.json'), 'utf-8')
    previewManifest = JSON.parse(raw)
  } catch {
    const result = {
      platform: 'tiktok' as const,
      status: 'NO_MEDIA' as const,
      error: 'preview-manifest.json introuvable — le pipeline doit atteindre le step 7 avant publication',
      credentials: {
        hasAccessToken: !!(process.env.TIKTOK_ACCESS_TOKEN),
        hasClientKey: !!(process.env.TIKTOK_CLIENT_KEY),
      },
      runId: id,
      title: '',
      hashtags: [],
      mediaMode: 'none',
    }
    await savePublishResult(id, result)
    return NextResponse.json({ data: result }, { status: 422 })
  }

  const { playableFilePath, mode } = previewManifest

  // Lire les métadonnées (titre, hashtags) depuis final/metadata.json
  let title = `FILM CREW — ${id}`
  let hashtags = ['#shorts', '#ai', '#filmcrew']
  try {
    const meta = JSON.parse(await readFile(join(storagePath, 'final', 'metadata.json'), 'utf-8'))
    if (meta.title) title = meta.title
    if (Array.isArray(meta.hashtags) && meta.hashtags.length > 0) hashtags = meta.hashtags
  } catch { /* metadata optionnelle */ }

  // Construire le chemin absolu du fichier vidéo
  const videoPath = playableFilePath
    ? (isAbsolute(playableFilePath)
      ? playableFilePath
      : join(process.cwd(), playableFilePath.replace(/^\//, '')))
    : join(storagePath, 'final', mode === 'video_finale' ? 'video.mp4' : 'animatic.mp4')

  // Publier sur TikTok
  const result = await publishToTikTok({
    runId: id,
    videoPath,
    title,
    hashtags,
    mediaMode: mode,
  })

  // Persister le résultat (toujours, succès ou échec)
  await savePublishResult(id, result)

  logger.info({ event: 'publish_complete', runId: id, status: result.status, publishId: result.publishId })

  // Retourner le résultat avec le code HTTP approprié
  const httpStatus = result.status === 'SUCCESS' || result.status === 'PROCESSING'
    ? 200
    : result.status === 'NO_CREDENTIALS'
    ? 403
    : result.status === 'NO_MEDIA'
    ? 422
    : 502

  return NextResponse.json({ data: result }, { status: httpStatus })
}
