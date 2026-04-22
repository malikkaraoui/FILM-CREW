import { readFile } from 'fs/promises'
import { NextResponse } from 'next/server'
import { readSketchStatus } from '@/lib/sketch/status'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const status = await readSketchStatus(id)

  if (!status) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Session sketch introuvable' } },
      { status: 404 },
    )
  }

  const { searchParams } = new URL(request.url)
  if (searchParams.get('asset') === '1') {
    if (!status.outputFilePath) {
      return NextResponse.json(
        { error: { code: 'NOT_READY', message: 'Aucun rendu sketch disponible pour cette session' } },
        { status: 404 },
      )
    }

    const file = await readFile(status.outputFilePath)
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-store',
      },
    })
  }

  return NextResponse.json({
    data: {
      id,
      status,
      meta: {
        ready: status.state === 'completed' && !!status.outputFilePath,
      },
    },
  })
}