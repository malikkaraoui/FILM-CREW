import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { logger } from '@/lib/logger'
import type { ViralManifest, ViralSegment } from '@/lib/viral/viral-types'

/**
 * GET /api/viral/[id]
 *
 * Retourne le viral-manifest.json + segments.json d'une session virale.
 * 404 si la session est introuvable ou non complète.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const viralDir = join(process.cwd(), 'storage', 'viral', id)
  const manifestPath = join(viralDir, 'viral-manifest.json')

  if (!existsSync(manifestPath)) {
    return NextResponse.json(
      { data: null, meta: { reason: 'Session virale introuvable ou non encore complète' } },
      { status: 404 },
    )
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as ViralManifest

  const segmentsPath = join(viralDir, 'segments.json')
  let segments: ViralSegment[] = []
  if (existsSync(segmentsPath)) {
    const raw = JSON.parse(await readFile(segmentsPath, 'utf-8')) as { segments?: ViralSegment[] }
    segments = raw.segments ?? []
  }

  logger.info({ event: 'viral_manifest_fetched', id })
  return NextResponse.json({ data: { manifest, segments } })
}
