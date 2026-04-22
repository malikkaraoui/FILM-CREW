import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { getRunById } from '@/lib/db/queries/runs'
import { getChainById, getPublicationAccounts } from '@/lib/db/queries/chains'
import type { PublishManifest } from '@/lib/publishers/platform-types'

/**
 * GET /api/runs/[id]/publication-context
 *
 * Agrégat léger pour la diffusion contextualisée d'un run (Lot 13C).
 * Retourne :
 *   - chainId + chainName
 *   - comptes de publication liés à la chaîne (publication_account)
 *   - publish-manifest.json si présent (historique par plateforme)
 *
 * Utilisé par preview/page.tsx et export/page.tsx pour un panneau de diffusion honnête.
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
        { error: { code: 'NOT_FOUND', message: 'Run introuvable' } },
        { status: 404 },
      )
    }

    const [chain, accounts] = await Promise.all([
      getChainById(run.chainId),
      getPublicationAccounts(run.chainId),
    ])

    const manifestPath = join(process.cwd(), 'storage', 'runs', id, 'publish-manifest.json')
    let manifest: PublishManifest | null = null
    if (existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
      } catch { /* manifest corrompu — on ignore */ }
    }

    return NextResponse.json({
      data: {
        chainId: run.chainId,
        chainName: chain?.name ?? null,
        accounts,
        manifest,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'CONTEXT_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
