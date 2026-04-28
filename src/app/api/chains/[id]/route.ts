import { NextResponse } from 'next/server'
import { getChainById, updateChain, archiveChain } from '@/lib/db/queries/chains'
import { getRunsByChainId } from '@/lib/db/queries/runs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const chain = await getChainById(id)
    if (!chain) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Chaîne introuvable' } },
        { status: 404 }
      )
    }
    return NextResponse.json({ data: chain })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, langSource, audience } = body

    const chain = await updateChain(id, { name, langSource, audience })
    if (!chain) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Chaîne introuvable' } },
        { status: 404 }
      )
    }
    return NextResponse.json({ data: chain })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const chain = await getChainById(id)
    if (!chain) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Chaîne introuvable' } },
        { status: 404 }
      )
    }

    if (chain.archivedAt) {
      return NextResponse.json(
        { error: { code: 'CHAIN_ALREADY_ARCHIVED', message: 'Cette chaîne est déjà archivée.' } },
        { status: 409 }
      )
    }

    const runs = await getRunsByChainId(id)
    const activeRuns = runs.filter((run) => ['pending', 'running'].includes(run.status))

    if (activeRuns.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'CHAIN_HAS_ACTIVE_RUNS',
            message: 'Impossible d’archiver cette chaîne tant qu’un projet est encore pending/running dessus.',
          },
        },
        { status: 409 }
      )
    }

    const archived = await archiveChain(id)
    return NextResponse.json({ data: { archived: true, chain: archived } })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}
