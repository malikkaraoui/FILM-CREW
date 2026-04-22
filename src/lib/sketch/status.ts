import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { SketchExecutionScope, SketchSessionStatus, SketchSessionStep } from './sketch-types'

function getSketchDir(id: string): string {
  return join(process.cwd(), 'storage', 'test-sketch', id)
}

function getStatusPath(id: string): string {
  return join(getSketchDir(id), 'status.json')
}

function buildPromptExcerpt(prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim()
  if (compact.length <= 160) return compact
  return `${compact.slice(0, 157)}...`
}

export async function createSketchStatus(
  id: string,
  prompt: string,
  requestedDurationSeconds: number,
): Promise<SketchSessionStatus> {
  const now = new Date().toISOString()
  const status: SketchSessionStatus = {
    id,
    promptExcerpt: buildPromptExcerpt(prompt),
    requestedDurationSeconds,
    state: 'queued',
    currentStep: 'queued',
    message: 'Session sketch créée — en attente de traitement',
    logs: [
      {
        at: now,
        step: 'queued',
        scope: 'local',
        message: 'Session sketch créée sur cette machine',
      },
    ],
    startedAt: now,
    updatedAt: now,
  }

  await persistSketchStatus(status)
  return status
}

export async function readSketchStatus(id: string): Promise<SketchSessionStatus | null> {
  try {
    return JSON.parse(await readFile(getStatusPath(id), 'utf-8')) as SketchSessionStatus
  } catch {
    return null
  }
}

export async function persistSketchStatus(status: SketchSessionStatus): Promise<void> {
  await mkdir(getSketchDir(status.id), { recursive: true })
  await writeFile(getStatusPath(status.id), JSON.stringify(status, null, 2))
}

export async function updateSketchStatus(
  id: string,
  input: {
    state?: SketchSessionStatus['state']
    currentStep: SketchSessionStep
    message: string
    scope: SketchExecutionScope
    details?: string
    providerUsed?: string
    providerMode?: SketchExecutionScope
    outputFilePath?: string
    error?: string
    completedAt?: string
  },
): Promise<SketchSessionStatus> {
  const previous = await readSketchStatus(id)
  const now = new Date().toISOString()

  const status: SketchSessionStatus = {
    id,
    promptExcerpt: previous?.promptExcerpt ?? '',
    requestedDurationSeconds: previous?.requestedDurationSeconds ?? 5,
    state: input.state ?? previous?.state ?? 'running',
    currentStep: input.currentStep,
    message: input.message,
    logs: [
      ...(previous?.logs ?? []),
      {
        at: now,
        step: input.currentStep,
        scope: input.scope,
        message: input.message,
        details: input.details,
      },
    ],
    startedAt: previous?.startedAt ?? now,
    updatedAt: now,
    providerUsed: input.providerUsed ?? previous?.providerUsed,
    providerMode: input.providerMode ?? previous?.providerMode,
    outputFilePath: input.outputFilePath ?? previous?.outputFilePath,
    completedAt: input.completedAt ?? previous?.completedAt,
    error: input.error ?? previous?.error,
  }

  await persistSketchStatus(status)
  return status
}