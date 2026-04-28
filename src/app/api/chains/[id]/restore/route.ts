import { NextResponse } from 'next/server'
import { getChainById, restoreChain } from '@/lib/db/queries/chains'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const chain = await getChainById(id)
    if (!chain) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Chaîne introuvable' } },
        { status: 404 }
      )
    }

    if (!chain.archivedAt) {
      return NextResponse.json(
        { error: { code: 'CHAIN_NOT_ARCHIVED', message: 'Cette chaîne n’est pas archivée.' } },
        { status: 409 }
      )
    }

    const restored = await restoreChain(id)
    return NextResponse.json({ data: restored })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}
