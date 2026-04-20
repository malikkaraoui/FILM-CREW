import { NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { getRunById } from '@/lib/db/queries/runs'
import { db } from '@/lib/db/connection'
import { clip } from '@/lib/db/schema'
import { registry } from '@/lib/providers/registry'
import { bootstrapProviders } from '@/lib/providers/bootstrap'
bootstrapProviders()
import type { StockProvider } from '@/lib/providers/types'
import type { StockManifest, StockAsset } from '@/lib/stock/stock-types'
import { logger } from '@/lib/logger'

/**
 * POST /api/runs/[id]/use-stock
 *
 * Injecte un asset stock (Pexels / Pixabay) dans une scène d'un run existant (11D).
 *
 * Body : { sceneIndex: number, query: string, type?: 'image'|'video', source?: string }
 *
 * - Recherche le premier résultat stock correspondant à la query.
 * - Télécharge l'asset dans clips/clip-{sceneIndex}-stock.{ext}.
 * - Persiste un enregistrement clip en DB (provider = source stock).
 * - Crée ou met à jour storage/runs/{id}/stock-manifest.json.
 *
 * Retourne 201 avec { runId, sceneIndex, source, assetId, assetType, downloadPath, url }.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: runId } = await params

    const run = await getRunById(runId)
    if (!run) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Run introuvable' } },
        { status: 404 },
      )
    }

    const body = await request.json()
    const { sceneIndex, query, type = 'image', source } = body as {
      sceneIndex: number
      query: string
      type?: 'image' | 'video'
      source?: string
    }

    if (typeof sceneIndex !== 'number' || sceneIndex < 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'sceneIndex doit être un entier >= 0' } },
        { status: 422 },
      )
    }

    if (!query?.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'query est requis' } },
        { status: 422 },
      )
    }

    // Sélectionner le provider stock
    const providers = registry.getByType('stock') as StockProvider[]
    if (providers.length === 0) {
      return NextResponse.json(
        { error: { code: 'NO_STOCK_PROVIDER', message: 'Aucun provider stock disponible (clés API manquantes ?)' } },
        { status: 503 },
      )
    }

    const provider = source
      ? (providers.find((p) => p.name === source) ?? providers[0])
      : providers[0]

    // Rechercher un asset stock
    const results = await provider.search(query.trim(), { type, limit: 1 })
    if (results.length === 0) {
      return NextResponse.json(
        { error: { code: 'NO_RESULTS', message: `Aucun résultat stock pour "${query}"` } },
        { status: 404 },
      )
    }

    const asset = results[0]

    // Préparer le dossier clips
    const runPath = join(process.cwd(), 'storage', 'runs', runId)
    const clipsDir = join(runPath, 'clips')
    await mkdir(clipsDir, { recursive: true })

    // Télécharger l'asset
    const ext = type === 'video' ? '.mp4' : '.jpg'
    const fileName = `clip-${sceneIndex}-stock${ext}`
    const downloadPath = join(clipsDir, fileName)

    const dlRes = await fetch(asset.url, { signal: AbortSignal.timeout(30_000) })
    if (!dlRes.ok) {
      return NextResponse.json(
        { error: { code: 'DOWNLOAD_ERROR', message: `Téléchargement échoué: HTTP ${dlRes.status}` } },
        { status: 500 },
      )
    }

    const buf = await dlRes.arrayBuffer()
    await writeFile(downloadPath, Buffer.from(buf))

    // Persister le clip en DB
    await db.insert(clip).values({
      id: crypto.randomUUID(),
      runId,
      stepIndex: sceneIndex,
      prompt: query.trim(),
      provider: asset.source,
      status: 'completed',
      filePath: downloadPath,
      costEur: 0,
    })

    // Lire ou créer stock-manifest.json
    const manifestPath = join(runPath, 'stock-manifest.json')
    let manifest: StockManifest

    if (existsSync(manifestPath)) {
      manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as StockManifest
    } else {
      manifest = {
        runId,
        version: 1,
        assets: [],
        generatedAt: new Date().toISOString(),
      }
    }

    // Ajouter l'asset (remplace si même sceneIndex — additivité sans doublon)
    const newAsset: StockAsset = {
      sceneIndex,
      source: asset.source,
      assetId: asset.id,
      assetType: type,
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl,
      title: asset.title,
      downloadPath,
      usedAt: new Date().toISOString(),
    }

    manifest.assets = [
      ...manifest.assets.filter((a) => a.sceneIndex !== sceneIndex),
      newAsset,
    ]

    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))

    logger.info({
      event: 'stock_asset_injected',
      runId,
      sceneIndex,
      source: asset.source,
      assetId: asset.id,
      assetType: type,
    })

    return NextResponse.json(
      {
        data: {
          runId,
          sceneIndex,
          source: asset.source,
          assetId: asset.id,
          assetType: type,
          downloadPath,
          url: asset.url,
        },
      },
      { status: 201 },
    )
  } catch (e) {
    logger.error({ event: 'stock_inject_error', error: (e as Error).message })
    return NextResponse.json(
      { error: { code: 'STOCK_INJECT_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
