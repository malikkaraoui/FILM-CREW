import { NextResponse } from 'next/server'
import { getAllConfig, setConfig } from '@/lib/db/queries/config'

export async function GET() {
  try {
    const configs = await getAllConfig()
    return NextResponse.json({ data: configs })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { key, value } = body

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Clé et valeur requises' } },
        { status: 400 }
      )
    }

    await setConfig(key, String(value))
    return NextResponse.json({ data: { key, value } })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}
