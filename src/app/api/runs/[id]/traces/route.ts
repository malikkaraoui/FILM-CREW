import { NextResponse } from 'next/server'
import { getAgentTraces } from '@/lib/db/queries/traces'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const traces = await getAgentTraces(id)
    return NextResponse.json({ data: traces })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
