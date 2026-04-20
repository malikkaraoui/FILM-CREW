export type StepContext = {
  runId: string
  chainId: string
  idea: string
  brandKitPath: string | null
  storagePath: string
  /** Chemin absolu vers intention.json — présent si le questionnaire 10B a été rempli */
  intentionPath: string | null
}

export type StepResult = {
  success: boolean
  costEur: number
  outputData: unknown
  error?: string
}

export interface PipelineStep {
  name: string
  stepNumber: number
  execute(ctx: StepContext): Promise<StepResult>
}
