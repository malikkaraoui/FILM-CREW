import { NextResponse } from 'next/server'
import { db } from '@/lib/db/connection'
import { clip } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const clips = await db
      .select()
      .from(clip)
      .where(eq(clip.runId, id))
      .orderBy(clip.stepIndex)

    return NextResponse.json({ data: clips })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
