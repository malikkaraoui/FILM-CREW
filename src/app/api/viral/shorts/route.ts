import { readdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'
import type { ViralShortExportManifest, ViralManifest } from '@/lib/viral/viral-types'

export async function GET() {
  try {
    const baseDir = join(process.cwd(), 'storage', 'viral')
    if (!existsSync(baseDir)) {
      return NextResponse.json({ data: [] })
    }

    const entries = await readdir(baseDir, { withFileTypes: true })
    const history = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const viralId = entry.name
          const viralDir = join(baseDir, viralId)
          const shortsPath = join(viralDir, 'shorts.json')
          if (!existsSync(shortsPath)) return []

          const manifestPath = join(viralDir, 'viral-manifest.json')
          let sourceUrl: string | null = null
          try {
            const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as ViralManifest
            sourceUrl = manifest.url
          } catch {
            sourceUrl = null
          }

          const shorts = JSON.parse(await readFile(shortsPath, 'utf-8')) as ViralShortExportManifest
          return (shorts.exports ?? []).map((item) => ({
            viralId,
            segmentIndex: item.segmentIndex,
            title: item.title,
            start_s: item.start_s,
            end_s: item.end_s,
            crop916: item.crop916,
            burnSubtitles: item.burnSubtitles,
            status: item.status,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            sourceUrl,
          }))
        }),
    )

    return NextResponse.json({
      data: history
        .flat()
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    })
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'VIRAL_SHORTS_ERROR', message: (error as Error).message } },
      { status: 500 },
    )
  }
}