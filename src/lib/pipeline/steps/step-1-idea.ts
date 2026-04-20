import { readFile } from 'fs/promises'
import type { PipelineStep, StepContext, StepResult } from '../types'

type IntentionData = {
  answers: Record<string, string>
  prefix: string
  createdAt: string
}

export const step1Idea: PipelineStep = {
  name: 'Idée',
  stepNumber: 1,

  async execute(ctx: StepContext): Promise<StepResult> {
    let enrichedIdea = ctx.idea
    let intentionData: IntentionData | null = null

    // Si un questionnaire a été rempli, lire intention.json et enrichir l'idée
    if (ctx.intentionPath) {
      try {
        intentionData = JSON.parse(await readFile(ctx.intentionPath, 'utf-8')) as IntentionData
        if (intentionData.prefix) {
          enrichedIdea = `${intentionData.prefix}\n\nIdée : ${ctx.idea}`
        }
      } catch {
        // intention.json illisible — on continue avec l'idée brute
      }
    }

    return {
      success: true,
      costEur: 0,
      outputData: {
        idea: enrichedIdea,
        originalIdea: ctx.idea,
        hasIntention: !!intentionData,
        answeredCount: intentionData ? Object.keys(intentionData.answers).length : 0,
      },
    }
  },
}
