import { NextResponse } from 'next/server'
import { checkInterruptedRun, recoverZombies } from '@/lib/pipeline/recovery'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const interrupted = await checkInterruptedRun()
    logger.info({ event: 'recovery_check', found: !!interrupted, runId: interrupted?.id })
    return NextResponse.json({ data: interrupted })
  } catch (e) {
    logger.error({ event: 'recovery_check_error', message: (e as Error).message })
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}

/** Résout tous les runs zombies — idempotent, retourne le bilan (12C). */
export async function POST() {
  try {
    const result = await recoverZombies()
    logger.info({ event: 'recovery_triggered', recovered: result.recovered, runIds: result.runIds })
    return NextResponse.json({ data: result })
  } catch (e) {
    logger.error({ event: 'recovery_error', message: (e as Error).message })
    return NextResponse.json(
      { error: { code: 'RECOVERY_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
