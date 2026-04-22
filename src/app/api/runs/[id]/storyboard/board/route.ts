import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const manifestPath = join(process.cwd(), 'storage', 'runs', id, 'storyboard', 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as { boardFilePath?: string | null }

    if (!manifest.boardFilePath) {
      return new Response('Planche storyboard non disponible', { status: 404 })
    }

    const buffer = await readFile(manifest.boardFilePath)
    return new Response(buffer, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    })
  } catch {
    return new Response('Planche storyboard introuvable', { status: 404 })
  }
}
