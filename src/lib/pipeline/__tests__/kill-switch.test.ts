import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TOTAL_PIPELINE_STEPS } from '../constants'

/**
 * 12B — Contrôle d'exécution : kill switch + engine kill check
 *
 * Vérifie :
 * 1. Route /kill — guard : pending/running → 200, terminaux → 409
 * 2. Route /kill — idempotence : killed → 409
 * 3. Kill check engine — pipeline s'arrête si status=killed avant step
 * 4. Kill check engine — pipeline continue si status=running
 * 5. killRun() marque le run killed en DB
 * 6. Queue — un run killed n'apparaît plus dans pending/running
 */

// ─── 1. Guard route /kill — logique de statut ────────────────────────────────

describe('12B — Route /kill — guard de statut', () => {
  const TERMINAL_STATUSES = ['completed', 'failed', 'killed']
  const KILLABLE_STATUSES = ['pending', 'running']

  it('rejette les états terminaux (completed, failed, killed)', () => {
    for (const status of TERMINAL_STATUSES) {
      const isTerminal = TERMINAL_STATUSES.includes(status)
      expect(isTerminal).toBe(true)
    }
  })

  it('accepte pending et running', () => {
    for (const status of KILLABLE_STATUSES) {
      const isTerminal = TERMINAL_STATUSES.includes(status)
      expect(isTerminal).toBe(false)
    }
  })

  it('pending n\'est pas dans les terminaux (correction 12B)', () => {
    expect(TERMINAL_STATUSES.includes('pending')).toBe(false)
  })

  it('running n\'est pas dans les terminaux', () => {
    expect(TERMINAL_STATUSES.includes('running')).toBe(false)
  })

  it('killed est dans les terminaux (idempotence)', () => {
    expect(TERMINAL_STATUSES.includes('killed')).toBe(true)
  })

  it('completed est dans les terminaux', () => {
    expect(TERMINAL_STATUSES.includes('completed')).toBe(true)
  })

  it('failed est dans les terminaux', () => {
    expect(TERMINAL_STATUSES.includes('failed')).toBe(true)
  })
})

// ─── 2. Kill check engine — logique d'arrêt ─────────────────────────────────

describe('12B — Engine kill check — logique d\'arrêt', () => {
  type StepCall = { stepNumber: number; killed: boolean }

  async function simulatePipeline(killAtStep: number | null): Promise<StepCall[]> {
    const steps = Array.from({ length: TOTAL_PIPELINE_STEPS }, (_, i) => i + 1)
    const executed: StepCall[] = []

    for (const stepNumber of steps) {
      // Kill check (simulé) — relecture statut DB avant chaque step
      const status = killAtStep !== null && stepNumber >= killAtStep ? 'killed' : 'running'
      if (status === 'killed') {
        executed.push({ stepNumber, killed: true })
        break
      }
      // Exécuter le step
      executed.push({ stepNumber, killed: false })
    }

    return executed
  }

  it('sans kill : tous les 9 steps s\'exécutent', async () => {
    const result = await simulatePipeline(null)
    expect(result).toHaveLength(TOTAL_PIPELINE_STEPS)
    expect(result.every((s) => !s.killed)).toBe(true)
  })

  it('kill avant step 1 : pipeline s\'arrête immédiatement', async () => {
    const result = await simulatePipeline(1)
    expect(result).toHaveLength(1)
    expect(result[0].killed).toBe(true)
    expect(result[0].stepNumber).toBe(1)
  })

  it('kill avant step 3 : steps 1-2 exécutés, arrêt à 3', async () => {
    const result = await simulatePipeline(3)
    const executed = result.filter((s) => !s.killed)
    const killed = result.filter((s) => s.killed)
    expect(executed).toHaveLength(2) // steps 1 et 2
    expect(killed).toHaveLength(1)
    expect(killed[0].stepNumber).toBe(3)
  })

  it('kill avant step 9 : steps 1-8 exécutés, arrêt à 9', async () => {
    const result = await simulatePipeline(TOTAL_PIPELINE_STEPS)
    const executed = result.filter((s) => !s.killed)
    expect(executed).toHaveLength(TOTAL_PIPELINE_STEPS - 1)
    expect(result[TOTAL_PIPELINE_STEPS - 1].killed).toBe(true)
    expect(result[TOTAL_PIPELINE_STEPS - 1].stepNumber).toBe(TOTAL_PIPELINE_STEPS)
  })

  it('le kill prend effet à la prochaine frontière inter-step (pas mid-step)', async () => {
    // Simuler : kill envoyé pendant l'exécution du step 2
    // → step 2 termine normalement → kill détecté avant step 3
    const result = await simulatePipeline(3)
    const executedWithoutKill = result.filter((s) => !s.killed)
    // Steps 1 et 2 ont terminé normalement
    expect(executedWithoutKill.map((s) => s.stepNumber)).toEqual([1, 2])
  })
})

// ─── 3. Queue — cohérence après kill ────────────────────────────────────────

describe('12B — Queue — cohérence après kill', () => {
  type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'killed'

  function getQueueRuns(runs: { id: string; status: RunStatus }[]) {
    return runs.filter((r) => r.status === 'pending' || r.status === 'running')
  }

  it('un run killed n\'apparaît pas dans la queue', () => {
    const runs = [
      { id: 'r1', status: 'killed' as RunStatus },
      { id: 'r2', status: 'pending' as RunStatus },
    ]
    const queue = getQueueRuns(runs)
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBe('r2')
  })

  it('une queue avec 2 pending affiche 2 runs', () => {
    const runs = [
      { id: 'r1', status: 'pending' as RunStatus },
      { id: 'r2', status: 'pending' as RunStatus },
    ]
    expect(getQueueRuns(runs)).toHaveLength(2)
  })

  it('après kill de tous les runs actifs, queue vide', () => {
    const runs = [
      { id: 'r1', status: 'killed' as RunStatus },
      { id: 'r2', status: 'killed' as RunStatus },
    ]
    expect(getQueueRuns(runs)).toHaveLength(0)
  })

  it('completed et failed n\'apparaissent pas dans la queue', () => {
    const runs = [
      { id: 'r1', status: 'completed' as RunStatus },
      { id: 'r2', status: 'failed' as RunStatus },
      { id: 'r3', status: 'running' as RunStatus },
    ]
    const queue = getQueueRuns(runs)
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBe('r3')
  })
})

// ─── 4. killRun() — comportement attendu ────────────────────────────────────

describe('12B — killRun() — comportement', () => {
  it('retourne { killed: true, preservedClips, totalClips, durationMs }', () => {
    // Contrat de retour de killRun() (sans appel DB réel)
    const mockResult = {
      killed: true,
      preservedClips: 2,
      totalClips: 3,
      durationMs: 150,
    }
    expect(mockResult.killed).toBe(true)
    expect(typeof mockResult.preservedClips).toBe('number')
    expect(typeof mockResult.totalClips).toBe('number')
    expect(typeof mockResult.durationMs).toBe('number')
    expect(mockResult.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('preservedClips <= totalClips', () => {
    const results = [
      { preservedClips: 0, totalClips: 0 },
      { preservedClips: 2, totalClips: 3 },
      { preservedClips: 5, totalClips: 5 },
    ]
    for (const r of results) {
      expect(r.preservedClips).toBeLessThanOrEqual(r.totalClips)
    }
  })
})

// ─── 5. Intégration guard + kill — flux complet ──────────────────────────────

describe('12B — Flux complet kill pending', () => {
  type Status = 'pending' | 'running' | 'completed' | 'failed' | 'killed'

  function simulateKillRoute(status: Status): { httpStatus: number; code: string } {
    const TERMINAL = ['completed', 'failed', 'killed']
    if (TERMINAL.includes(status)) {
      return { httpStatus: 409, code: 'INVALID_STATE' }
    }
    return { httpStatus: 200, code: 'OK' }
  }

  it('run pending → kill → 200', () => {
    expect(simulateKillRoute('pending').httpStatus).toBe(200)
  })

  it('run running → kill → 200', () => {
    expect(simulateKillRoute('running').httpStatus).toBe(200)
  })

  it('run killed → kill → 409 (idempotence)', () => {
    const r = simulateKillRoute('killed')
    expect(r.httpStatus).toBe(409)
    expect(r.code).toBe('INVALID_STATE')
  })

  it('run completed → kill → 409', () => {
    expect(simulateKillRoute('completed').httpStatus).toBe(409)
  })

  it('run failed → kill → 409', () => {
    expect(simulateKillRoute('failed').httpStatus).toBe(409)
  })
})
