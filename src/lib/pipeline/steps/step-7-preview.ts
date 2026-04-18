import { readFile, writeFile, access } from 'fs/promises'
import { join } from 'path'
import { logger } from '@/lib/logger'
import type { PipelineStep, StepContext, StepResult } from '../types'

export const step7Preview: PipelineStep = {
  name: 'Preview',
  stepNumber: 7,

  async execute(ctx: StepContext): Promise<StepResult> {
    // Lire le manifest de génération
    let manifest: { clips: { sceneIndex: number; filePath: string }[]; audioPath: string | null }
    try {
      const raw = await readFile(join(ctx.storagePath, 'generation-manifest.json'), 'utf-8')
      manifest = JSON.parse(raw)
    } catch {
      return { success: false, costEur: 0, outputData: null, error: 'generation-manifest.json introuvable' }
    }

    // Vérifier que les fichiers existent
    const validClips: string[] = []
    for (const clip of manifest.clips) {
      try {
        await access(clip.filePath)
        validClips.push(clip.filePath)
      } catch {
        logger.warn({ event: 'clip_missing', runId: ctx.runId, path: clip.filePath })
      }
    }

    // Générer le fichier de preview (concat list pour FFmpeg)
    const concatList = validClips.map((p) => `file '${p}'`).join('\n')
    const concatPath = join(ctx.storagePath, 'final', 'concat.txt')
    await writeFile(concatPath, concatList)

    // Sauvegarder le manifest preview
    const previewManifest = {
      clips: validClips,
      audioPath: manifest.audioPath,
      concatPath,
      readyForAssembly: validClips.length > 0,
      createdAt: new Date().toISOString(),
    }
    await writeFile(
      join(ctx.storagePath, 'preview-manifest.json'),
      JSON.stringify(previewManifest, null, 2),
    )

    // Note : l'assemblage FFmpeg sera déclenché par l'utilisateur
    // ou automatiquement si tout est validé

    return {
      success: true,
      costEur: 0, // Preview local = gratuit
      outputData: {
        validClipCount: validClips.length,
        totalClips: manifest.clips.length,
        hasAudio: !!manifest.audioPath,
        readyForAssembly: validClips.length > 0,
      },
    }
  },
}
