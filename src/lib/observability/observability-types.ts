/**
 * 12A — Observabilité + queueing + E2E
 *
 * Types partagés pour la visibilité runtime du pipeline.
 */

/** Résumé léger d'un run pour l'affichage queue/dashboard. */
export type RunSummary = {
  id: string
  idea: string
  type: string
  status: string
  currentStep: number | null
  costEur: number | null
  createdAt: string
}

/** Étape du pipeline avec métriques de durée et coût. */
export type StepProgress = {
  stepNumber: number
  stepName: string
  status: string
  costEur: number | null
  /** Durée de l'étape en millisecondes (null si pas encore démarrée ou pas encore terminée). */
  durationMs: number | null
  startedAt: string | null
  completedAt: string | null
  error: string | null
}

/** Progression détaillée d'un run — retournée par GET /api/runs/{id}/progress. */
export type RunProgress = {
  runId: string
  status: string
  currentStep: number | null
  totalSteps: number
  /** Pourcentage de progression (0–100) basé sur les steps complétés. */
  progressPct: number
  /** Temps écoulé depuis la création du run (ms). */
  elapsedMs: number
  /** Coût total accumulé (EUR). */
  totalCostEur: number
  steps: StepProgress[]
}

/** État de la file d'attente — retourné par GET /api/queue. */
export type QueueState = {
  /** Nombre de runs en attente (status = pending). */
  pendingCount: number
  /** Nombre de runs en cours (status = running). */
  runningCount: number
  /** Run actif (running ou pending actif), null si aucun. */
  active: RunSummary | null
  /** Runs en attente ordonnés par date de création. */
  queue: RunSummary[]
}
