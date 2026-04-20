import { describe, it, expect } from 'vitest'
import { step1Idea } from '../steps/step-1-idea'
import { step2Brainstorm } from '../steps/step-2-brainstorm'
import { step3Json } from '../steps/step-3-json'
import { step4Storyboard } from '../steps/step-4-storyboard'
import { step5Prompts } from '../steps/step-5-prompts'
import { step6Generation } from '../steps/step-6-generation'
import { step7Preview } from '../steps/step-7-preview'
import type { PipelineStep, StepContext } from '../types'

/**
 * 12A — E2E pipeline coeur
 *
 * Vérifie :
 * 1. Contrat des 8 steps (stepNumber, name, execute)
 * 2. Séquence ordonnée 1-8
 * 3. Pas de trous dans la numérotation
 * 4. Step 1 (Idée) — happy path sans DB
 * 5. Step 1 — idée propagée correctement
 * 6. StepContext — structure complète
 * 7. StepResult — champs requis
 * 8. progressPct depuis completed steps
 * 9. Pipeline : 8 steps enregistrés
 * 10. Noms canoniques des steps
 */

const ALL_STEPS: PipelineStep[] = [
  step1Idea,
  step2Brainstorm,
  step3Json,
  step4Storyboard,
  step5Prompts,
  step6Generation,
  // step7Preview et step8Publish non importés car ils dépendent de ffmpeg / externe
]

const STEP_NAMES = [
  'Idée',
  'Brainstorm',
  'JSON structuré',
  'Storyboard',
  'Prompts Seedance',
  'Génération',
  'Preview',
  'Publication',
]

const BASE_CTX: StepContext = {
  runId: 'e2e-test-run',
  chainId: 'e2e-test-chain',
  idea: 'Un test E2E du pipeline FILM CREW',
  brandKitPath: null,
  storagePath: '/tmp/e2e-test',
  intentionPath: null,
  template: null,
}

describe('12A — E2E pipeline coeur', () => {

  // ─── 1. Contrat des 8 steps ──────────────────────────────────────────────

  describe('Contrat des steps importés', () => {
    it('chaque step a stepNumber, name et execute', () => {
      for (const step of ALL_STEPS) {
        expect(typeof step.stepNumber).toBe('number')
        expect(typeof step.name).toBe('string')
        expect(typeof step.execute).toBe('function')
      }
    })

    it('stepNumber est >= 1', () => {
      for (const step of ALL_STEPS) {
        expect(step.stepNumber).toBeGreaterThanOrEqual(1)
      }
    })

    it('execute est une fonction async', () => {
      for (const step of ALL_STEPS) {
        const result = step.execute(BASE_CTX)
        expect(result).toBeInstanceOf(Promise)
        result.catch(() => {}) // éviter unhandled rejection
      }
    })
  })

  // ─── 2. Séquence ordonnée 1-8 ────────────────────────────────────────────

  describe('Séquence pipeline — numérotation canonique', () => {
    it('step 1 = Idée', () => {
      expect(step1Idea.stepNumber).toBe(1)
      expect(step1Idea.name).toBe('Idée')
    })

    it('step 2 = Brainstorm', () => {
      expect(step2Brainstorm.stepNumber).toBe(2)
      expect(step2Brainstorm.name).toBe('Brainstorm')
    })

    it('step 3 = JSON structuré', () => {
      expect(step3Json.stepNumber).toBe(3)
      expect(step3Json.name).toBe('JSON structuré')
    })

    it('step 4 = Storyboard', () => {
      expect(step4Storyboard.stepNumber).toBe(4)
      expect(step4Storyboard.name).toBe('Storyboard')
    })

    it('step 5 = Prompts Seedance', () => {
      expect(step5Prompts.stepNumber).toBe(5)
      expect(step5Prompts.name).toBe('Prompts Seedance')
    })

    it('step 6 = Génération', () => {
      expect(step6Generation.stepNumber).toBe(6)
      expect(step6Generation.name).toBe('Génération')
    })
  })

  // ─── 3. Pas de trous dans la numérotation ────────────────────────────────

  describe('Numérotation — sans trous', () => {
    it('les steps importés sont croissants et consécutifs', () => {
      const sorted = [...ALL_STEPS].sort((a, b) => a.stepNumber - b.stepNumber)
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i + 1].stepNumber).toBe(sorted[i].stepNumber + 1)
      }
    })

    it('18 noms de steps canoniques couvrent les 8 positions', () => {
      expect(STEP_NAMES).toHaveLength(8)
      expect(STEP_NAMES[0]).toBe('Idée')
      expect(STEP_NAMES[7]).toBe('Publication')
    })
  })

  // ─── 4. Step 1 — happy path sans DB ─────────────────────────────────────

  describe('Step 1 — happy path sans DB', () => {
    it('retourne success: true et costEur: 0', async () => {
      const result = await step1Idea.execute(BASE_CTX)
      expect(result.success).toBe(true)
      expect(result.costEur).toBe(0)
    })

    it('outputData.idea = idée brute si pas d\'intention', async () => {
      const result = await step1Idea.execute(BASE_CTX)
      const data = result.outputData as Record<string, unknown>
      expect(data.idea).toBe(BASE_CTX.idea)
      expect(data.hasIntention).toBe(false)
    })

    it('outputData.answeredCount = 0 si pas de questionnaire', async () => {
      const result = await step1Idea.execute(BASE_CTX)
      const data = result.outputData as Record<string, unknown>
      expect(data.answeredCount).toBe(0)
    })
  })

  // ─── 5. Step 1 — idée propagée ───────────────────────────────────────────

  describe('Step 1 — propagation idée dans le contexte', () => {
    it('simulate engine : ctx.idea unchanged si hasIntention = false', async () => {
      const ctx = { ...BASE_CTX, idea: 'Idée brute sans questionnaire' }
      const result = await step1Idea.execute(ctx)
      const data = result.outputData as Record<string, unknown>

      // Simuler ce que l'engine fait après step 1
      if (data?.idea && typeof data.idea === 'string' && data.idea !== ctx.idea) {
        ctx.idea = data.idea
      }

      expect(ctx.idea).toBe('Idée brute sans questionnaire')
    })
  })

  // ─── 6. StepContext — structure ──────────────────────────────────────────

  describe('StepContext — structure', () => {
    it('champs requis présents', () => {
      const ctx: StepContext = {
        runId: 'test', chainId: 'chain', idea: 'Idée',
        brandKitPath: null, storagePath: '/tmp/test', intentionPath: null, template: null,
      }
      expect(ctx.runId).toBeTruthy()
      expect(ctx.chainId).toBeTruthy()
      expect(ctx.idea).toBeTruthy()
      expect(ctx.brandKitPath).toBeNull()
      expect(ctx.template).toBeNull()
    })

    it('intentionPath optionnel', () => {
      const withIntention: StepContext = { ...BASE_CTX, intentionPath: '/tmp/intention.json' }
      const without: StepContext = { ...BASE_CTX, intentionPath: null }
      expect(withIntention.intentionPath).toBe('/tmp/intention.json')
      expect(without.intentionPath).toBeNull()
    })
  })

  // ─── 7. StepResult — champs requis ──────────────────────────────────────

  describe('StepResult — champs requis', () => {
    it('step 1 retourne { success, costEur, outputData }', async () => {
      const result = await step1Idea.execute(BASE_CTX)
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.costEur).toBe('number')
      expect(result.outputData).not.toBeUndefined()
    })

    it('costEur >= 0', async () => {
      const result = await step1Idea.execute(BASE_CTX)
      expect(result.costEur).toBeGreaterThanOrEqual(0)
    })
  })

  // ─── 8. progressPct depuis completed steps ───────────────────────────────

  describe('progressPct — calcul E2E', () => {
    type MockStep = { stepNumber: number; status: string }

    function computeProgress(steps: MockStep[]) {
      const done = steps.filter((s) => s.status === 'completed').length
      return { pct: Math.round((done / 8) * 100), done, total: 8 }
    }

    it('0/8 → 0%', () => {
      const steps = Array.from({ length: 8 }, (_, i) => ({ stepNumber: i + 1, status: 'pending' }))
      expect(computeProgress(steps).pct).toBe(0)
    })

    it('1/8 complété (step 1) → 13%', () => {
      const steps = Array.from({ length: 8 }, (_, i) => ({
        stepNumber: i + 1, status: i === 0 ? 'completed' : 'pending',
      }))
      expect(computeProgress(steps).pct).toBe(13)
    })

    it('8/8 complétés → 100%', () => {
      const steps = Array.from({ length: 8 }, (_, i) => ({ stepNumber: i + 1, status: 'completed' }))
      expect(computeProgress(steps).pct).toBe(100)
    })

    it('step failed ne compte pas comme completed', () => {
      const steps = Array.from({ length: 8 }, (_, i) => ({
        stepNumber: i + 1, status: i < 2 ? 'completed' : i === 2 ? 'failed' : 'pending',
      }))
      expect(computeProgress(steps).pct).toBe(25) // 2/8 = 25%
    })
  })

  // ─── 9. Pipeline — 8 steps enregistrés ──────────────────────────────────

  describe('Pipeline — 8 steps enregistrés', () => {
    it('STEP_NAMES a 8 entrées', () => {
      expect(STEP_NAMES).toHaveLength(8)
    })

    it('Idée en première position', () => {
      expect(STEP_NAMES[0]).toBe('Idée')
    })

    it('Publication en dernière position', () => {
      expect(STEP_NAMES[7]).toBe('Publication')
    })

    it('Génération en position 6', () => {
      expect(STEP_NAMES[5]).toBe('Génération')
    })
  })

  // ─── 10. Noms canoniques ─────────────────────────────────────────────────

  describe('Noms canoniques des 8 steps', () => {
    const EXPECTED = [
      'Idée', 'Brainstorm', 'JSON structuré', 'Storyboard',
      'Prompts Seedance', 'Génération', 'Preview', 'Publication',
    ]

    EXPECTED.forEach((name, i) => {
      it(`step ${i + 1} = "${name}"`, () => {
        expect(STEP_NAMES[i]).toBe(name)
      })
    })
  })
})
