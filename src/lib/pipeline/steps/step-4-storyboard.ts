import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  storyboardLocalProvider,
  buildLocalStoryboardPrompt,
  composeStoryboardBoard,
  mergeStoryboardPromptWithCloudPlan,
} from '@/lib/providers/image/storyboard-local'
import { logger } from '@/lib/logger'
import { queueStoryboardCloudBatchGeneration } from '@/lib/storyboard/cloud-plan'
import type { PipelineStep, StepContext, StepResult } from '../types'
import {
  getBlueprintScene,
  readStoryboardBlueprint,
  type StructuredStoryDocument,
} from '@/lib/storyboard/blueprint'

type StoryboardImage = {
  sceneIndex: number
  description: string
  prompt: string
  filePath: string
  status: 'pending' | 'generated' | 'validated' | 'rejected'
  providerUsed?: string | null
  failoverOccurred?: boolean
  isPlaceholder?: boolean
  cloudPlanStatus?: 'queued' | 'ready' | 'failed' | null
  cloudPlanModel?: string | null
  cloudPlanMode?: string | null
  cloudPlanFilePath?: string | null
  cloudPlanRequestedAt?: string | null
  cloudPlanCompletedAt?: string | null
  cloudPlanError?: string | null
}

export const step4Storyboard: PipelineStep = {
  name: 'Storyboard',
  stepNumber: 5,

  async execute(ctx: StepContext): Promise<StepResult> {
    // Lire la structure JSON de l'étape précédente
    let structure: StructuredStoryDocument
    try {
      const raw = await readFile(join(ctx.storagePath, 'structure.json'), 'utf-8')
      structure = JSON.parse(raw) as StructuredStoryDocument
    } catch {
      return {
        success: false,
        costEur: 0,
        outputData: null,
        error: 'Fichier structure.json introuvable — l\'étape 3 a échoué ?',
      }
    }

    const blueprint = await readStoryboardBlueprint(ctx.storagePath)

    const images: StoryboardImage[] = []
    let totalCost = 0

    for (const scene of structure.scenes) {
      const basePrompt = buildLocalStoryboardPrompt({
        sceneIndex: scene.index,
        description: scene.description,
        lighting: scene.lighting,
        camera: scene.camera,
        durationS: scene.duration_s,
        dialogue: scene.dialogue,
      })
      const blueprintScene = getBlueprintScene(blueprint, scene.index)
      const prompt = blueprintScene
        ? mergeStoryboardPromptWithCloudPlan(basePrompt, blueprintScene)
        : basePrompt

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
          description: blueprintScene?.childCaption || scene.description,
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
          description: blueprintScene?.childCaption || scene.description,
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

    const cloudPlanJob = await queueStoryboardCloudBatchGeneration({
      runId: ctx.runId,
      storagePath: ctx.storagePath,
      scenes: images.map((image) => {
        const scene = structure.scenes.find((entry) => entry.index === image.sceneIndex)
        return {
          runId: ctx.runId,
          storagePath: ctx.storagePath,
          sceneIndex: image.sceneIndex,
          description: scene?.description || image.description,
          prompt: image.prompt,
          camera: scene?.camera,
          lighting: getBlueprintScene(blueprint, image.sceneIndex)?.lighting || scene?.lighting,
          durationS: scene?.duration_s,
          blueprint: getBlueprintScene(blueprint, image.sceneIndex),
        }
      }),
    })

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
        blueprintUsed: Boolean(blueprint?.scenes.length),
        cloudPlanQueued: cloudPlanJob.queued,
        cloudPlanModel: cloudPlanJob.model ?? null,
        cloudPlanMode: cloudPlanJob.mode ?? null,
        cloudPlanSceneCount: cloudPlanJob.sceneCount,
      },
    }
  },
}
