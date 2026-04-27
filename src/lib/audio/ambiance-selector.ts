import type { AmbianceAsset, AmbianceMood } from '@/types/audio'

// Correspondances mots-clés → AmbianceMood
const MOOD_KEYWORDS: Record<AmbianceMood, string[]> = {
  tension: ['tension', 'angoisse', 'peur', 'stress', 'anxieux', 'dramatique', 'sombre', 'urgent', 'noir'],
  calme: ['calme', 'serein', 'doux', 'paisible', 'reposant', 'tranquille', 'apaisé', 'zen'],
  nature: ['forêt', 'nature', 'vent', 'oiseaux', 'eau', 'rivière', 'pluie', 'campagne', 'arbres'],
  urban: ['ville', 'urbain', 'bruit', 'circulation', 'trafic', 'métro', 'rue', 'foule'],
  neutre: ['neutre', 'discret', 'fond', 'background'],
}

function resolveAmbianceMood(hint: string): AmbianceMood {
  const lower = hint.toLowerCase()
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS) as [AmbianceMood, string[]][]) {
    if (keywords.some((kw) => lower.includes(kw))) return mood
  }
  return 'neutre'
}

/**
 * V2 — sélectionne l'ambiance par correspondance de mood.
 *
 * Si moodHint est fourni, les assets du mood correspondant sont prioritaires.
 * Parmi les assets de même mood, préfère la durée la plus longue (plus de contenu pour le loop).
 * Fallback : mood 'neutre' → premier asset disponible.
 * Sans moodHint : retourne assets[0] (compatibilité V1).
 */
export function selectAmbianceForScene(
  assets: AmbianceAsset[],
  moodHint?: string,
): AmbianceAsset | null {
  if (assets.length === 0) return null
  if (!moodHint) return assets[0]

  const targetMood = resolveAmbianceMood(moodHint)

  // Priorité 1 : mood exact, durée décroissante
  const matching = assets
    .filter((a) => a.mood === targetMood)
    .sort((a, b) => b.durationS - a.durationS)
  if (matching.length > 0) return matching[0]

  // Priorité 2 : fallback 'neutre'
  const neutre = assets
    .filter((a) => a.mood === 'neutre')
    .sort((a, b) => b.durationS - a.durationS)
  if (neutre.length > 0) return neutre[0]

  // Priorité 3 : premier disponible
  return assets[0]
}
