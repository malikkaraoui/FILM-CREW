import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { logger } from '@/lib/logger'
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

    // Honnêteté produit : signaler clairement ce qui est disponible
    const { mode, playableFilePath } = previewManifest
    const hasPlayable = !!(playableFilePath)

    if (mode === 'none' && !hasPlayable) {
      logger.warn({ event: 'publish_no_media', runId: ctx.runId, mode })
      // On continue quand même pour écrire les métadonnées disponibles
    }

    // Générer les métadonnées d'export
    const structure = await readFile(join(ctx.storagePath, 'structure.json'), 'utf-8')
      .then((raw) => JSON.parse(raw))
      .catch(() => ({ title: ctx.idea, scenes: [] }))

    const metadata = {
      title: structure.title || ctx.idea,
      description: `${structure.title || ctx.idea} — Généré par FILM-CREW`,
      hashtags: ['#shorts', '#ai', '#filmcrew'],
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

    logger.info({ event: 'publish_ready', runId: ctx.runId, title: metadata.title, mode, hasPlayable })

    return {
      success: true,
      costEur: 0,
      outputData: {
        title: metadata.title,
        mode,
        hasPlayable,
        mediaFile: metadata.mediaFile,
        platforms: Object.keys(metadata.platforms),
        status: hasPlayable ? 'ready_for_export' : 'metadata_only',
      },
    }
  },
}
