import { NextResponse } from 'next/server'
import { listTemplates } from '@/lib/templates/loader'

export async function GET() {
  try {
    const templates = await listTemplates()
    return NextResponse.json({ data: templates })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'TEMPLATE_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
