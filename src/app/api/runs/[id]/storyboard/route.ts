import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { buildLocalStoryboardPrompt } from '@/lib/providers/image/storyboard-local'

function buildStoryboardPrompt(scene: { index: number; description: string; lighting: string; camera: string }): string {
  return buildLocalStoryboardPrompt({
    sceneIndex: scene.index,
    description: scene.description,
    lighting: scene.lighting,
    camera: scene.camera,
  })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const manifestPath = join(process.cwd(), 'storage', 'runs', id, 'storyboard', 'manifest.json')
    const raw = await readFile(manifestPath, 'utf-8')
    const manifest = JSON.parse(raw) as {
      images: Array<{ sceneIndex: number; description: string; prompt?: string; filePath: string; status: string; providerUsed?: string | null; failoverOccurred?: boolean; isPlaceholder?: boolean }>
      boardFilePath?: string | null
      boardLayout?: string | null
    }

    try {
      const structurePath = join(process.cwd(), 'storage', 'runs', id, 'structure.json')
      const structure = JSON.parse(await readFile(structurePath, 'utf-8')) as {
        scenes?: Array<{ index: number; description: string; lighting: string; camera: string }>
      }
      for (const image of manifest.images ?? []) {
        const inferredPlaceholder = image.isPlaceholder || image.filePath.includes('placeholder-') || image.filePath.endsWith('.txt')
        image.isPlaceholder = inferredPlaceholder
        if (inferredPlaceholder && image.status === 'generated') {
          image.status = 'pending'
        }

        if (!image.prompt) {
          const scene = structure.scenes?.find((item) => item.index === image.sceneIndex)
          if (scene) {
            image.prompt = buildStoryboardPrompt(scene)
          }
        }
      }
    } catch {
      // on garde le manifest brut
    }

    return NextResponse.json({ data: manifest })
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
    const { sceneIndex, description, status, prompt } = body

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
    if (prompt !== undefined) image.prompt = prompt

    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
    return NextResponse.json({ data: image })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'STORYBOARD_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
