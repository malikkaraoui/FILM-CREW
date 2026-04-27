import { describe, it, expect } from 'vitest'
import { selectAmbianceForScene } from './ambiance-selector'
import type { AmbianceAsset, AmbianceMood } from '@/types/audio'

function makeAsset(id: string, mood: AmbianceMood = 'nature', durationS = 60): AmbianceAsset {
  return {
    id,
    filename: `${id}.wav`,
    filePath: `/assets/ambiance/${id}.wav`,
    description: 'test',
    mood,
    durationS,
    loopable: true,
    tags: [],
  }
}

// ─── Tests sans moodHint (compatibilité V1) ───

describe('selectAmbianceForScene — sans moodHint', () => {
  it('retourne null si assets vide', () => {
    expect(selectAmbianceForScene([])).toBeNull()
  })

  it('retourne assets[0] si un seul asset', () => {
    const a = makeAsset('ambiance-001')
    expect(selectAmbianceForScene([a])).toBe(a)
  })

  it('retourne assets[0] si plusieurs assets (ordre préservé)', () => {
    const a = makeAsset('ambiance-001')
    const b = makeAsset('ambiance-002')
    expect(selectAmbianceForScene([a, b])).toBe(a)
  })
})

// ─── Tests avec moodHint ───

describe('selectAmbianceForScene — avec moodHint', () => {
  it('retourne null si assets vide même avec hint', () => {
    expect(selectAmbianceForScene([], 'tension')).toBeNull()
  })

  it('sélectionne le mood exact correspondant au hint', () => {
    const calme = makeAsset('calme-001', 'calme')
    const tension = makeAsset('tension-001', 'tension')
    const result = selectAmbianceForScene([calme, tension], 'tension')
    expect(result?.mood).toBe('tension')
    expect(result?.id).toBe('tension-001')
  })

  it('parmi plusieurs assets du même mood, préfère la durée la plus longue', () => {
    const short = makeAsset('tension-court', 'tension', 30)
    const long = makeAsset('tension-long', 'tension', 120)
    const result = selectAmbianceForScene([short, long], 'tension')
    expect(result?.id).toBe('tension-long')
  })

  it('fallback vers neutre si aucun asset du mood ciblé', () => {
    const nature = makeAsset('nature-001', 'nature')
    const neutre = makeAsset('neutre-001', 'neutre', 90)
    const result = selectAmbianceForScene([nature, neutre], 'tension')
    expect(result?.mood).toBe('neutre')
  })

  it('fallback vers premier disponible si aucun asset neutre ni mood ciblé', () => {
    const nature = makeAsset('nature-001', 'nature')
    const urban = makeAsset('urban-001', 'urban')
    const result = selectAmbianceForScene([nature, urban], 'tension')
    expect(result).toBe(nature)
  })

  it('résout "peur" comme mood tension', () => {
    const tension = makeAsset('tension-001', 'tension')
    const calme = makeAsset('calme-001', 'calme')
    const result = selectAmbianceForScene([calme, tension], 'peur')
    expect(result?.mood).toBe('tension')
  })

  it('résout "forêt nocturne" comme mood nature', () => {
    const nature = makeAsset('nature-001', 'nature')
    const urban = makeAsset('urban-001', 'urban')
    const result = selectAmbianceForScene([urban, nature], 'forêt nocturne')
    expect(result?.mood).toBe('nature')
  })

  it('hint sans correspondance connue → fallback neutre disponible', () => {
    const neutre = makeAsset('neutre-001', 'neutre')
    const nature = makeAsset('nature-001', 'nature')
    const result = selectAmbianceForScene([nature, neutre], 'xyzunknown')
    // "xyzunknown" résout vers 'neutre' par défaut
    expect(result?.mood).toBe('neutre')
  })

  it('hint calme → assets calmes classés par durée décroissante', () => {
    const short = makeAsset('calme-court', 'calme', 45)
    const medium = makeAsset('calme-moyen', 'calme', 90)
    const long = makeAsset('calme-long', 'calme', 200)
    const result = selectAmbianceForScene([short, medium, long], 'serein et doux')
    expect(result?.id).toBe('calme-long')
  })
})
