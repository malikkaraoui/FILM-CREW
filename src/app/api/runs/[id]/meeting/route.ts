import { NextResponse } from 'next/server'
import { MeetingCoordinator } from '@/lib/agents/coordinator'
import { getRunById } from '@/lib/db/queries/runs'
import { getChainById } from '@/lib/db/queries/chains'
import { getAgentTraces } from '@/lib/db/queries/traces'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { logger } from '@/lib/logger'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const run = await getRunById(id)
    if (!run) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Run introuvable' } },
        { status: 404 },
      )
    }

    const existingTraces = await getAgentTraces(id)
    if (existingTraces.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'MEETING_ALREADY_EXISTS',
            message: 'Réunion déjà générée pour ce run — relance bloquée pour éviter les doublons d’agents.',
          },
          data: { tracesCount: existingTraces.length },
        },
        { status: 409 },
      )
    }

    // Charger le Brand Kit si disponible
    const chain = run.chainId ? await getChainById(run.chainId) : null
    let brandKit: string | null = null
    if (chain?.brandKitPath) {
      try {
        const brandPath = join(process.cwd(), chain.brandKitPath, 'brand.json')
        brandKit = await readFile(brandPath, 'utf-8')
      } catch {
        logger.warn({ event: 'brand_kit_not_found', chainId: run.chainId })
      }
    }

    const coordinator = new MeetingCoordinator({
      runId: id,
      idea: run.idea,
      brandKit,
    })

    const brief = await coordinator.runMeeting()

    return NextResponse.json({ data: brief })
  } catch (e) {
    logger.error({ event: 'meeting_error', error: (e as Error).message })
    return NextResponse.json(
      { error: { code: 'MEETING_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
