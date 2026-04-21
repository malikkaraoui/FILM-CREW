import { getActiveRun, getZombieRuns, markRunFailed } from '@/lib/db/queries/runs'
import { logger } from '@/lib/logger'

/**
 * Résout tous les runs zombies (status='running', heartbeat stale > 5min).
 * Les marque 'failed' avec un message explicite. Idempotent. (12C)
 */
export async function recoverZombies(): Promise<{ recovered: number; runIds: string[] }> {
  const zombies = await getZombieRuns()
  const runIds: string[] = []

  for (const zombie of zombies) {
    await markRunFailed(zombie.id, 'Interruption détectée — processus inactif depuis >5min')
    logger.warn({ event: 'zombie_recovered', runId: zombie.id, lastHeartbeat: zombie.lastHeartbeat })
    runIds.push(zombie.id)
  }

  if (runIds.length > 0) {
    logger.info({ event: 'recovery_complete', recovered: runIds.length })
  }

  return { recovered: runIds.length, runIds }
}

export async function checkInterruptedRun() {
  const active = await getActiveRun()
  if (!active) return null

  // Un run avec status 'running' au démarrage = run interrompu
  // Le heartbeat est mis à jour toutes les 60s pendant chaque step.
  // Seuil à 5 min pour couvrir les steps LLM longs (Ollama local).
  if (active.lastHeartbeat) {
    const elapsed = Date.now() - new Date(active.lastHeartbeat).getTime()
    if (elapsed > 5 * 60_000) {
      return active // zombie confirmé — plus de 5 min sans heartbeat
    }
    return null // heartbeat récent, le pipeline tourne encore
  }

  // Pas de heartbeat = run jamais démarré ou interruption ancienne
  return active
}
