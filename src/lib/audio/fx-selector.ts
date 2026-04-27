import type { FXAsset, DialogueScene } from '@/types/audio'

// Mots-clés indiquant un besoin de FX impacts / transitions
const IMPACT_KEYWORDS = ['impact', 'choc', 'coup', 'frappe', 'explos', 'bang', 'crash', 'claque', 'bris']
const TRANSITION_KEYWORDS = ['transition', 'fondu', 'coupé', 'cut', 'enchaîn', 'bascule', 'switch', 'glisse']
const DRAMATIC_TONES = ['urgent', 'violent', 'intense', 'dramatique', 'choqué', 'agressif']

function hasKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}

/**
 * V2 — sélection FX combinant règles positionnelles et analyse sémantique.
 *
 * Règles positionnelles (V1) :
 *   - Première scène → catégorie 'transitions'
 *   - Dernière scène  → catégorie 'impacts'
 *
 * Règles sémantiques (V2) :
 *   - scene.stageDirections contient mots-clés impact  → catégorie 'impacts'
 *   - scene.stageDirections contient mots-clés transition → catégorie 'transitions'
 *   - Au moins une ligne avec tone dramatique → catégorie 'impacts'
 *
 * Déduplication : max 1 asset retenu par catégorie (premier dans la liste).
 */
export function selectFXForScene(
  scene: DialogueScene,
  assets: FXAsset[],
  isFirst: boolean,
  isLast: boolean,
): FXAsset[] {
  if (assets.length === 0) return []

  const categoriesWanted = new Set<string>()

  // Règles positionnelles
  if (isFirst) categoriesWanted.add('transitions')
  if (isLast) categoriesWanted.add('impacts')

  // Règles sémantiques — stageDirections
  if (scene.stageDirections) {
    if (hasKeyword(scene.stageDirections, IMPACT_KEYWORDS)) categoriesWanted.add('impacts')
    if (hasKeyword(scene.stageDirections, TRANSITION_KEYWORDS)) categoriesWanted.add('transitions')
  }

  // Règles sémantiques — tonalité dramatique des lignes
  const hasDramaticTone = scene.lines.some((l) => hasKeyword(l.tone, DRAMATIC_TONES))
  if (hasDramaticTone) categoriesWanted.add('impacts')

  // Un asset par catégorie voulue (premier match)
  const selected: FXAsset[] = []
  for (const category of categoriesWanted) {
    const fx = assets.find((a) => a.category === category)
    if (fx) selected.push(fx)
  }

  return selected
}
