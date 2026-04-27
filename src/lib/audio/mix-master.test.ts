import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import {
  computeTimeline,
  assembleMaster,
  buildConcatArgs,
  buildLoudnormArgs,
  parseLoudnormStats,
} from './mix-master'
import type { SceneMixInput } from './mix-master'

// ─── Mock fs/promises ───

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  copyFile: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
}))

import { mkdir, copyFile, writeFile, rename } from 'fs/promises'
const mockMkdir = vi.mocked(mkdir)
const mockCopyFile = vi.mocked(copyFile)
const mockWriteFile = vi.mocked(writeFile)
const mockRename = vi.mocked(rename)

// ─── Mock child_process.spawn ───

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

import { spawn } from 'child_process'
const mockSpawn = vi.mocked(spawn)

function createMockProcess(exitCode: number, stderrData = '') {
  const proc = new EventEmitter() as EventEmitter & {
    stdin: EventEmitter
    stdout: EventEmitter
    stderr: EventEmitter
  }
  proc.stdin = new EventEmitter()
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()

  queueMicrotask(() => {
    if (stderrData) {
      proc.stderr.emit('data', Buffer.from(stderrData))
    }
    proc.emit('close', exitCode)
  })

  return proc
}

// Sortie loudnorm typique de FFmpeg pass 1
const LOUDNORM_STDERR = `
[Parsed_loudnorm_0 @ 0x...]
{
	"input_i" : "-18.34",
	"input_tp" : "-3.21",
	"input_lra" : "8.50",
	"input_thresh" : "-29.12",
	"output_i" : "-14.00",
	"output_tp" : "-1.00",
	"output_lra" : "7.20",
	"output_thresh" : "-24.50",
	"normalization_type" : "dynamic",
	"target_offset" : "0.00"
}
`

// ─── Helpers ───

function makeScene(overrides: Partial<SceneMixInput> & { sceneIndex: number; durationS: number }): SceneMixInput {
  return {
    ttsFilePath: `/tmp/scene${overrides.sceneIndex}/tts.wav`,
    mixFilePath: `/tmp/scene${overrides.sceneIndex}/mix.wav`,
    ttsProvider: 'elevenlabs',
    costEur: 0.05,
    ...overrides,
  }
}

// ─── Tests ───

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── computeTimeline ───

describe('computeTimeline', () => {
  it('3 scènes sans crossfade — offsets cumulés corrects', () => {
    const scenes: SceneMixInput[] = [
      makeScene({ sceneIndex: 0, durationS: 5 }),
      makeScene({ sceneIndex: 1, durationS: 8 }),
      makeScene({ sceneIndex: 2, durationS: 3 }),
    ]

    const timeline = computeTimeline(scenes, 0)

    expect(timeline).toHaveLength(3)
    expect(timeline[0].startS).toBe(0)
    expect(timeline[0].endS).toBe(5)
    expect(timeline[1].startS).toBe(5)
    expect(timeline[1].endS).toBe(13)
    expect(timeline[2].startS).toBe(13)
    expect(timeline[2].endS).toBe(16)
  })

  it('3 scènes avec crossfade 0.5s — overlap réduit les gaps', () => {
    const scenes: SceneMixInput[] = [
      makeScene({ sceneIndex: 0, durationS: 5 }),
      makeScene({ sceneIndex: 1, durationS: 8 }),
      makeScene({ sceneIndex: 2, durationS: 3 }),
    ]

    const timeline = computeTimeline(scenes, 0.5)

    expect(timeline).toHaveLength(3)
    expect(timeline[0].startS).toBe(0)
    expect(timeline[0].endS).toBe(5)
    // Scene 1 démarre 0.5s avant la fin de scene 0
    expect(timeline[1].startS).toBe(4.5)
    expect(timeline[1].endS).toBe(12.5)
    // Scene 2 démarre 0.5s avant la fin de scene 1
    expect(timeline[2].startS).toBe(12)
    expect(timeline[2].endS).toBe(15)
  })

  it('1 scène — startS=0, endS=durationS (pas de crossfade possible)', () => {
    const scenes: SceneMixInput[] = [
      makeScene({ sceneIndex: 0, durationS: 12.5 }),
    ]

    const timeline = computeTimeline(scenes, 0.5)

    expect(timeline).toHaveLength(1)
    expect(timeline[0].startS).toBe(0)
    expect(timeline[0].endS).toBe(12.5)
  })

  it('scènes non triées — résultat trié par sceneIndex', () => {
    const scenes: SceneMixInput[] = [
      makeScene({ sceneIndex: 2, durationS: 4 }),
      makeScene({ sceneIndex: 0, durationS: 6 }),
      makeScene({ sceneIndex: 1, durationS: 3 }),
    ]

    const timeline = computeTimeline(scenes)

    expect(timeline[0].sceneIndex).toBe(0)
    expect(timeline[1].sceneIndex).toBe(1)
    expect(timeline[2].sceneIndex).toBe(2)
  })

  it('crossfade par défaut = 0 — rétrocompatible V1', () => {
    const scenes: SceneMixInput[] = [
      makeScene({ sceneIndex: 0, durationS: 5 }),
      makeScene({ sceneIndex: 1, durationS: 8 }),
    ]

    const timeline = computeTimeline(scenes)

    expect(timeline[0].startS).toBe(0)
    expect(timeline[0].endS).toBe(5)
    expect(timeline[1].startS).toBe(5)
    expect(timeline[1].endS).toBe(13)
  })
})

// ─── buildConcatArgs ───

describe('buildConcatArgs', () => {
  it('crossfade = 0 → concat classique', () => {
    const args = buildConcatArgs(['/a.wav', '/b.wav'], '/out.wav', 0)
    const filterIdx = args.indexOf('-filter_complex')
    expect(args[filterIdx + 1]).toContain('concat=n=2')
    expect(args[filterIdx + 1]).not.toContain('acrossfade')
  })

  it('crossfade > 0 → chaîne acrossfade', () => {
    const args = buildConcatArgs(['/a.wav', '/b.wav', '/c.wav'], '/out.wav', 0.5)
    const filterIdx = args.indexOf('-filter_complex')
    const filter = args[filterIdx + 1]
    expect(filter).toContain('acrossfade=d=0.5:c1=tri:c2=tri')
    expect(filter).not.toContain('concat=')
  })

  it('2 fichiers + crossfade → 1 acrossfade', () => {
    const args = buildConcatArgs(['/a.wav', '/b.wav'], '/out.wav', 0.3)
    const filterIdx = args.indexOf('-filter_complex')
    const filter = args[filterIdx + 1]
    // Une seule acrossfade, sortie directe en [out]
    expect(filter).toBe('[0:a][1:a]acrossfade=d=0.3:c1=tri:c2=tri[out]')
  })

  it('3 fichiers + crossfade → 2 acrossfade chainées', () => {
    const args = buildConcatArgs(['/a.wav', '/b.wav', '/c.wav'], '/out.wav', 0.5)
    const filterIdx = args.indexOf('-filter_complex')
    const filter = args[filterIdx + 1]
    expect(filter).toContain('[xf0]')
    expect(filter).toContain('[out]')
    expect(filter.split('acrossfade').length - 1).toBe(2)
  })

  it('1 fichier + crossfade → concat simple (pas de crossfade possible)', () => {
    const args = buildConcatArgs(['/a.wav'], '/out.wav', 0.5)
    const filterIdx = args.indexOf('-filter_complex')
    expect(args[filterIdx + 1]).toContain('concat=n=1')
  })

  it('contient toujours -ar 44100 -ac 2 -y', () => {
    const args = buildConcatArgs(['/a.wav', '/b.wav'], '/out.wav', 0.5)
    expect(args).toContain('-ar')
    expect(args).toContain('44100')
    expect(args).toContain('-ac')
    expect(args).toContain('2')
    expect(args).toContain('-y')
  })
})

// ─── parseLoudnormStats ───

describe('parseLoudnormStats', () => {
  it('parse les stats loudnorm correctement', () => {
    const stats = parseLoudnormStats(LOUDNORM_STDERR)
    expect(stats).not.toBeNull()
    expect(stats!.input_i).toBe(-18.34)
    expect(stats!.input_tp).toBe(-3.21)
    expect(stats!.input_lra).toBe(8.50)
    expect(stats!.input_thresh).toBe(-29.12)
  })

  it('retourne null si pas de données loudnorm', () => {
    expect(parseLoudnormStats('random output')).toBeNull()
  })

  it('retourne null si données incomplètes', () => {
    expect(parseLoudnormStats('"input_i" : "-18.34"')).toBeNull()
  })
})

// ─── buildLoudnormArgs ───

describe('buildLoudnormArgs', () => {
  it('construit les args pass 2 correctement', () => {
    const args = buildLoudnormArgs('/in.wav', '/out.wav', -14, -18.34, -3.21, 8.50, -29.12)
    expect(args).toContain('-i')
    expect(args).toContain('/in.wav')
    expect(args).toContain('-y')
    expect(args).toContain('/out.wav')
    const afIdx = args.indexOf('-af')
    const filter = args[afIdx + 1]
    expect(filter).toContain('loudnorm=I=-14')
    expect(filter).toContain('measured_I=-18.34')
    expect(filter).toContain('measured_TP=-3.21')
    expect(filter).toContain('linear=true')
  })
})

// ─── assembleMaster ───

describe('assembleMaster', () => {
  it('0 scènes — throw', async () => {
    await expect(
      assembleMaster({ scenes: [], outputDir: '/tmp/out', runId: 'run-1' }),
    ).rejects.toThrow('Aucune scène')
  })

  it('1 scène — copyFile + loudnorm 2-pass', async () => {
    // Pass 1 mesure + pass 2 application = 2 appels spawn
    let spawnCallCount = 0
    mockSpawn.mockImplementation(() => {
      spawnCallCount++
      if (spawnCallCount === 1) {
        // Pass 1 : mesure loudnorm
        return createMockProcess(0, LOUDNORM_STDERR) as ReturnType<typeof spawn>
      }
      // Pass 2 : application
      return createMockProcess(0) as ReturnType<typeof spawn>
    })

    const scenes: SceneMixInput[] = [
      makeScene({ sceneIndex: 0, durationS: 10, costEur: 0.12 }),
    ]

    const manifest = await assembleMaster({
      scenes,
      outputDir: '/tmp/out',
      runId: 'run-single',
    })

    expect(mockCopyFile).toHaveBeenCalledOnce()
    // 2 spawn calls = loudnorm pass 1 + pass 2
    expect(mockSpawn).toHaveBeenCalledTimes(2)
    expect(mockRename).toHaveBeenCalledOnce()

    expect(manifest.totalDurationS).toBe(10)
    expect(manifest.masterFilePath).toBe('/tmp/out/master.wav')
    expect(manifest.qualityChecks.integratedLoudnessLUFS).toBe(-18.34)
    expect(manifest.qualityChecks.truePeakDBTP).toBe(-3.21)
    expect(manifest.qualityChecks.loudnessRangeLU).toBe(8.5)
  })

  it('N scènes — spawn FFmpeg concat + loudnorm + manifest', async () => {
    let spawnCallCount = 0
    mockSpawn.mockImplementation(() => {
      spawnCallCount++
      if (spawnCallCount === 2) {
        // Deuxième spawn = loudnorm pass 1
        return createMockProcess(0, LOUDNORM_STDERR) as ReturnType<typeof spawn>
      }
      return createMockProcess(0) as ReturnType<typeof spawn>
    })

    const scenes: SceneMixInput[] = [
      makeScene({ sceneIndex: 0, durationS: 5, costEur: 0.10 }),
      makeScene({ sceneIndex: 1, durationS: 8, costEur: 0.15 }),
      makeScene({ sceneIndex: 2, durationS: 3, costEur: 0.05 }),
    ]

    const manifest = await assembleMaster({
      scenes,
      outputDir: '/tmp/master-out',
      runId: 'run-multi',
    })

    // 3 spawns : concat + loudnorm pass 1 + loudnorm pass 2
    expect(mockSpawn).toHaveBeenCalledTimes(3)
    expect(mockCopyFile).not.toHaveBeenCalled()

    // Manifest écrit
    expect(mockWriteFile).toHaveBeenCalledOnce()
    const writtenManifest = JSON.parse(mockWriteFile.mock.calls[0][1] as string)
    expect(writtenManifest.runId).toBe('run-multi')

    // Durée totale avec crossfade 0.5 * 2 transitions = 1s de moins
    expect(manifest.totalDurationS).toBe(15) // 16 - 1
    expect(manifest.qualityChecks.totalCostEur).toBeCloseTo(0.30)
    expect(manifest.qualityChecks.integratedLoudnessLUFS).toBe(-18.34)
  })

  it('options crossfade=0 + lufsTarget=null — mode V1 rétrocompatible', async () => {
    mockSpawn.mockImplementation(() => createMockProcess(0) as ReturnType<typeof spawn>)

    const scenes: SceneMixInput[] = [
      makeScene({ sceneIndex: 0, durationS: 5 }),
      makeScene({ sceneIndex: 1, durationS: 8 }),
    ]

    const manifest = await assembleMaster({
      scenes,
      outputDir: '/tmp/out',
      runId: 'run-v1',
      options: { crossfadeDurationS: 0, lufsTarget: null },
    })

    // 1 seul spawn = concat simple, pas de loudnorm
    expect(mockSpawn).toHaveBeenCalledOnce()
    expect(manifest.totalDurationS).toBe(13)
  })

  it('loudnorm skip si stats non parsables', async () => {
    let spawnCallCount = 0
    mockSpawn.mockImplementation(() => {
      spawnCallCount++
      if (spawnCallCount === 1) {
        // Concat OK
        return createMockProcess(0) as ReturnType<typeof spawn>
      }
      // Loudnorm pass 1 — stderr sans données parsables
      return createMockProcess(0, 'no loudnorm data') as ReturnType<typeof spawn>
    })

    const scenes: SceneMixInput[] = [
      makeScene({ sceneIndex: 0, durationS: 5 }),
      makeScene({ sceneIndex: 1, durationS: 8 }),
    ]

    const manifest = await assembleMaster({
      scenes,
      outputDir: '/tmp/out',
      runId: 'run-skip',
    })

    // 2 spawns : concat + loudnorm pass 1 (pass 2 skippée)
    expect(mockSpawn).toHaveBeenCalledTimes(2)
    expect(mockRename).not.toHaveBeenCalled()
    expect(manifest.totalDurationS).toBe(12.5) // 13 - 0.5 crossfade (1 transition)
  })

  it('crossfadeDurationMs est prioritaire sur crossfadeDurationS', async () => {
    mockSpawn.mockImplementation(() => createMockProcess(0) as ReturnType<typeof spawn>)

    const scenes: SceneMixInput[] = [
      makeScene({ sceneIndex: 0, durationS: 5 }),
      makeScene({ sceneIndex: 1, durationS: 8 }),
    ]

    const manifest = await assembleMaster({
      scenes,
      outputDir: '/tmp/out-ms',
      runId: 'run-ms',
      options: { crossfadeDurationS: 0, crossfadeDurationMs: 250, lufsTarget: null },
    })

    expect(manifest.totalDurationS).toBe(12.75)
  })
})
