// ─── Mix Master — Assemblage WAV master + manifest ───
// V2 : crossfade inter-scènes + normalisation LUFS

import { spawn } from 'child_process'
import { mkdir, copyFile, writeFile, rename } from 'fs/promises'
import { join } from 'path'
import type { SceneAudioRenderStatus, AudioMasterManifest } from '@/types/audio'

// ─── Types ───

export type SceneMixInput = {
  sceneIndex: number
  durationS: number
  ttsFilePath: string
  mixFilePath: string
  ttsProvider: string
  costEur: number
}

export type MasterAssemblyOptions = {
  crossfadeDurationS?: number  // durée crossfade entre scènes en secondes
  crossfadeDurationMs?: number // durée crossfade entre scènes en millisecondes (prioritaire)
  lufsTarget?: number | null   // cible LUFS (défaut -14, null = pas de normalisation)
}

type ResolvedAssemblyOptions = {
  crossfadeDurationS: number
  lufsTarget: number | null
}

export const DEFAULT_ASSEMBLY_OPTIONS: ResolvedAssemblyOptions = {
  crossfadeDurationS: 0.5,
  lufsTarget: -14,
}

// ─── FFmpeg binary ───

const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg'

export type LoudnormStats = {
  input_i: number
  input_tp: number
  input_lra: number
  input_thresh: number
}

function resolveAssemblyOptions(options?: MasterAssemblyOptions): ResolvedAssemblyOptions {
  const crossfadeDurationS = options?.crossfadeDurationMs !== undefined
    ? Math.max(0, options.crossfadeDurationMs / 1000)
    : Math.max(0, options?.crossfadeDurationS ?? DEFAULT_ASSEMBLY_OPTIONS.crossfadeDurationS)

  return {
    crossfadeDurationS,
    lufsTarget: options?.lufsTarget !== undefined
      ? options.lufsTarget
      : DEFAULT_ASSEMBLY_OPTIONS.lufsTarget,
  }
}

// ─── computeTimeline ───

/**
 * Calcule les offsets cumulés des scènes, en tenant compte du crossfade.
 * Avec crossfade > 0 : les scènes se chevauchent, la durée totale diminue.
 */
export function computeTimeline(
  scenes: SceneMixInput[],
  crossfadeDurationS = 0,
): SceneAudioRenderStatus[] {
  const sorted = [...scenes].sort((a, b) => a.sceneIndex - b.sceneIndex)

  let cursor = 0
  return sorted.map((scene, i) => {
    const startS = cursor
    const endS = cursor + scene.durationS
    // Chaque transition sauf la dernière scène réduit le curseur
    cursor = endS - (i < sorted.length - 1 ? crossfadeDurationS : 0)

    return {
      sceneIndex: scene.sceneIndex,
      startS,
      endS,
      durationS: scene.durationS,
      ttsFilePath: scene.ttsFilePath,
      mixFilePath: scene.mixFilePath,
      status: 'assembled' as const,
      ttsProvider: scene.ttsProvider,
      costEur: scene.costEur,
    }
  })
}

// ─── FFmpeg helpers ───

function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args)

    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) resolve(stderr)
      else reject(new Error(`FFmpeg échoué (code ${code}): ${stderr}`))
    })

    proc.on('error', (err) => {
      reject(new Error(`FFmpeg spawn échoué: ${err.message}`))
    })
  })
}

/**
 * Construit la commande FFmpeg pour concat simple ou crossfade.
 * Exportée pour les tests unitaires.
 */
export function buildConcatArgs(
  inputPaths: string[],
  outputPath: string,
  crossfadeDurationS: number,
): string[] {
  const inputs = inputPaths.flatMap((p) => ['-i', p])

  if (crossfadeDurationS <= 0 || inputPaths.length < 2) {
    // Concat simple (V1)
    const filterInputs = inputPaths.map((_, i) => `[${i}:a]`).join('')
    const filterComplex = `${filterInputs}concat=n=${inputPaths.length}:v=0:a=1[out]`
    return [...inputs, '-filter_complex', filterComplex, '-map', '[out]', '-ar', '44100', '-ac', '2', '-y', outputPath]
  }

  // Crossfade : chaîne de acrossfade entre paires adjacentes
  // [0:a][1:a] acrossfade=d=0.5:c1=tri:c2=tri [xf0]
  // [xf0][2:a] acrossfade=d=0.5:c1=tri:c2=tri [xf1]
  // ...
  const d = crossfadeDurationS
  const filterParts: string[] = []
  let lastLabel = '[0:a]'

  for (let i = 1; i < inputPaths.length; i++) {
    const outLabel = i < inputPaths.length - 1 ? `[xf${i - 1}]` : '[out]'
    filterParts.push(`${lastLabel}[${i}:a]acrossfade=d=${d}:c1=tri:c2=tri${outLabel}`)
    lastLabel = outLabel
  }

  const filterComplex = filterParts.join(';')
  return [...inputs, '-filter_complex', filterComplex, '-map', '[out]', '-ar', '44100', '-ac', '2', '-y', outputPath]
}

/**
 * Construit les arguments FFmpeg pour la normalisation LUFS 2-pass.
 * Pass 1 : mesure → Pass 2 : application.
 * Exportée pour les tests unitaires.
 */
export function buildLoudnormArgs(
  inputPath: string,
  outputPath: string,
  lufsTarget: number,
  measuredI: number,
  measuredTP: number,
  measuredLRA: number,
  measuredThresh: number,
): string[] {
  return [
    '-i', inputPath,
    '-af', `loudnorm=I=${lufsTarget}:TP=-1:LRA=11:measured_I=${measuredI}:measured_TP=${measuredTP}:measured_LRA=${measuredLRA}:measured_thresh=${measuredThresh}:linear=true`,
    '-ar', '44100',
    '-ac', '2',
    '-y', outputPath,
  ]
}

/**
 * Parse les stats loudnorm depuis la sortie stderr de FFmpeg pass 1.
 */
export function parseLoudnormStats(stderr: string): LoudnormStats | null {
  // FFmpeg loudnorm outputs JSON-like block in stderr
  const match = stderr.match(/"input_i"\s*:\s*"([^"]+)"/)
  const matchTP = stderr.match(/"input_tp"\s*:\s*"([^"]+)"/)
  const matchLRA = stderr.match(/"input_lra"\s*:\s*"([^"]+)"/)
  const matchThresh = stderr.match(/"input_thresh"\s*:\s*"([^"]+)"/)

  if (!match || !matchTP || !matchLRA || !matchThresh) return null

  return {
    input_i: parseFloat(match[1]),
    input_tp: parseFloat(matchTP[1]),
    input_lra: parseFloat(matchLRA[1]),
    input_thresh: parseFloat(matchThresh[1]),
  }
}

/**
 * Applique la normalisation LUFS 2-pass sur un fichier audio.
 */
async function applyLoudnorm(filePath: string, lufsTarget: number): Promise<LoudnormStats | null> {
  // Pass 1 : mesure
  const measureArgs = [
    '-i', filePath,
    '-af', `loudnorm=I=${lufsTarget}:TP=-1:LRA=11:print_format=json`,
    '-f', 'null', '/dev/null',
  ]

  const measureStderr = await runFfmpeg(measureArgs)
  const stats = parseLoudnormStats(measureStderr)

  if (!stats) {
    // Si on ne peut pas parser les stats, on skip la normalisation
    return null
  }

  // Pass 2 : application
  const normalizedPath = filePath.replace(/\.wav$/, '.loudnorm.wav')
  const pass2Args = buildLoudnormArgs(
    filePath,
    normalizedPath,
    lufsTarget,
    stats.input_i,
    stats.input_tp,
    stats.input_lra,
    stats.input_thresh,
  )

  await runFfmpeg(pass2Args)
  await rename(normalizedPath, filePath)

  return stats
}

// ─── assembleMaster ───

/**
 * Assemble les WAV mixés en un seul master.wav.
 * V2 : crossfade inter-scènes + normalisation LUFS -14.
 */
export async function assembleMaster(params: {
  scenes: SceneMixInput[]
  outputDir: string
  runId: string
  options?: MasterAssemblyOptions
}): Promise<AudioMasterManifest> {
  const { scenes, outputDir, runId } = params
  const opts = resolveAssemblyOptions(params.options)

  if (scenes.length === 0) {
    throw new Error('Aucune scène audio à assembler')
  }

  const crossfadeS = scenes.length > 1 ? opts.crossfadeDurationS : 0
  const timeline = computeTimeline(scenes, crossfadeS)
  const masterPath = join(outputDir, 'master.wav')

  await mkdir(outputDir, { recursive: true })

  if (scenes.length === 1) {
    const sorted = [...scenes].sort((a, b) => a.sceneIndex - b.sceneIndex)
    await copyFile(sorted[0].mixFilePath, masterPath)
  } else {
    const sortedPaths = timeline.map((s) => s.mixFilePath)
    const args = buildConcatArgs(sortedPaths, masterPath, crossfadeS)
    await runFfmpeg(args)
  }

  // Normalisation LUFS
  const loudnormStats = opts.lufsTarget !== null
    ? await applyLoudnorm(masterPath, opts.lufsTarget)
    : null

  const totalDurationS = timeline[timeline.length - 1]?.endS ?? 0
  const totalCostEur = timeline.reduce((sum, s) => sum + s.costEur, 0)

  const manifest: AudioMasterManifest = {
    version: '1.0',
    runId,
    totalDurationS,
    sampleRate: 44100,
    channels: 2,
    masterFilePath: masterPath,
    scenes: timeline,
    qualityChecks: {
      allScenesRendered: true,
      totalCostEur,
      ...(loudnormStats
        ? {
            integratedLoudnessLUFS: loudnormStats.input_i,
            truePeakDBTP: loudnormStats.input_tp,
            loudnessRangeLU: loudnormStats.input_lra,
          }
        : {}),
    },
    generatedAt: new Date().toISOString(),
  }

  const manifestPath = join(outputDir, 'audio-master-manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

  return manifest
}
