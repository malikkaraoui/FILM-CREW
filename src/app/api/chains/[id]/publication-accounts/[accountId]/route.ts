import { NextResponse } from 'next/server'
import { deletePublicationAccount } from '@/lib/db/queries/chains'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  try {
    const { accountId } = await params
    await deletePublicationAccount(accountId)
    return NextResponse.json({ data: { deleted: true } })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}
