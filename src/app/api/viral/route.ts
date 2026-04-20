import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { mkdir, writeFile, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { executeWithFailover } from '@/lib/providers/failover'
import type { LLMProvider } from '@/lib/providers/types'
import { logger } from '@/lib/logger'

function runCommand(cmd: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => { stdout += d })
    proc.stderr.on('data', (d) => { stderr += d })
    proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? 1 }))
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url, instruction } = body as { url: string; instruction?: string }

    if (!url?.includes('youtube.com') && !url?.includes('youtu.be')) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'URL YouTube invalide' } },
        { status: 400 },
      )
    }

    const id = crypto.randomUUID()
    const viralDir = join(process.cwd(), 'storage', 'viral', id)
    await mkdir(viralDir, { recursive: true })

    logger.info({ event: 'viral_start', id, url })

    // 1. Télécharger via yt-dlp
    const dlResult = await runCommand('yt-dlp', [
      '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
      '--merge-output-format', 'mp4',
      '-o', join(viralDir, 'source.mp4'),
      '--no-playlist',
      '--js-runtime', 'node',
      url,
    ], process.cwd())

    if (dlResult.code !== 0) {
      logger.error({ event: 'viral_download_failed', id, stderr: dlResult.stderr })
      return NextResponse.json(
        { error: { code: 'DOWNLOAD_ERROR', message: `yt-dlp erreur: ${dlResult.stderr.slice(0, 200)}` } },
        { status: 500 },
      )
    }

    // 2. Transcription (placeholder — WhisperX sera ajouté quand le script Python existe)
    // Pour l'instant, on utilise le LLM pour simuler la détection de segments
    const transcriptPath = join(viralDir, 'transcript.txt')
    await writeFile(transcriptPath, `[Transcription placeholder pour ${url}]`)

    // 3. Détection segments viraux via LLM
    const { result } = await executeWithFailover(
      'llm',
      async (p) => {
        const llm = p as LLMProvider
        return llm.chat(
          [
            {
              role: 'system',
              content: `Tu es un expert en vidéo virale. Analyse la description de cette vidéo YouTube et propose 3-5 segments de 30-60 secondes qui feraient de bons shorts TikTok/Reels.
${instruction ? `Consigne spéciale : ${instruction}` : ''}
Retourne un JSON :
{
  "segments": [
    {
      "index": 1,
      "start_s": 0,
      "end_s": 45,
      "title": "titre accrocheur",
      "reason": "pourquoi ce segment est viral",
      "excerpt": "extrait du texte"
    }
  ]
}
Retourne UNIQUEMENT le JSON.`,
            },
            {
              role: 'user',
              content: `URL YouTube : ${url}\nAnalyse et propose les meilleurs segments.`,
            },
          ],
          { temperature: 0.7, maxTokens: 1500 },
        )
      },
    )

    let segments: unknown
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      segments = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(result.content)
    } catch {
      segments = { segments: [], raw: result.content }
    }

    await writeFile(join(viralDir, 'segments.json'), JSON.stringify(segments, null, 2))

    // Écrire le viral-manifest.json (traçabilité source → segments → runs)
    let sourceSizeBytes: number | undefined
    try {
      const s = await stat(join(viralDir, 'source.mp4'))
      sourceSizeBytes = s.size
    } catch { /* fichier absent en cas d'erreur download */ }

    const segmentsArr = Array.isArray((segments as { segments: unknown[] }).segments)
      ? (segments as { segments: unknown[] }).segments
      : []

    const viralManifest = {
      id,
      version: 1 as const,
      url,
      sourceDownloaded: true,
      sourceSizeBytes,
      segmentsCount: segmentsArr.length,
      runsCreated: [] as string[],
      generatedAt: new Date().toISOString(),
    }
    await writeFile(join(viralDir, 'viral-manifest.json'), JSON.stringify(viralManifest, null, 2))

    logger.info({ event: 'viral_segments_detected', id, segmentsCount: segmentsArr.length })

    return NextResponse.json({
      data: {
        id,
        url,
        ...(segments as object),
        storagePath: viralDir,
      },
    })
  } catch (e) {
    logger.error({ event: 'viral_error', error: (e as Error).message })
    return NextResponse.json(
      { error: { code: 'VIRAL_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
