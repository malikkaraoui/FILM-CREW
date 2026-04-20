import { describe, it, expect } from 'vitest'
import { step1Idea } from '../steps/step-1-idea'

describe('Pipeline Steps', () => {
  describe('Step 1 — Idée', () => {
    it('retourne success avec coût 0', async () => {
      const result = await step1Idea.execute({
        runId: 'test-run',
        chainId: 'test-chain',
        idea: 'Test idea',
        brandKitPath: null,
        storagePath: '/tmp/test',
        intentionPath: null,
      })

      expect(result.success).toBe(true)
      expect(result.costEur).toBe(0)
      const data = result.outputData as Record<string, unknown>
      expect(data.idea).toBe('Test idea')
      expect(data.hasIntention).toBe(false)
      expect(data.answeredCount).toBe(0)
    })

    it('a le bon numéro d\'étape', () => {
      expect(step1Idea.stepNumber).toBe(1)
      expect(step1Idea.name).toBe('Idée')
    })
  })
})
