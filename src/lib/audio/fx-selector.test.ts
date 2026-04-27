import { describe, it, expect } from 'vitest'
import { selectFXForScene } from './fx-selector'
import type { FXAsset, DialogueLine, DialogueScene } from '@/types/audio'

// ─── Fixtures ───

function makeScene(sceneIndex: number, stageDirections = '', tones: string[] = []): DialogueScene {
  const lines: DialogueLine[] = tones.map((tone, i) => ({
    lineIndex: i,
    speaker: 'narrateur',
    text: 'texte',
    tone,
    pace: 'normal',
    emphasis: [],
    estimatedDurationS: 3,
  }))
  return {
    sceneIndex,
    title: `Scène ${sceneIndex}`,
    durationTargetS: 10,
    lines,
    silences: [],
    stageDirections,
  }
}

const transitionAsset: FXAsset = {
  id: 'transition-001',
  category: 'transitions',
  filename: 'swoosh-001.wav',
  filePath: '/assets/fx/transitions/swoosh-001.wav',
  description: 'Swoosh aérien',
  durationS: 0.4,
  tags: ['swoosh', 'aérien'],
}

const impactAsset: FXAsset = {
  id: 'impact-001',
  category: 'impacts',
  filename: 'impact-drum-001.wav',
  filePath: '/assets/fx/impacts/impact-drum-001.wav',
  description: 'Impact percussif',
  durationS: 0.6,
  tags: ['impact', 'percussif'],
}

const allAssets: FXAsset[] = [transitionAsset, impactAsset]

// ─── Règles positionnelles (V1) ───

describe('selectFXForScene — règles positionnelles', () => {
  it('retourne [] si assets est vide', () => {
    expect(selectFXForScene(makeScene(0), [], true, false)).toEqual([])
    expect(selectFXForScene(makeScene(0), [], false, true)).toEqual([])
    expect(selectFXForScene(makeScene(1), [], false, false)).toEqual([])
  })

  it('première scène → retourne le premier asset transitions', () => {
    const result = selectFXForScene(makeScene(0), allAssets, true, false)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('transition-001')
    expect(result[0].category).toBe('transitions')
  })

  it('dernière scène → retourne le premier asset impacts', () => {
    const result = selectFXForScene(makeScene(2), allAssets, false, true)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('impact-001')
    expect(result[0].category).toBe('impacts')
  })

  it('scène unique (isFirst ET isLast) → retourne transitions + impacts', () => {
    const result = selectFXForScene(makeScene(0), allAssets, true, true)
    expect(result).toHaveLength(2)
    expect(result.map((a) => a.category)).toEqual(['transitions', 'impacts'])
  })

  it('aucun asset transitions → première scène retourne []', () => {
    const result = selectFXForScene(makeScene(0), [impactAsset], true, false)
    expect(result).toEqual([])
  })

  it('aucun asset impacts → dernière scène retourne []', () => {
    const result = selectFXForScene(makeScene(2), [transitionAsset], false, true)
    expect(result).toEqual([])
  })

  it("l'ordre dans assets détermine la priorité (premier match retenu)", () => {
    const secondTransition: FXAsset = {
      ...transitionAsset,
      id: 'transition-002',
      filename: 'whoosh-001.wav',
    }
    const result = selectFXForScene(makeScene(0), [transitionAsset, secondTransition], true, false)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('transition-001')
  })
})

// ─── Règles sémantiques stageDirections (V2) ───

describe('selectFXForScene — stageDirections', () => {
  it('scène intermédiaire sans directions → retourne []', () => {
    expect(selectFXForScene(makeScene(1), allAssets, false, false)).toEqual([])
  })

  it('stageDirections avec mot-clé impact → catégorie impacts', () => {
    const scene = makeScene(1, 'explosion soudaine et chaos')
    const result = selectFXForScene(scene, allAssets, false, false)
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('impacts')
  })

  it('stageDirections avec mot-clé transition → catégorie transitions', () => {
    const scene = makeScene(1, 'fondu enchaîné vers la scène suivante')
    const result = selectFXForScene(scene, allAssets, false, false)
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('transitions')
  })

  it('stageDirections avec les deux types de mots-clés → impacts + transitions', () => {
    const scene = makeScene(1, 'cut brutal avec impact fort')
    const result = selectFXForScene(scene, allAssets, false, false)
    expect(result).toHaveLength(2)
    const categories = result.map((a) => a.category)
    expect(categories).toContain('impacts')
    expect(categories).toContain('transitions')
  })

  it('mots-clés non sensibles à la casse', () => {
    const scene = makeScene(1, 'EXPLOSION et IMPACT')
    const result = selectFXForScene(scene, allAssets, false, false)
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('impacts')
  })

  it('première scène + stageDirections impact → déduplication (impact une seule fois)', () => {
    const scene = makeScene(0, 'coup de tonnerre')
    const result = selectFXForScene(scene, allAssets, true, false)
    const categories = result.map((a) => a.category)
    // transitions (isFirst) + impacts (stageDirections)
    expect(categories).toContain('transitions')
    expect(categories).toContain('impacts')
    expect(categories.filter((c) => c === 'impacts')).toHaveLength(1)
  })
})

// ─── Règles sémantiques tone des lignes (V2) ───

describe('selectFXForScene — tonalité dramatique', () => {
  it('ligne avec tone urgent → catégorie impacts', () => {
    const scene = makeScene(1, '', ['urgent'])
    const result = selectFXForScene(scene, allAssets, false, false)
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('impacts')
  })

  it('ligne avec tone violent → catégorie impacts', () => {
    const scene = makeScene(1, '', ['violent'])
    const result = selectFXForScene(scene, allAssets, false, false)
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('impacts')
  })

  it('tone neutre → aucun FX sémantique', () => {
    const scene = makeScene(1, '', ['neutre', 'posé'])
    const result = selectFXForScene(scene, allAssets, false, false)
    expect(result).toEqual([])
  })

  it('plusieurs lignes dont une urgente → impacts sélectionnés', () => {
    const scene = makeScene(1, '', ['neutre', 'urgent', 'calme'])
    const result = selectFXForScene(scene, allAssets, false, false)
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('impacts')
  })

  it('scène vide (aucune ligne) → aucun FX sémantique par tone', () => {
    const scene = makeScene(1, '', [])
    const result = selectFXForScene(scene, allAssets, false, false)
    expect(result).toEqual([])
  })
})
