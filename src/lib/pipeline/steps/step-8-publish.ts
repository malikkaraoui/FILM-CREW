import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { logger } from '@/lib/logger'
import { publishToTikTok, savePublishResult } from '@/lib/publishers/tiktok'
import type { PipelineStep, StepContext, StepResult } from '../types'

type PreviewManifest = {
  mode: 'video_finale' | 'animatic' | 'storyboard_only' | 'none'
  playableFilePath: string | null
  mediaType: string | null
  readyForAssembly: boolean
  hasAudio: boolean
}

export const step8Publish: PipelineStep = {
  name: 'Publication',
  stepNumber: 8,

  async execute(ctx: StepContext): Promise<StepResult> {
    const finalDir = join(ctx.storagePath, 'final')
    let previewManifest: PreviewManifest

    try {
      const raw = await readFile(join(ctx.storagePath, 'preview-manifest.json'), 'utf-8')
      previewManifest = JSON.parse(raw)
    } catch {
      return { success: false, costEur: 0, outputData: null, error: 'preview-manifest.json introuvable' }
    }

    const { mode, playableFilePath } = previewManifest
    const hasPlayable = !!(playableFilePath)

    if (mode === 'none' && !hasPlayable) {
      logger.warn({ event: 'publish_no_media', runId: ctx.runId, mode })
    }

    // Générer les métadonnées d'export
    const structure = await readFile(join(ctx.storagePath, 'structure.json'), 'utf-8')
      .then((raw) => JSON.parse(raw))
      .catch(() => ({ title: ctx.idea, scenes: [] }))

    const title = structure.title || ctx.idea
    const hashtags = ['#shorts', '#ai', '#filmcrew']

    const metadata = {
      title,
      description: `${title} — Généré par FILM-CREW`,
      hashtags,
      mode,
      mediaFile: playableFilePath
        ? `final/${mode === 'video_finale' ? 'video.mp4' : 'animatic.mp4'}`
        : null,
      platforms: {
        tiktok: { format: '9:16', maxDuration: 180 },
        youtube_shorts: { format: '9:16', maxDuration: 60 },
        instagram_reels: { format: '9:16', maxDuration: 90 },
      },
      generatedAt: new Date().toISOString(),
    }

    await writeFile(
      join(finalDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
    )

    // Tenter la publication TikTok si un fichier vidéo est disponible
    const videoPath = playableFilePath
      ? join(process.cwd(), playableFilePath.replace(/^\//, ''))
      : join(ctx.storagePath, 'final', mode === 'video_finale' ? 'video.mp4' : 'animatic.mp4')

    const publishResult = await publishToTikTok({
      runId: ctx.runId,
      videoPath,
      title,
      hashtags,
      mediaMode: mode,
    })

    // Persister le résultat de publication — toujours, succès ou NO_CREDENTIALS
    await savePublishResult(ctx.runId, publishResult)

    logger.info({
      event: 'publish_ready',
      runId: ctx.runId,
      title,
      mode,
      hasPlayable,
      tiktokStatus: publishResult.status,
      publishId: publishResult.publishId,
    })

    return {
      success: true,
      costEur: 0,
      outputData: {
        title,
        mode,
        hasPlayable,
        mediaFile: metadata.mediaFile,
        platforms: Object.keys(metadata.platforms),
        tiktokStatus: publishResult.status,
        publishId: publishResult.publishId,
        status: hasPlayable ? 'ready_for_export' : 'metadata_only',
      },
    }
  },
}
