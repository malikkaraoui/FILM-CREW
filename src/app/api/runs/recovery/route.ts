import { NextResponse } from 'next/server'
import { checkInterruptedRun } from '@/lib/pipeline/recovery'

export async function GET() {
  try {
    const interrupted = await checkInterruptedRun()
    return NextResponse.json({ data: interrupted })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}
