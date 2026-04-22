import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { ViralShortExport, ViralShortExportManifest } from './viral-types'

function getViralDir(id: string): string {
  return join(process.cwd(), 'storage', 'viral', id)
}

function getShortsManifestPath(id: string): string {
  return join(getViralDir(id), 'shorts.json')
}

export async function readViralShortExports(id: string): Promise<ViralShortExport[]> {
  try {
    const raw = JSON.parse(await readFile(getShortsManifestPath(id), 'utf-8')) as ViralShortExportManifest
    return Array.isArray(raw.exports) ? raw.exports : []
  } catch {
    return []
  }
}

export async function writeViralShortExports(id: string, exportsList: ViralShortExport[]): Promise<void> {
  await mkdir(getViralDir(id), { recursive: true })
  await writeFile(getShortsManifestPath(id), JSON.stringify({ exports: exportsList }, null, 2))
}

export async function upsertViralShortExport(id: string, entry: ViralShortExport): Promise<ViralShortExport[]> {
  const exportsList = await readViralShortExports(id)
  const next = exportsList.filter((item) => item.segmentIndex !== entry.segmentIndex)
  next.push(entry)
  next.sort((a, b) => a.segmentIndex - b.segmentIndex)
  await writeViralShortExports(id, next)
  return next
}

export async function getViralShortExport(id: string, segmentIndex: number): Promise<ViralShortExport | null> {
  const exportsList = await readViralShortExports(id)
  return exportsList.find((item) => item.segmentIndex === segmentIndex) ?? null
}