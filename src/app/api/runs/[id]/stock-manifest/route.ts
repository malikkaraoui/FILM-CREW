import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { getRunById } from '@/lib/db/queries/runs'
import { logger } from '@/lib/logger'

/**
 * GET /api/runs/[id]/stock-manifest
 *
 * Retourne le stock-manifest.json produit par POST /api/runs/[id]/use-stock (11D).
 * Contient : runId, version, assets stock injectés (source, assetId, downloadPath, provenance).
 *
 * Retourne 404 si le run n'existe pas ou si aucun asset stock n'a encore été injecté.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const run = await getRunById(id)
    if (!run) {
      return NextResponse.json(
        { data: null, meta: { reason: 'Run introuvable' } },
        { status: 404 },
      )
    }

    const manifestPath = join(process.cwd(), 'storage', 'runs', id, 'stock-manifest.json')

    if (!existsSync(manifestPath)) {
      return NextResponse.json(
        { data: null, meta: { reason: 'stock-manifest.json absent — aucun asset stock injecté sur ce run' } },
        { status: 404 },
      )
    }

    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))

    logger.info({ event: 'stock_manifest_fetched', runId: id, assetCount: manifest.assets?.length ?? 0 })
    return NextResponse.json({ data: manifest })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'STOCK_MANIFEST_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
