import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  storyboardLocalProvider,
  buildLocalStoryboardPrompt,
  composeStoryboardBoard,
} from '@/lib/providers/image/storyboard-local'
import { logger } from '@/lib/logger'
import type { PipelineStep, StepContext, StepResult } from '../types'

type Scene = {
  index: number
  description: string
  dialogue: string
  camera: string
  lighting: string
  duration_s: number
}

type StoryboardImage = {
  sceneIndex: number
  description: string
  prompt: string
  filePath: string
  status: 'pending' | 'generated' | 'validated' | 'rejected'
  providerUsed?: string | null
  failoverOccurred?: boolean
  isPlaceholder?: boolean
}

export const step4Storyboard: PipelineStep = {
  name: 'Storyboard',
  stepNumber: 4,

  async execute(ctx: StepContext): Promise<StepResult> {
    // Lire la structure JSON de l'étape précédente
    let structure: { scenes: Scene[] }
    try {
      const raw = await readFile(join(ctx.storagePath, 'structure.json'), 'utf-8')
      structure = JSON.parse(raw)
    } catch {
      return {
        success: false,
        costEur: 0,
        outputData: null,
        error: 'Fichier structure.json introuvable — l\'étape 3 a échoué ?',
      }
    }

    const images: StoryboardImage[] = []
    let totalCost = 0

    for (const scene of structure.scenes) {
      const prompt = buildLocalStoryboardPrompt({
        sceneIndex: scene.index,
        description: scene.description,
        lighting: scene.lighting,
        camera: scene.camera,
        durationS: scene.duration_s,
        dialogue: scene.dialogue,
      })

      try {
        const storyboardDir = join(ctx.storagePath, 'storyboard')
        const result = await storyboardLocalProvider.generate(prompt, {
          width: 1280,
          height: 720,
          style: 'storyboard-rough-local',
          outputDir: storyboardDir,
        })

        totalCost += result.costEur

        images.push({
          sceneIndex: scene.index,
          description: scene.description,
          prompt,
          filePath: result.filePath,
          status: 'generated',
          providerUsed: storyboardLocalProvider.name,
          failoverOccurred: false,
          isPlaceholder: false,
        })
      } catch (e) {
        logger.warn({
          event: 'storyboard_image_failed',
          runId: ctx.runId,
          sceneIndex: scene.index,
          error: (e as Error).message,
        })

        // Créer un placeholder pour les images qui échouent
        const placeholderPath = join(ctx.storagePath, 'storyboard', `scene-${scene.index}-placeholder.txt`)
        await writeFile(placeholderPath, `[Image non générée]\n${prompt}`)

        images.push({
          sceneIndex: scene.index,
          description: scene.description,
          prompt,
          filePath: placeholderPath,
          status: 'pending',
          providerUsed: null,
          failoverOccurred: false,
          isPlaceholder: true,
        })
      }
    }

    let boardFilePath: string | null = null
    let boardLayout: string | null = null
    try {
      const board = await composeStoryboardBoard(images, join(ctx.storagePath, 'storyboard'))
      boardFilePath = board.filePath
      boardLayout = `${board.columns}x${board.rows}`
    } catch (e) {
      logger.warn({
        event: 'storyboard_board_failed',
        runId: ctx.runId,
        error: (e as Error).message,
      })
    }

    // Sauvegarder le manifest storyboard
    const manifest = {
      images,
      boardFilePath,
      boardLayout,
      generatedAt: new Date().toISOString(),
    }
    await writeFile(
      join(ctx.storagePath, 'storyboard', 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    )

    const realGenerated = images.filter((img) => img.status === 'generated' && !img.isPlaceholder)
    const placeholderCount = images.filter((img) => img.isPlaceholder).length
    const allGenerated = images.every((img) => img.status === 'generated' && !img.isPlaceholder)

    return {
      success: true, // on continue même si certaines images ont échoué
      costEur: totalCost,
      outputData: {
        imageCount: images.length,
        generatedCount: realGenerated.length,
        placeholderCount,
        allGenerated,
        boardFilePath,
        boardLayout,
      },
    }
  },
}
