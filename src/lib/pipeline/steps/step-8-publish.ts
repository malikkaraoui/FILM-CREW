import { readFile, writeFile, access } from 'fs/promises'
import { join } from 'path'
import { logger } from '@/lib/logger'
import type { PipelineStep, StepContext, StepResult } from '../types'

export const step8Publish: PipelineStep = {
  name: 'Publication',
  stepNumber: 8,

  async execute(ctx: StepContext): Promise<StepResult> {
    // Vérifier que la vidéo finale existe
    const finalDir = join(ctx.storagePath, 'final')
    let previewManifest: { clips: string[]; audioPath: string | null; readyForAssembly: boolean }

    try {
      const raw = await readFile(join(ctx.storagePath, 'preview-manifest.json'), 'utf-8')
      previewManifest = JSON.parse(raw)
    } catch {
      return { success: false, costEur: 0, outputData: null, error: 'preview-manifest.json introuvable' }
    }

    if (!previewManifest.readyForAssembly) {
      return {
        success: false,
        costEur: 0,
        outputData: null,
        error: 'Aucun clip valide pour la publication',
      }
    }

    // Générer les métadonnées d'export
    const structure = await readFile(join(ctx.storagePath, 'structure.json'), 'utf-8')
      .then((raw) => JSON.parse(raw))
      .catch(() => ({ title: ctx.idea, scenes: [] }))

    const metadata = {
      title: structure.title || ctx.idea,
      description: `${structure.title || ctx.idea} — Généré par FILM-CREW`,
      hashtags: ['#shorts', '#ai', '#filmcrew'],
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

    logger.info({ event: 'publish_ready', runId: ctx.runId, title: metadata.title })

    return {
      success: true,
      costEur: 0,
      outputData: {
        title: metadata.title,
        platforms: Object.keys(metadata.platforms),
        status: 'ready_for_export',
      },
    }
  },
}
