import { NextResponse } from 'next/server'
import { getRunById } from '@/lib/db/queries/runs'
import { killRun } from '@/lib/pipeline/kill-switch'
import { logger } from '@/lib/logger'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const run = await getRunById(id)

    if (!run) {
      logger.warn({ event: 'kill_not_found', runId: id })
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Run introuvable' } },
        { status: 404 },
      )
    }

    const TERMINAL_STATUSES = ['completed', 'failed', 'killed']
    if (TERMINAL_STATUSES.includes(run.status)) {
      logger.warn({ event: 'kill_already_terminal', runId: id, status: run.status })
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: `Le run est déjà dans un état terminal : "${run.status}"` } },
        { status: 409 },
      )
    }

    logger.info({ event: 'kill_requested', runId: id, currentStatus: run.status })
    const result = await killRun(id)
    return NextResponse.json({ data: result })
  } catch (e) {
    logger.error({ event: 'kill_error', message: (e as Error).message })
    return NextResponse.json(
      { error: { code: 'KILL_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
