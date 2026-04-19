import { NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { logger } from '@/lib/logger'

/**
 * GET /api/runs/[id]/media
 * Sert le fichier vidéo assemblé (video_finale ou animatic) pour lecture browser.
 * Supporte les Range headers pour le seeking HTML5 <video>.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Restriction de sécurité : uniquement depuis storage/runs/{id}/
    const storagePath = join(process.cwd(), 'storage', 'runs', id)
    const manifestPath = join(storagePath, 'preview-manifest.json')

    let manifest: { playableFilePath?: string | null; mode?: string; mediaType?: string | null }
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
    } catch {
      return NextResponse.json({ error: { code: 'NO_MANIFEST', message: 'preview-manifest.json introuvable' } }, { status: 404 })
    }

    if (!manifest.playableFilePath) {
      return NextResponse.json(
        { error: { code: 'NO_MEDIA', message: `Aucun fichier media playable disponible — mode: ${manifest.mode ?? 'none'}` } },
        { status: 404 },
      )
    }

    // Vérification de sécurité : le fichier doit être dans storage/runs/{id}/
    const filePath = manifest.playableFilePath
    if (!filePath.startsWith(storagePath)) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Chemin non autorisé' } }, { status: 403 })
    }

    let fileInfo: Awaited<ReturnType<typeof stat>>
    try {
      fileInfo = await stat(filePath)
    } catch {
      return NextResponse.json({ error: { code: 'FILE_NOT_FOUND', message: 'Fichier media introuvable sur disque' } }, { status: 404 })
    }

    const fileSize = fileInfo.size
    const contentType = manifest.mediaType ?? 'video/mp4'

    // Support Range pour le seeking HTML5 video
    const rangeHeader = request.headers.get('range')
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1], 10)
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1
        const chunkSize = end - start + 1

        const buffer = await readFile(filePath)
        const chunk = buffer.subarray(start, end + 1)

        logger.info({ event: 'media_served_range', runId: id, mode: manifest.mode, start, end, chunkSize, fileSize })
        return new Response(chunk, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': contentType,
          },
        })
      }
    }

    // Réponse complète
    logger.info({ event: 'media_served', runId: id, mode: manifest.mode, fileSize, contentType })
    const buffer = await readFile(filePath)
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'MEDIA_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
