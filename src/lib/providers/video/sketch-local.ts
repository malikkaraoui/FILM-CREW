import { spawn } from 'child_process'
import { access, mkdir, writeFile } from 'fs/promises'
import { constants } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { VideoProvider, VideoOpts, VideoResult, ProviderHealth } from '../types'

const FONT_CANDIDATES = [
  '/System/Library/Fonts/Supplemental/Courier New Bold.ttf',
  '/System/Library/Fonts/Monaco.ttf',
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  '/Library/Fonts/Arial.ttf',
]

export const sketchLocalProvider: VideoProvider = {
  name: 'sketch-local',
  type: 'video',

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const { stdout } = await runCommand('ffmpeg', ['-version'])
      if (stdout.includes('ffmpeg')) {
        return { status: 'free', lastCheck: new Date().toISOString() }
      }
      return { status: 'down', lastCheck: new Date().toISOString(), details: 'ffmpeg non trouvé' }
    } catch {
      return { status: 'down', lastCheck: new Date().toISOString(), details: 'ffmpeg non installé' }
    }
  },

  estimateCost(): number {
    // Gratuit — local
    return 0
  },

  async generate(prompt: string, opts: VideoOpts): Promise<VideoResult> {
    const outputDir = opts.outputDir ?? join(tmpdir(), 'sketch-local')
    await mkdir(outputDir, { recursive: true })

    const duration = opts.duration ?? 5
    const fps = 5
    const outputPath = join(outputDir, `sketch-${Date.now()}.mp4`)
    const promptPath = join(outputDir, 'prompt.txt')
    const fontPath = await resolveFontPath()

    await opts.onProgress?.({
      step: 'preparing',
      message: 'Préparation du rendu sketch',
      details: `Création du prompt local et choix d'une police système${fontPath ? '' : ' (fallback police par défaut ffmpeg)'}`,
    })

    await writeFile(promptPath, wrapPrompt(prompt))

    const fontClause = fontPath
      ? `fontfile='${escapeFilterValue(fontPath)}':`
      : ''

    const filterGraph = [
      'drawbox=x=34:y=34:w=1212:h=652:color=0xffffff@0.82:t=fill',
      'drawbox=x=58:y=58:w=1164:h=604:color=0xd9d2c3@0.28:t=2',
      `drawtext=${fontClause}textfile='${escapeFilterValue(promptPath)}':reload=0:fontcolor=0x141414:fontsize=34:line_spacing=12:x='80+18*sin(t*1.4)':y='118+10*cos(t*0.7)':box=1:boxcolor=0xffffff@0.20:boxborderw=20`,
      `drawtext=${fontClause}text='Sketch local - FILM CREW':fontcolor=0x555555:fontsize=20:x=80:y=h-60`,
      `fps=${fps}`,
    ].join(',')

    try {
      await opts.onProgress?.({
        step: 'rendering',
        message: 'Rendu du sketch en local via FFmpeg',
        details: `Animation papier ${duration}s • ${fps} fps • sortie ${outputPath}`,
      })

      const renderResult = await runCommand('ffmpeg', [
        '-hide_banner',
        '-loglevel', 'error',
        '-f', 'lavfi',
        '-i', `color=c=0xF6F1E8:s=1280x720:d=${duration}`,
        '-vf', filterGraph,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-y',
        outputPath,
      ])

      if (renderResult.code !== 0) {
        throw new Error(renderResult.stderr.slice(0, 500) || renderResult.stdout.slice(0, 500) || 'ffmpeg a échoué sans message exploitable')
      }

      return {
        filePath: outputPath,
        duration,
        costEur: 0,
      }
    } catch (error) {
      throw new Error(`Sketch generation failed: ${(error as Error).message}`)
    }
  },

  async cancel(_jobId: string): Promise<void> {
    // Pas de job asynchrone à annuler localement
  },
}

async function resolveFontPath(): Promise<string | undefined> {
  for (const candidate of FONT_CANDIDATES) {
    try {
      await access(candidate, constants.R_OK)
      return candidate
    } catch {
      // continuer
    }
  }

  return undefined
}

function wrapPrompt(prompt: string, maxLineLength = 48): string {
  const clean = prompt.replace(/\s+/g, ' ').trim()
  if (!clean) return 'Prompt vide.'

  const words = clean.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word
    if (nextLine.length > maxLineLength && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = nextLine
    }
  }

  if (currentLine) lines.push(currentLine)
  return lines.slice(0, 7).join('\n')
}

function escapeFilterValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
}

function runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args)
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 1 })
    })
  })
}
