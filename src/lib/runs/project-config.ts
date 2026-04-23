import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { MeetingLlmMode, ProjectConfig } from '@/types/run'

export const DEFAULT_LOCAL_MEETING_MODEL = (process.env.OLLAMA_MODEL || 'mistral:latest').trim()
export const DEFAULT_CLOUD_MEETING_MODEL = (process.env.OLLAMA_STORYBOARD_CLOUD_MODEL || 'gemma4:31b-cloud').trim()

export function normalizeMeetingLlmMode(value: unknown): MeetingLlmMode {
  return value === 'cloud' ? 'cloud' : 'local'
}

export function buildProjectConfig(input?: Partial<ProjectConfig> | null): ProjectConfig {
  const meetingLlmMode = normalizeMeetingLlmMode(input?.meetingLlmMode)
  const configuredModel = typeof input?.meetingLlmModel === 'string' ? input.meetingLlmModel.trim() : ''
  const fallbackModel = meetingLlmMode === 'cloud'
    ? DEFAULT_CLOUD_MEETING_MODEL
    : DEFAULT_LOCAL_MEETING_MODEL

  return {
    meetingLlmMode,
    meetingLlmModel: configuredModel || fallbackModel,
  }
}

export function getProjectConfigPath(storagePath: string): string {
  return join(storagePath, 'project-config.json')
}

export async function writeProjectConfig(storagePath: string, input?: Partial<ProjectConfig> | null): Promise<ProjectConfig> {
  const config = buildProjectConfig(input)
  await writeFile(getProjectConfigPath(storagePath), JSON.stringify(config, null, 2))
  return config
}

export async function readProjectConfig(storagePath: string): Promise<ProjectConfig | null> {
  try {
    const raw = await readFile(getProjectConfigPath(storagePath), 'utf-8')
    return buildProjectConfig(JSON.parse(raw) as Partial<ProjectConfig>)
  } catch {
    return null
  }
}
