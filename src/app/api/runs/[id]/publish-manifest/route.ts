import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { logger } from '@/lib/logger'

/**
 * GET /api/runs/[id]/publish-manifest
 *
 * Retourne le publish-manifest.json produit à chaque POST /api/runs/[id]/publish (11B).
 * Contient : toutes les plateformes tentées, statuts, publishId, shareUrl, coût, etc.
 *
 * Additivité : chaque appel POST /publish upsert l'entrée de la plateforme concernée
 * sans écraser les autres plateformes.
 *
 * Retourne 404 si aucune publication n'a encore été lancée.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const manifestPath = join(process.cwd(), 'storage', 'runs', id, 'publish-manifest.json')

    if (!existsSync(manifestPath)) {
      return NextResponse.json(
        {
          data: null,
          meta: { reason: 'publish-manifest.json absent — aucune publication encore lancée' },
        },
        { status: 404 },
      )
    }

    const raw = await readFile(manifestPath, 'utf-8')
    const manifest = JSON.parse(raw)

    logger.info({ event: 'publish_manifest_fetched', runId: id })
    return NextResponse.json({ data: manifest })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'PUBLISH_MANIFEST_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
