import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { logger } from '@/lib/logger'

/**
 * GET /api/runs/[id]/preview-manifest
 * Retourne le preview-manifest.json d'un run (mode, playableFilePath, etc.)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const manifestPath = join(process.cwd(), 'storage', 'runs', id, 'preview-manifest.json')

    let manifest: unknown
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
    } catch {
      return NextResponse.json(
        { error: { code: 'NO_MANIFEST', message: 'preview-manifest.json introuvable' } },
        { status: 404 },
      )
    }

    logger.info({ event: 'preview_manifest_fetched', runId: id })
    return NextResponse.json({ data: manifest })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'MANIFEST_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
