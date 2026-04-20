/**
 * 11D — Stock + hybridation
 *
 * Types partagés pour le module stock : asset injecté dans un run, manifest de provenance.
 */

/** Un asset stock injecté dans une scène d'un run. */
export type StockAsset = {
  /** Index de scène ciblée (0-based). */
  sceneIndex: number
  /** Fournisseur : 'pexels' | 'pixabay' | tout futur provider stock. */
  source: string
  /** Identifiant de l'asset chez le fournisseur. */
  assetId: string
  /** Type de média. */
  assetType: 'image' | 'video'
  /** URL source utilisée pour le téléchargement. */
  url: string
  /** URL de miniature (optionnelle). */
  thumbnailUrl?: string
  /** Titre / description fourni par le provider (optionnel). */
  title?: string
  /** Chemin absolu du fichier téléchargé dans le répertoire du run. */
  downloadPath: string
  /** ISO timestamp de l'injection. */
  usedAt: string
}

/** Manifest de provenance stock pour un run (traçabilité hybridation). */
export type StockManifest = {
  /** Identifiant du run. */
  runId: string
  /** Version du format manifest. */
  version: 1
  /** Assets stock injectés dans le run. */
  assets: StockAsset[]
  /** ISO timestamp de création du manifest. */
  generatedAt: string
}

/** Résultat renvoyé par POST /api/runs/[id]/use-stock. */
export type UseStockResult = {
  runId: string
  sceneIndex: number
  source: string
  assetId: string
  assetType: 'image' | 'video'
  downloadPath: string
  url: string
}
