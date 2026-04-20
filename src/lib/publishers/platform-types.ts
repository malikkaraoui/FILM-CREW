/**
 * Types partagés — publication multi-plateforme (Lot 11B)
 *
 * Source unique pour PublishPlatform, PublishStatus et les types de manifest.
 * Chaque publisher importe ces types plutôt que de les dupliquer.
 */

/** Plateformes supportées par le publisher factory */
export type PublishPlatform = 'tiktok' | 'youtube_shorts'

/** Statuts de publication possibles */
export type PublishStatus =
  | 'SUCCESS'
  | 'PROCESSING'
  | 'FAILED'
  | 'NO_CREDENTIALS'
  | 'NO_MEDIA'

/**
 * Entrée traçable du publish-manifest.json par plateforme.
 * Chaque plateforme a sa propre entrée dans le manifest.
 */
export type PublishManifestEntry = {
  platform: PublishPlatform
  status: PublishStatus
  publishId?: string
  videoId?: string
  shareUrl?: string
  profileUrl?: string
  error?: string
  instructions?: string
  publishedAt?: string
  mediaSizeBytes?: number
}

/**
 * Manifest traçable de toutes les publications d'un run.
 * Persisté dans storage/runs/{runId}/publish-manifest.json.
 * Additivité : chaque appel à POST /publish met à jour l'entrée pour la plateforme concernée,
 * sans écraser les autres.
 */
export type PublishManifest = {
  runId: string
  version: 1
  title: string
  hashtags: string[]
  platforms: PublishManifestEntry[]
  generatedAt: string
}
