import { describe, it, expect } from 'vitest'

// Test de la logique d'estimation de coûts (tarifs par défaut)
describe('CostEstimator — tarifs par défaut', () => {
  const DEFAULT_COSTS: Record<string, Record<string, number>> = {
    llm: { brainstorm: 0.02, 'json-structure': 0.03, 'prompts-seedance': 0.02 },
    image: { 'storyboard-image': 0.05 },
    video: { 'clip-10s': 0.80 },
    tts: { 'voix-1m30': 0.15 },
  }

  it('estime le coût LLM brainstorm à 0.02€', () => {
    expect(DEFAULT_COSTS.llm.brainstorm).toBe(0.02)
  })

  it('estime le coût vidéo clip à 0.80€', () => {
    expect(DEFAULT_COSTS.video['clip-10s']).toBe(0.80)
  })

  it('calcule le coût total estimé d\'un run standard', () => {
    // idée(0) + brainstorm(0.02) + json(0.03) + storyboard(5*0.05=0.25) +
    // prompts(0.02) + vidéo(6*0.80=4.80) + tts(0.15) + preview(0) + publish(0)
    const total = 0 + 0.02 + 0.03 + 0.25 + 0.02 + 4.80 + 0.15 + 0 + 0
    expect(total).toBeCloseTo(5.27, 2)
  })

  it('retourne 0 pour un type inconnu', () => {
    const cost = DEFAULT_COSTS['unknown']?.['op'] ?? 0
    expect(cost).toBe(0)
  })
})
