import type { PipelineStep, StepContext, StepResult } from '../types'

export const step1Idea: PipelineStep = {
  name: 'Idée',
  stepNumber: 1,

  async execute(ctx: StepContext): Promise<StepResult> {
    // L'idée est déjà saisie par l'utilisateur — on la persiste comme output
    return {
      success: true,
      costEur: 0,
      outputData: { idea: ctx.idea },
    }
  },
}
