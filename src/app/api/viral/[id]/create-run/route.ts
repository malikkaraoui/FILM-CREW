import { NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { createRun, getActiveRun } from '@/lib/db/queries/runs'
import { executePipeline } from '@/lib/pipeline/engine'
import { logger } from '@/lib/logger'
import type { ViralManifest, ViralSegment } from '@/lib/viral/viral-types'

/**
 * POST /api/viral/[id]/create-run
 *
 * Crée un run pipeline depuis un segment viral.
 *
 * Body : { segmentIndex: number, chainId: string }
 *
 * - Lit segments.json de la session virale
 * - Construit l'idée depuis le titre du segment
 * - Crée le run en DB (type: 'viral')
 * - Persiste viral-source.json dans le run pour traçabilité source → run
 * - Met à jour viral-manifest.json (runsCreated)
 * - Lance le pipeline en fire-and-forget
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: viralId } = await params

  try {
    const body = await request.json() as { segmentIndex?: number; chainId?: string }
    const { segmentIndex, chainId } = body

    if (typeof segmentIndex !== 'number' || !chainId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'segmentIndex (number) et chainId (string) requis' } },
        { status: 400 },
      )
    }

    const viralDir = join(process.cwd(), 'storage', 'viral', viralId)
    const manifestPath = join(viralDir, 'viral-manifest.json')
    const segmentsPath = join(viralDir, 'segments.json')

    if (!existsSync(manifestPath)) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Session virale introuvable' } },
        { status: 404 },
      )
    }

    if (!existsSync(segmentsPath)) {
      return NextResponse.json(
        { error: { code: 'NO_SEGMENTS', message: 'Aucun segment disponible — session virale non complète' } },
        { status: 422 },
      )
    }

    const segmentsData = JSON.parse(await readFile(segmentsPath, 'utf-8')) as { segments?: ViralSegment[] }
    const segments = segmentsData.segments ?? []

    if (segmentIndex < 0 || segmentIndex >= segments.length) {
      return NextResponse.json(
        { error: { code: 'INVALID_SEGMENT', message: `segmentIndex ${segmentIndex} hors limites (0–${segments.length - 1})` } },
        { status: 400 },
      )
    }

    const active = await getActiveRun()
    if (active) {
      return NextResponse.json(
        { error: { code: 'RUN_ACTIVE', message: 'Un run est déjà en cours — attendez qu\'il se termine' } },
        { status: 409 },
      )
    }

    const segment = segments[segmentIndex]
    const idea = `[Viral ${segmentIndex + 1}/${segments.length}] ${segment.title}`
    const runId = crypto.randomUUID()

    await createRun({ id: runId, chainId, idea, type: 'viral' })

    // Créer les dossiers run
    const runPath = join(process.cwd(), 'storage', 'runs', runId)
    await mkdir(join(runPath, 'clips'), { recursive: true })
    await mkdir(join(runPath, 'audio'), { recursive: true })
    await mkdir(join(runPath, 'subtitles'), { recursive: true })
    await mkdir(join(runPath, 'storyboard'), { recursive: true })
    await mkdir(join(runPath, 'final'), { recursive: true })

    // Traçabilité source → run (viral-source.json dans le run)
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as ViralManifest
    const viralSource = {
      viralId,
      segmentIndex,
      segment,
      sourceUrl: manifest.url,
      createdAt: new Date().toISOString(),
    }
    await writeFile(join(runPath, 'viral-source.json'), JSON.stringify(viralSource, null, 2))

    // Mettre à jour viral-manifest.json (ajouter runId à runsCreated)
    const updatedManifest: ViralManifest = {
      ...manifest,
      runsCreated: [...(manifest.runsCreated ?? []).filter((r) => r !== runId), runId],
    }
    await writeFile(manifestPath, JSON.stringify(updatedManifest, null, 2))

    logger.info({ event: 'viral_run_created', viralId, runId, segmentIndex, idea })

    // Lancer le pipeline en fire-and-forget
    executePipeline(runId).catch((e) => {
      logger.error({ event: 'viral_pipeline_crash', runId, error: (e as Error).message })
    })

    return NextResponse.json(
      {
        data: {
          runId,
          viralId,
          segmentIndex,
          idea,
          chainId,
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    )
  } catch (e) {
    logger.error({ event: 'viral_create_run_error', viralId, error: (e as Error).message })
    return NextResponse.json(
      { error: { code: 'CREATE_RUN_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
