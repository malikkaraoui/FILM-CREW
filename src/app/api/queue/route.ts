import { NextResponse } from 'next/server'
import { getQueueRuns } from '@/lib/db/queries/runs'
import type { QueueState, RunSummary } from '@/lib/observability/observability-types'
import { logger } from '@/lib/logger'

/**
 * GET /api/queue
 *
 * Retourne l'état de la file d'attente du pipeline (12A).
 *
 * Contient :
 * - pendingCount  : nombre de runs en attente
 * - runningCount  : nombre de runs en cours
 * - active        : résumé du run actif (running), null si aucun
 * - queue         : runs pending ordonnés par date de création
 */
export async function GET() {
  try {
    const rows = await getQueueRuns()

    const running = rows.filter((r) => r.status === 'running')
    const pending = rows.filter((r) => r.status === 'pending')

    const toSummary = (r: typeof rows[number]): RunSummary => ({
      id: r.id,
      idea: r.idea,
      type: r.type,
      status: r.status,
      currentStep: r.currentStep ?? null,
      costEur: r.costEur ?? null,
      createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    })

    const state: QueueState = {
      pendingCount: pending.length,
      runningCount: running.length,
      active: running.length > 0 ? toSummary(running[0]) : null,
      queue: pending.map(toSummary),
    }

    logger.info({ event: 'queue_fetched', pendingCount: state.pendingCount, runningCount: state.runningCount })
    return NextResponse.json({ data: state })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'QUEUE_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
