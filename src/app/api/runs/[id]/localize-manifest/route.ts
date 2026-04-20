import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { logger } from '@/lib/logger'

/**
 * GET /api/runs/[id]/localize-manifest
 *
 * Retourne le localize-manifest.json produit par POST /api/runs/[id]/localize (11A).
 * Contient : langues localisées, chemins script/TTS, garantie visualReused, coût total.
 *
 * Retourne 404 si la localisation n'a pas encore été lancée.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const manifestPath = join(process.cwd(), 'storage', 'runs', id, 'localize-manifest.json')

    if (!existsSync(manifestPath)) {
      return NextResponse.json(
        { data: null, meta: { reason: 'localize-manifest.json absent — localisation non encore lancée' } },
        { status: 404 },
      )
    }

    const raw = await readFile(manifestPath, 'utf-8')
    const manifest = JSON.parse(raw)

    logger.info({ event: 'localize_manifest_fetched', runId: id })
    return NextResponse.json({ data: manifest })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'LOCALIZE_MANIFEST_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
