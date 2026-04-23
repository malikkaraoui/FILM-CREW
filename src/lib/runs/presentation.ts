import { getPipelineStepName, TOTAL_PIPELINE_STEPS } from '@/lib/pipeline/constants'
import type { Run } from '@/types/run'

const CURRENT_PROJECT_STATUSES = new Set(['pending', 'running', 'paused', 'failed'])

export function isCurrentProject(run: Pick<Run, 'status'>): boolean {
  return CURRENT_PROJECT_STATUSES.has(run.status)
}

export function getCurrentProject(runs: Run[]): Run | null {
  return runs.find((run) => isCurrentProject(run)) ?? null
}

export function getRunFocusStep(run: Pick<Run, 'currentStep'>): number {
  const step = run.currentStep ?? 1
  return Math.min(Math.max(step, 1), TOTAL_PIPELINE_STEPS)
}

export function getRunStepLabel(run: Pick<Run, 'currentStep'>): string {
  const step = getRunFocusStep(run)
  const stepName = getPipelineStepName(step)
  return stepName
    ? `Étape ${step}/${TOTAL_PIPELINE_STEPS} — ${stepName}`
    : `Étape ${step}/${TOTAL_PIPELINE_STEPS}`
}

export function getProjectStatusLabel(run: Pick<Run, 'status' | 'currentStep'>): string {
  const stepLabel = getRunStepLabel(run)

  switch (run.status) {
    case 'pending':
      return `${stepLabel} prête`
    case 'running':
      return `${stepLabel} en cours`
    case 'paused':
      return `${stepLabel} à valider`
    case 'failed':
      return `${stepLabel} en erreur`
    case 'completed':
      return 'Projet terminé'
    case 'killed':
      return 'Projet arrêté'
    default:
      return run.status
  }
}

export function getProjectStatusClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'text-amber-600'
    case 'running':
      return 'text-blue-600'
    case 'paused':
      return 'text-emerald-600'
    case 'failed':
      return 'text-red-600'
    case 'completed':
      return 'text-green-700'
    case 'killed':
      return 'text-muted-foreground'
    default:
      return 'text-foreground'
  }
}

export function getRunLandingHref(run: Pick<Run, 'id'>): string {
  return `/runs/${run.id}`
}
