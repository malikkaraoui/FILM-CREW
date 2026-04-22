import { NextResponse } from 'next/server'
import { getRunById, getRunSteps } from '@/lib/db/queries/runs'
import type { RunProgress, StepProgress } from '@/lib/observability/observability-types'
import { logger } from '@/lib/logger'
import { TOTAL_PIPELINE_STEPS } from '@/lib/pipeline/constants'

/**
 * GET /api/runs/[id]/progress
 *
 * Retourne la progression détaillée d'un run (12A).
 *
 * Contient :
 * - progressPct  : % de progression (steps complétés / total canonique)
 * - elapsedMs    : temps écoulé depuis la création (ms)
 * - totalCostEur : coût accumulé
 * - steps        : chaque étape avec status, coût, durée, erreur
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const run = await getRunById(id)
    if (!run) {
      return NextResponse.json(
        { data: null, meta: { reason: 'Run introuvable' } },
        { status: 404 },
      )
    }

    const steps = await getRunSteps(id)

    // Calcul progression
    const completedCount = steps.filter((s) => s.status === 'completed').length
    const progressPct = Math.round((completedCount / TOTAL_PIPELINE_STEPS) * 100)

    // Temps écoulé depuis la création
    const createdAt = run.createdAt ? new Date(run.createdAt).getTime() : Date.now()
    const endTime = ['completed', 'failed', 'killed'].includes(run.status)
      ? (run.updatedAt ? new Date(run.updatedAt).getTime() : Date.now())
      : Date.now()
    const elapsedMs = Math.max(0, endTime - createdAt)

    // Détail des steps
    const stepDetails: StepProgress[] = steps.map((s) => {
      const start = s.startedAt ? new Date(s.startedAt).getTime() : null
      const end = s.completedAt ? new Date(s.completedAt).getTime() : null
      return {
        stepNumber: s.stepNumber,
        stepName: s.stepName,
        status: s.status,
        costEur: s.costEur ?? null,
        durationMs: start != null && end != null ? end - start : null,
        startedAt: s.startedAt?.toISOString() ?? null,
        completedAt: s.completedAt?.toISOString() ?? null,
        error: s.error ?? null,
      }
    })

    const progress: RunProgress = {
      runId: id,
      status: run.status,
      currentStep: run.currentStep ?? null,
      totalSteps: TOTAL_PIPELINE_STEPS,
      progressPct,
      elapsedMs,
      totalCostEur: run.costEur ?? 0,
      steps: stepDetails,
    }

    logger.info({ event: 'progress_fetched', runId: id, progressPct, status: run.status })
    return NextResponse.json({ data: progress })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'PROGRESS_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
