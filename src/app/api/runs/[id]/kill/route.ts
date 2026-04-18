import { NextResponse } from 'next/server'
import { getRunById } from '@/lib/db/queries/runs'
import { killRun } from '@/lib/pipeline/kill-switch'

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

    if (run.status !== 'running') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: `Le run est "${run.status}", pas "running"` } },
        { status: 409 },
      )
    }

    const result = await killRun(id)
    return NextResponse.json({ data: result })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'KILL_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
