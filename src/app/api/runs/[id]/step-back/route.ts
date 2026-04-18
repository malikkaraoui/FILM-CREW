import { NextResponse } from 'next/server'
import { getRunById, updateRunStatus } from '@/lib/db/queries/runs'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { targetStep } = body

    const r = await getRunById(id)
    if (!r) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Run introuvable' } },
        { status: 404 }
      )
    }

    if (targetStep < 1 || targetStep >= (r.currentStep ?? 1)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Étape cible invalide' } },
        { status: 400 }
      )
    }

    const updated = await updateRunStatus(id, 'running', targetStep)
    return NextResponse.json({ data: updated })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}
