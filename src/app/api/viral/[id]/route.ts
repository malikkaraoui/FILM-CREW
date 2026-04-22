import { NextResponse } from 'next/server'
import { readFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { logger } from '@/lib/logger'
import type { ViralManifest, ViralSegment } from '@/lib/viral/viral-types'
import { parseViralSegmentsFromLlm } from '@/lib/viral/segment-parser'
import { readViralStatus } from '@/lib/viral/status'
import { readViralShortExports } from '@/lib/viral/shorts'

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
  const status = await readViralStatus(id)

  if (!status && !existsSync(manifestPath)) {
    return NextResponse.json(
      { data: null, meta: { reason: 'Session virale introuvable ou non encore complète' } },
      { status: 404 },
    )
  }

  if (!existsSync(manifestPath)) {
    logger.info({ event: 'viral_status_fetched', id, state: status?.state, step: status?.currentStep })
    return NextResponse.json({ data: { status, shorts: [], assets: { sourceAvailable: false, captionsAvailable: false } }, meta: { ready: false } })
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as ViralManifest

  const segmentsPath = join(viralDir, 'segments.json')
  let segments: ViralSegment[] = []
  let recoveredFromRaw = false
  if (existsSync(segmentsPath)) {
    const raw = JSON.parse(await readFile(segmentsPath, 'utf-8')) as { segments?: ViralSegment[]; raw?: string }
    segments = raw.segments ?? []

    if (segments.length === 0 && typeof raw.raw === 'string' && raw.raw.trim()) {
      const recovered = parseViralSegmentsFromLlm(raw.raw)
      if (recovered.segments.length > 0) {
        segments = recovered.segments
        recoveredFromRaw = true
      }
    }
  }

  const shorts = await readViralShortExports(id)
  const files = await readdir(viralDir).catch(() => [])
  const captionsAvailable = files.some((file) => file.startsWith('captions') && file.endsWith('.vtt'))
  const sourceAvailable = existsSync(join(viralDir, 'source.mp4'))

  const responseManifest = recoveredFromRaw
    ? { ...manifest, segmentsCount: segments.length }
    : manifest

  const responseStatus = recoveredFromRaw && status
    ? {
        ...status,
        message: `${segments.length} segment(s) récupéré(s) depuis une réponse LLM non structurée`,
        logs: status.logs.map((entry, index, all) => (
          index === all.length - 1 && entry.step === 'completed'
            ? { ...entry, message: `${segments.length} segment(s) récupéré(s) malgré une réponse LLM non JSON` }
            : entry
        )),
      }
    : status

  logger.info({ event: 'viral_manifest_fetched', id })
  return NextResponse.json({
    data: {
      manifest: responseManifest,
      segments,
      status: responseStatus,
      shorts,
      assets: {
        sourceAvailable,
        captionsAvailable,
      },
    },
    meta: { ready: true },
  })
}
