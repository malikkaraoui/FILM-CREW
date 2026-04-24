import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

vi.mock('@/lib/db/queries/traces', () => ({
  deleteAgentTraces: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/db/queries/runs', () => ({
  deleteClipsForRun: vi.fn().mockResolvedValue(undefined),
  resetRunStepsFromStep: vi.fn().mockResolvedValue(undefined),
  updateRunStatus: vi.fn().mockResolvedValue(undefined),
}))

describe('resetRunFromStep', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) rmSync(dir, { recursive: true, force: true })
    }
  })

  it('supprime dialogue_script.json lors d’un reset depuis le step 3', async () => {
    const storagePath = mkdtempSync(join(tmpdir(), 'filmcrew-reset-'))
    tempDirs.push(storagePath)

    mkdirSync(join(storagePath, 'clips'), { recursive: true })
    mkdirSync(join(storagePath, 'audio'), { recursive: true })
    mkdirSync(join(storagePath, 'subtitles'), { recursive: true })
    mkdirSync(join(storagePath, 'storyboard'), { recursive: true })
    mkdirSync(join(storagePath, 'final'), { recursive: true })

    writeFileSync(join(storagePath, 'structure.json'), '{}')
    writeFileSync(join(storagePath, 'structure-raw.txt'), 'raw')
    writeFileSync(join(storagePath, 'director-plan.json'), '{}')
    writeFileSync(join(storagePath, 'dialogue_script.json'), '{}')

    const { resetRunFromStep } = await import('../reset')

    await resetRunFromStep({
      runId: 'run-reset-test',
      storagePath,
      stepNumber: 3,
    })

    expect(existsSync(join(storagePath, 'dialogue_script.json'))).toBe(false)
    expect(existsSync(join(storagePath, 'clips'))).toBe(true)
    expect(existsSync(join(storagePath, 'audio'))).toBe(true)
    expect(existsSync(join(storagePath, 'subtitles'))).toBe(true)
  })
})
