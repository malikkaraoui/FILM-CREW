import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const manifestPath = join(process.cwd(), 'storage', 'runs', id, 'storyboard', 'manifest.json')
    const raw = await readFile(manifestPath, 'utf-8')
    return NextResponse.json({ data: JSON.parse(raw) })
  } catch {
    return NextResponse.json({ data: { images: [] } })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { sceneIndex, description, status } = body

    const manifestPath = join(process.cwd(), 'storage', 'runs', id, 'storyboard', 'manifest.json')
    const raw = await readFile(manifestPath, 'utf-8')
    const manifest = JSON.parse(raw)

    const image = manifest.images.find((i: { sceneIndex: number }) => i.sceneIndex === sceneIndex)
    if (!image) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Scène introuvable' } },
        { status: 404 },
      )
    }

    if (description !== undefined) image.description = description
    if (status !== undefined) image.status = status

    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
    return NextResponse.json({ data: image })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'STORYBOARD_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
