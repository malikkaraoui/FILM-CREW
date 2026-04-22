import { describe, it, expect } from 'vitest'
import {
  buildStoryboardBlueprintFallback,
  normalizeStoryboardBlueprint,
  type StructuredStoryDocument,
} from '../blueprint'
import type { DirectorPlan } from '@/lib/pipeline/steps/step-3-json'

const STRUCTURE: StructuredStoryDocument = {
  title: 'Le chien et la voiture',
  tone: 'simple',
  style: 'rough storyboard',
  scenes: [
    {
      index: 1,
      description: 'Un enfant regarde une voiture rouge devant la maison.',
      dialogue: 'La voiture arrive devant chez nous.',
      camera: 'plan large',
      lighting: 'lumière du matin',
      duration_s: 6,
    },
    {
      index: 2,
      description: 'Le chien saute près du ballon dans le jardin.',
      dialogue: 'Le chien veut jouer.',
      camera: 'plan moyen',
      lighting: 'lumière douce',
      duration_s: 5,
    },
  ],
}

const DIRECTOR_PLAN: DirectorPlan = {
  runId: 'run-blueprint',
  idea: 'Test blueprint',
  tone: 'joyeux',
  style: 'cinématographique simple',
  creativeDirection: 'Toujours garder une lecture immédiate et un sujet principal.',
  shotList: [
    { sceneIndex: 1, intent: 'Présenter la voiture', camera: 'plan large', emotion: 'surprise', influencedBy: ['lenny'] },
    { sceneIndex: 2, intent: 'Montrer le jeu', camera: 'plan moyen', emotion: 'joie', influencedBy: ['nael'] },
  ],
  generatedAt: new Date().toISOString(),
}

describe('storyboard blueprint', () => {
  it('fallback produit un blueprint complet et exploitable', () => {
    const blueprint = buildStoryboardBlueprintFallback({
      runId: 'run-blueprint',
      idea: 'Test blueprint',
      structure: STRUCTURE,
      directorPlan: DIRECTOR_PLAN,
      brief: { summary: 'Résumé court.' },
    })

    expect(blueprint.source).toBe('fallback')
    expect(blueprint.providerUsed).toBe('heuristic-fallback')
    expect(blueprint.scenes).toHaveLength(2)
    const firstScene = blueprint.scenes[0]!
    const secondScene = blueprint.scenes[1]!
    expect(firstScene.panelTitle).toBeTruthy()
    expect(firstScene.childCaption).toBeTruthy()
    expect((firstScene.drawingSteps ?? []).length).toBeGreaterThan(1)
    expect((secondScene.importantObjects ?? []).length).toBeGreaterThan(0)
  })

  it('normalise un payload partiel en complétant depuis structure + director-plan', () => {
    const blueprint = normalizeStoryboardBlueprint(
      {
        title: 'Blueprint custom',
        scenes: [
          {
            sceneIndex: 1,
            childCaption: 'On voit la voiture.',
            primarySubject: 'voiture',
          },
        ],
      },
      {
        runId: 'run-blueprint',
        idea: 'Test blueprint',
        structure: STRUCTURE,
        directorPlan: DIRECTOR_PLAN,
        brief: null,
        source: 'llm',
        providerUsed: 'ollama',
        failoverOccurred: false,
      },
    )

    expect(blueprint.title).toBe('Blueprint custom')
    expect(blueprint.source).toBe('llm')
    expect(blueprint.providerUsed).toBe('ollama')
    expect(blueprint.scenes).toHaveLength(2)
    const firstScene = blueprint.scenes[0]!
    const secondScene = blueprint.scenes[1]!
    expect(firstScene.childCaption).toBe('On voit la voiture.')
    expect(firstScene.framing).toBe('plan large')
    expect(firstScene.directorIntent).toBe('Présenter la voiture')
    expect(secondScene.primarySubject).toBeTruthy()
    expect((secondScene.drawingSteps ?? []).length).toBeGreaterThan(1)
  })
})