import { NextResponse } from 'next/server'
import { getPublicationAccounts, createPublicationAccount } from '@/lib/db/queries/chains'

const ALLOWED_PLATFORMS = ['tiktok', 'youtube', 'instagram', 'facebook', 'x']

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const accounts = await getPublicationAccounts(id)
    return NextResponse.json({ data: accounts })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { platform } = body
    if (!platform || !ALLOWED_PLATFORMS.includes(platform as string)) {
      return NextResponse.json(
        { error: { code: 'INVALID_PLATFORM', message: 'Plateforme invalide' } },
        { status: 400 }
      )
    }
    const account = await createPublicationAccount({
      id: crypto.randomUUID(),
      chainId: id,
      platform: platform as string,
    })
    return NextResponse.json({ data: account })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}
