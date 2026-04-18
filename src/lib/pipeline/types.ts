export type StepContext = {
  runId: string
  chainId: string
  idea: string
  brandKitPath: string | null
  storagePath: string
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
