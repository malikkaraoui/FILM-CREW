/**
 * Types partagés — Module viral réel (Lot 11C)
 *
 * Source longue → segments courts → run depuis segment
 */

/** Un segment court extrait d'une source longue */
export type ViralSegment = {
  index: number
  start_s: number
  end_s: number
  title: string
  reason: string
  excerpt?: string
}

/** Manifest traçable de la session virale (analogue à publish-manifest.json) */
export type ViralManifest = {
  id: string
  version: 1
  url: string
  sourceDownloaded: boolean
  sourceSizeBytes?: number
  segmentsCount: number
  runsCreated: string[]
  generatedAt: string
}

/** Résultat de la création d'un run depuis un segment */
export type CreateRunFromSegmentResult = {
  runId: string
  viralId: string
  segmentIndex: number
  idea: string
  chainId: string
  createdAt: string
}
