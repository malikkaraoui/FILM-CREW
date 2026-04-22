import { readFile } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { getRuns } from '@/lib/db/queries/runs'

type ViralSource = {
  viralId: string
  segmentIndex: number
  segment?: {
    title?: string
    start_s?: number
    end_s?: number
  }
  sourceUrl?: string
}

export async function GET() {
  try {
    const runs = await getRuns()
    const viralRuns = runs.filter((run) => run.type === 'viral')

    const enriched = await Promise.all(
      viralRuns.map(async (run) => {
        const runPath = join(process.cwd(), 'storage', 'runs', run.id)
        let viralSource: ViralSource | null = null
        try {
          viralSource = JSON.parse(await readFile(join(runPath, 'viral-source.json'), 'utf-8')) as ViralSource
        } catch {
          viralSource = null
        }

        return {
          id: run.id,
          idea: run.idea,
          status: run.status,
          currentStep: run.currentStep,
          costEur: run.costEur,
          createdAt: run.createdAt,
          viralId: viralSource?.viralId ?? null,
          segmentIndex: viralSource?.segmentIndex ?? null,
          segmentTitle: viralSource?.segment?.title ?? null,
          segmentStart: viralSource?.segment?.start_s ?? null,
          segmentEnd: viralSource?.segment?.end_s ?? null,
          sourceUrl: viralSource?.sourceUrl ?? null,
        }
      }),
    )

    return NextResponse.json({ data: enriched })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'VIRAL_RUNS_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}