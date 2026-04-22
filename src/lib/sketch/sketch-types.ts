export type SketchSessionState = 'queued' | 'running' | 'completed' | 'error'

export type SketchSessionStep =
  | 'queued'
  | 'validating'
  | 'preparing'
  | 'rendering'
  | 'completed'
  | 'error'

export type SketchExecutionScope = 'local' | 'external' | 'mixed'

export type SketchSessionLog = {
  at: string
  step: SketchSessionStep
  scope: SketchExecutionScope
  message: string
  details?: string
}

export type SketchSessionStatus = {
  id: string
  promptExcerpt: string
  requestedDurationSeconds: number
  state: SketchSessionState
  currentStep: SketchSessionStep
  message: string
  logs: SketchSessionLog[]
  startedAt: string
  updatedAt: string
  providerUsed?: string
  providerMode?: SketchExecutionScope
  outputFilePath?: string
  completedAt?: string
  error?: string
}