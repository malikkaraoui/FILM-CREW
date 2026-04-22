import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { readViralShortExports, upsertViralShortExport, getViralShortExport } from '@/lib/viral/shorts'
import type { ViralManifest, ViralSegment, ViralShortExport, ViralSubtitleStyle } from '@/lib/viral/viral-types'

const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg'

function runCommand(cmd: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (data) => { stdout += data.toString() })
    proc.stderr.on('data', (data) => { stderr += data.toString() })
    proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? 1 }))
  })
}

function escapeFilterPath(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/'/g, "\\'")
}

type VttCue = {
  startMs: number
  endMs: number
  text: string
}

async function findCaptionFile(viralDir: string): Promise<string | null> {
  const files = await readdir(viralDir)
  const caption = files.find((file) => file.startsWith('captions') && file.endsWith('.vtt'))
  return caption ? join(viralDir, caption) : null
}

function buildOutputPath(viralDir: string, segmentIndex: number, crop916: boolean, burnSubtitles: boolean): string {
  return join(
    viralDir,
    'exports',
    `segment-${segmentIndex + 1}-${crop916 ? '916' : 'source'}-${burnSubtitles ? 'subs' : 'clean'}.mp4`,
  )
}

function parseVttTimestamp(value: string): number {
  const parts = value.trim().split(':')
  const secondsWithMs = parts.pop()
  if (!secondsWithMs) return 0

  const [secondsRaw, msRaw = '0'] = secondsWithMs.split('.')
  const seconds = Number(secondsRaw)
  const milliseconds = Number(msRaw.padEnd(3, '0').slice(0, 3))

  if (parts.length === 2) {
    const [hoursRaw, minutesRaw] = parts
    return (((Number(hoursRaw) * 60) + Number(minutesRaw)) * 60 * 1000) + (seconds * 1000) + milliseconds
  }

  if (parts.length === 1) {
    const [minutesRaw] = parts
    return ((Number(minutesRaw) * 60 * 1000) + (seconds * 1000) + milliseconds)
  }

  return (seconds * 1000) + milliseconds
}

function formatVttTimestamp(ms: number): string {
  const safe = Math.max(0, Math.round(ms))
  const hours = Math.floor(safe / 3_600_000)
  const minutes = Math.floor((safe % 3_600_000) / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1_000)
  const milliseconds = safe % 1_000

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':') + `.${String(milliseconds).padStart(3, '0')}`
}

function parseVttCues(vtt: string): VttCue[] {
  const blocks = vtt
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  const cues: VttCue[] = []

  for (const block of blocks) {
    if (block === 'WEBVTT') continue

    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const timingLine = lines.find((line) => line.includes('-->'))
    if (!timingLine) continue

    const textLines = lines.slice(lines.indexOf(timingLine) + 1).filter((line) => line && !/^NOTE\b/.test(line))
    if (textLines.length === 0) continue

    const match = timingLine.match(/^(\d{2}:\d{2}(?::\d{2})?\.\d{3})\s+-->\s+(\d{2}:\d{2}(?::\d{2})?\.\d{3})/)
    if (!match) continue

    const [, rawStart, rawEnd] = match
    cues.push({
      startMs: parseVttTimestamp(rawStart),
      endMs: parseVttTimestamp(rawEnd),
      text: textLines.join(' ').replace(/\s+/g, ' ').trim(),
    })
  }

  return cues
}

function serializeVttCues(cues: VttCue[]): string {
  const body = cues
    .map((cue) => `${formatVttTimestamp(cue.startMs)} --> ${formatVttTimestamp(cue.endMs)}\n${cue.text}`)
    .join('\n\n')

  return `WEBVTT\n\n${body}\n`
}

function splitTextForSubtitleDisplay(text: string, maxCharsPerLine: number, maxLines: number): Array<{ text: string; charCount: number }> {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (words.length === 0) return []

  const chunks: Array<{ text: string; charCount: number }> = []
  let currentLines: string[] = []
  let currentLine = ''

  function finalizeChunk() {
    const lines = [...currentLines]
    if (currentLine) lines.push(currentLine)
    const chunkText = lines.join('\n').trim()
    if (chunkText) {
      chunks.push({ text: chunkText, charCount: chunkText.replace(/\n/g, ' ').length })
    }
    currentLines = []
    currentLine = ''
  }

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word

    if (candidate.length <= maxCharsPerLine || !currentLine) {
      currentLine = candidate
      continue
    }

    currentLines.push(currentLine)
    currentLine = word

    if (currentLines.length >= maxLines) {
      finalizeChunk()
    }
  }

  if (currentLine || currentLines.length > 0) {
    finalizeChunk()
  }

  return chunks
}

function reshapeSubtitleVtt(vtt: string, subtitleStyle: ViralSubtitleStyle): string {
  const cues = parseVttCues(vtt)
  const output: VttCue[] = []

  for (const cue of cues) {
    const chunks = splitTextForSubtitleDisplay(cue.text, subtitleStyle.maxCharsPerLine, subtitleStyle.maxLines)
    if (chunks.length <= 1) {
      output.push({
        ...cue,
        text: chunks[0]?.text ?? cue.text,
      })
      continue
    }

    const totalChars = chunks.reduce((sum, chunk) => sum + Math.max(chunk.charCount, 1), 0)
    const duration = Math.max(cue.endMs - cue.startMs, chunks.length * 120)
    let cursor = cue.startMs

    chunks.forEach((chunk, index) => {
      const isLast = index === chunks.length - 1
      const remainingChunks = chunks.length - index - 1
      const remainingMinDuration = remainingChunks * 80
      const remainingAvailable = Math.max(cue.endMs - cursor, 80)
      const chunkDuration = isLast
        ? remainingAvailable
        : Math.max(
            80,
            Math.min(
              Math.max(remainingAvailable - remainingMinDuration, 80),
              Math.round(duration * (chunk.charCount / totalChars)),
            ),
          )

      const nextEnd = isLast
        ? cue.endMs
        : Math.min(cue.endMs, cursor + chunkDuration)

      output.push({
        startMs: cursor,
        endMs: Math.min(cue.endMs, Math.max(cursor + 80, nextEnd)),
        text: chunk.text,
      })

      cursor = nextEnd
    })
  }

  return serializeVttCues(output)
}

async function prepareCaptionFile(
  captionsPath: string,
  viralDir: string,
  segmentIndex: number,
  subtitleStyle: ViralSubtitleStyle,
): Promise<string> {
  const rawVtt = await readFile(captionsPath, 'utf-8')
  const reshaped = reshapeSubtitleVtt(rawVtt, subtitleStyle)
  const outputPath = join(viralDir, 'exports', `captions-${segmentIndex + 1}.vtt`)
  await writeFile(outputPath, reshaped)
  return outputPath
}

function sanitizeFontFamily(value: unknown): string {
  if (typeof value !== 'string') return 'Arial'
  const sanitized = value.replace(/[^a-zA-Z0-9 \-_]/g, '').trim()
  return sanitized || 'Arial'
}

function sanitizeFontSize(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return 16
  return Math.min(48, Math.max(12, Math.round(numeric)))
}

function sanitizeSubtitleColor(value: unknown): string {
  if (typeof value !== 'string') return '#ffff00'
  const normalized = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized.toLowerCase()
  return '#ffff00'
}

function sanitizeMaxCharsPerLine(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return 18
  return Math.min(42, Math.max(10, Math.round(numeric)))
}

function sanitizeMaxLines(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return 2
  return Math.min(3, Math.max(1, Math.round(numeric)))
}

function sanitizeSubtitleStyle(value: unknown): ViralSubtitleStyle {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    fontSize: sanitizeFontSize(raw.fontSize),
    fontFamily: sanitizeFontFamily(raw.fontFamily),
    color: sanitizeSubtitleColor(raw.color),
    maxCharsPerLine: sanitizeMaxCharsPerLine(raw.maxCharsPerLine),
    maxLines: sanitizeMaxLines(raw.maxLines),
  }
}

function hexToAssPrimaryColour(hexColor: string): string {
  const cleaned = hexColor.replace('#', '')
  const rr = cleaned.slice(0, 2)
  const gg = cleaned.slice(2, 4)
  const bb = cleaned.slice(4, 6)
  return `&H00${bb}${gg}${rr}`.toUpperCase()
}

function parseByteRange(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/)
  if (!match) return null

  const [, rawStart, rawEnd] = match

  if (!rawStart && !rawEnd) return null

  if (!rawStart) {
    const suffixLength = Number(rawEnd)
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null
    const start = Math.max(fileSize - suffixLength, 0)
    return { start, end: fileSize - 1 }
  }

  const start = Number(rawStart)
  const end = rawEnd ? Number(rawEnd) : fileSize - 1

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= fileSize) {
    return null
  }

  return {
    start,
    end: Math.min(end, fileSize - 1),
  }
}

async function processShortExport(params: {
  viralId: string
  segment: ViralSegment
  title: string
  sourceUrl: string | null
  crop916: boolean
  burnSubtitles: boolean
  subtitleStyle: ViralSubtitleStyle
}) {
  const { viralId, segment, title, sourceUrl, crop916, burnSubtitles, subtitleStyle } = params
  const viralDir = join(process.cwd(), 'storage', 'viral', viralId)
  const sourcePath = join(viralDir, 'source.mp4')
  const captionsPath = await findCaptionFile(viralDir)
  const outputPath = buildOutputPath(viralDir, segment.index, crop916, burnSubtitles)
  const now = new Date().toISOString()
  const outputEnd = Math.min(segment.end_s, segment.start_s + 60)

  const baseEntry: ViralShortExport = {
    segmentIndex: segment.index,
    title,
    start_s: segment.start_s,
    end_s: outputEnd,
    crop916,
    burnSubtitles,
    subtitleStyle: burnSubtitles ? subtitleStyle : undefined,
    status: 'processing',
    outputFilePath: null,
    sourceUrl,
    subtitlesAvailable: !!captionsPath,
    createdAt: now,
    updatedAt: now,
    error: null,
  }
  await upsertViralShortExport(viralId, baseEntry)

  try {
    if (!existsSync(sourcePath)) {
      throw new Error('source.mp4 introuvable pour cette session virale')
    }
    if (burnSubtitles && !captionsPath) {
      throw new Error('Impossible d’incruster les sous-titres : aucun fichier VTT horodaté disponible')
    }

    await mkdir(join(viralDir, 'exports'), { recursive: true })
    const preparedCaptionsPath = burnSubtitles && captionsPath
      ? await prepareCaptionFile(captionsPath, viralDir, segment.index, subtitleStyle)
      : null

    const duration = Math.max(1, outputEnd - segment.start_s)
    const filters: string[] = []
    if (crop916) {
      filters.push('scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280')
    }
    if (burnSubtitles && preparedCaptionsPath) {
      const ffmpegSubtitleStyle = [
        `FontName=${subtitleStyle.fontFamily}`,
        `FontSize=${subtitleStyle.fontSize}`,
        `PrimaryColour=${hexToAssPrimaryColour(subtitleStyle.color)}`,
        'OutlineColour=&H00000000',
        'BackColour=&H66000000',
        'BorderStyle=3',
        'Outline=1',
        'Shadow=0',
        'Alignment=2',
        'MarginV=58',
        'Bold=1',
      ].join(',')

      filters.push(`subtitles='${escapeFilterPath(preparedCaptionsPath)}':force_style='${ffmpegSubtitleStyle}'`)
    }

    const args = filters.length > 0
      ? [
          '-y',
          '-i', sourcePath,
          ...(filters.length > 0 ? ['-vf', filters.join(',')] : []),
          '-ss', String(segment.start_s),
          '-t', String(duration),
          '-map', '0:v:0?',
          '-map', '0:a:0?',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '23',
          '-c:a', 'aac',
          '-movflags', '+faststart',
          outputPath,
        ]
      : [
          '-y',
          '-ss', String(segment.start_s),
          '-t', String(duration),
          '-i', sourcePath,
          '-map', '0:v:0?',
          '-map', '0:a:0?',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '23',
          '-c:a', 'aac',
          '-movflags', '+faststart',
          outputPath,
        ]

    const result = await runCommand(FFMPEG_BIN, args, process.cwd())
    if (result.code !== 0) {
      throw new Error(result.stderr.slice(0, 500) || result.stdout.slice(0, 500) || 'ffmpeg a échoué sans message exploitable')
    }

    await upsertViralShortExport(viralId, {
      ...baseEntry,
      status: 'completed',
      outputFilePath: outputPath,
      updatedAt: new Date().toISOString(),
      subtitleStyle: burnSubtitles ? subtitleStyle : undefined,
      error: null,
    })
  } catch (error) {
    await upsertViralShortExport(viralId, {
      ...baseEntry,
      status: 'error',
      outputFilePath: null,
      updatedAt: new Date().toISOString(),
      error: (error as Error).message,
    })
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; segmentIndex: string }> },
) {
  const { id, segmentIndex } = await params
  const parsedIndex = Number(segmentIndex)
  const entry = await getViralShortExport(id, parsedIndex)

  if (!entry) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Aucun export court pour ce segment' } },
      { status: 404 },
    )
  }

  const { searchParams } = new URL(request.url)
  if (searchParams.get('asset') === '1') {
    if (!entry.outputFilePath || !existsSync(entry.outputFilePath)) {
      return NextResponse.json(
        { error: { code: 'NOT_READY', message: 'Le short n’est pas encore disponible' } },
        { status: 404 },
      )
    }

    const file = await readFile(entry.outputFilePath)
    const fileStats = await stat(entry.outputFilePath)
    const fileSize = fileStats.size
    const rangeHeader = request.headers.get('range')
    const commonHeaders = {
      'Content-Type': 'video/mp4',
      'Cache-Control': 'no-store',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': 'inline',
    }

    if (rangeHeader) {
      const parsedRange = parseByteRange(rangeHeader, fileSize)
      if (!parsedRange) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            ...commonHeaders,
            'Content-Range': `bytes */${fileSize}`,
          },
        })
      }

      const chunk = file.subarray(parsedRange.start, parsedRange.end + 1)
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          ...commonHeaders,
          'Content-Length': String(chunk.byteLength),
          'Content-Range': `bytes ${parsedRange.start}-${parsedRange.end}/${fileSize}`,
        },
      })
    }

    return new NextResponse(file, {
      headers: {
        ...commonHeaders,
        'Content-Length': String(fileSize),
      },
    })
  }

  return NextResponse.json({ data: entry })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; segmentIndex: string }> },
) {
  const { id, segmentIndex } = await params
  const parsedIndex = Number(segmentIndex)
  const body = await request.json().catch(() => null) as { crop916?: boolean; burnSubtitles?: boolean; subtitleStyle?: ViralSubtitleStyle } | null
  const crop916 = body?.crop916 ?? false
  const burnSubtitles = body?.burnSubtitles ?? false
  const subtitleStyle = sanitizeSubtitleStyle(body?.subtitleStyle)

  if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'segmentIndex invalide' } },
      { status: 400 },
    )
  }

  const viralDir = join(process.cwd(), 'storage', 'viral', id)
  const segmentsPath = join(viralDir, 'segments.json')
  if (!existsSync(segmentsPath)) {
    return NextResponse.json(
      { error: { code: 'NO_SEGMENTS', message: 'Segments introuvables pour cette session virale' } },
      { status: 404 },
    )
  }

  const raw = JSON.parse(await readFile(segmentsPath, 'utf-8')) as { segments?: ViralSegment[] }
  const segment = raw.segments?.find((item) => item.index === parsedIndex) ?? raw.segments?.[parsedIndex]
  if (!segment) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Segment introuvable' } },
      { status: 404 },
    )
  }

  const manifestPath = join(viralDir, 'viral-manifest.json')
  let sourceUrl: string | null = null
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as ViralManifest
      sourceUrl = manifest.url
    } catch {
      sourceUrl = null
    }
  }

  const entry: ViralShortExport = {
    segmentIndex: segment.index,
    title: segment.title,
    start_s: segment.start_s,
    end_s: Math.min(segment.end_s, segment.start_s + 60),
    crop916,
    burnSubtitles,
    subtitleStyle: burnSubtitles ? subtitleStyle : undefined,
    status: 'queued',
    outputFilePath: null,
    sourceUrl,
    subtitlesAvailable: !!(await findCaptionFile(viralDir)),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: null,
  }

  await upsertViralShortExport(id, entry)

  void processShortExport({
    viralId: id,
    segment,
    title: segment.title,
    sourceUrl,
    crop916,
    burnSubtitles,
    subtitleStyle,
  })

  return NextResponse.json({
    data: {
      segmentIndex: segment.index,
      status: 'queued',
      crop916,
      burnSubtitles,
      subtitleStyle: burnSubtitles ? subtitleStyle : undefined,
    },
  }, { status: 202 })
}