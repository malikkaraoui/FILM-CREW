import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; sceneIndex: string }> },
) {
  try {
    const { id, sceneIndex } = await params
    const manifestPath = join(process.cwd(), 'storage', 'runs', id, 'storyboard', 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
    const image = manifest.images?.find((i: { sceneIndex: number }) => i.sceneIndex === parseInt(sceneIndex))

    if (!image || image.status !== 'generated') {
      return new Response('Image non disponible', { status: 404 })
    }

    const buffer = await readFile(image.filePath)
    const ext = image.filePath.split('.').pop()?.toLowerCase() ?? 'png'
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'

    return new Response(buffer, {
      headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' },
    })
  } catch {
    return new Response('Image introuvable', { status: 404 })
  }
}
