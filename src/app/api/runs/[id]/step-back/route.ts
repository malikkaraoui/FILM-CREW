import { NextResponse } from 'next/server'
import { join } from 'path'
import { getRunById } from '@/lib/db/queries/runs'
import { resetRunFromStep } from '@/lib/pipeline/reset'

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

    if (r.status === 'running') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: 'Impossible de revenir en arrière pendant une exécution en cours' } },
        { status: 409 }
      )
    }

    if (targetStep < 1 || targetStep >= (r.currentStep ?? 1)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Étape cible invalide' } },
        { status: 400 }
      )
    }

    await resetRunFromStep({
      runId: id,
      storagePath: join(process.cwd(), 'storage', 'runs', id),
      stepNumber: targetStep,
    })

    const updated = await getRunById(id)
    return NextResponse.json({ data: updated })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}
