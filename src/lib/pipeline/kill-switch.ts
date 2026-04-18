import { updateRunStatus } from '@/lib/db/queries/runs'
import { db } from '@/lib/db/connection'
import { clip } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

// Registre des processus actifs pour un run
const activeProcesses: Map<string, Set<number>> = new Map()

export function registerProcess(runId: string, pid: number): void {
  if (!activeProcesses.has(runId)) {
    activeProcesses.set(runId, new Set())
  }
  activeProcesses.get(runId)!.add(pid)
}

export function unregisterProcess(runId: string, pid: number): void {
  activeProcesses.get(runId)?.delete(pid)
}

/**
 * Kill switch multi-niveau :
 * 1. Marquer le run comme "killed" en DB
 * 2. SIGTERM aux processus Python (gracieux)
 * 3. Attendre 10s, puis SIGKILL si toujours vivant
 * 4. Nettoyer les ports et zombies
 * 5. Compter les clips préservés
 *
 * Objectif : < 15 secondes
 */
export async function killRun(runId: string): Promise<{
  killed: boolean
  preservedClips: number
  totalClips: number
  durationMs: number
}> {
  const start = Date.now()

  logger.info({ event: 'kill_switch_start', runId })

  // 1. Marquer killed en DB immédiatement
  await updateRunStatus(runId, 'killed')

  // 2. SIGTERM tous les processus du run
  const pids = activeProcesses.get(runId) ?? new Set()
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM')
      logger.info({ event: 'kill_sigterm', runId, pid })
    } catch {
      // Processus déjà mort
    }
  }

  // 3. Attendre 10s max, puis SIGKILL
  if (pids.size > 0) {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        for (const pid of pids) {
          try {
            process.kill(pid, 'SIGKILL')
            logger.warn({ event: 'kill_sigkill', runId, pid })
          } catch {
            // Déjà mort
          }
        }
        resolve()
      }, 10_000)

      // Vérifier toutes les 500ms si les processus sont morts
      const check = setInterval(() => {
        let allDead = true
        for (const pid of pids) {
          try {
            process.kill(pid, 0) // test si vivant
            allDead = false
          } catch {
            // Mort
          }
        }
        if (allDead) {
          clearInterval(check)
          clearTimeout(timeout)
          resolve()
        }
      }, 500)
    })
  }

  // 4. Nettoyer le registre
  activeProcesses.delete(runId)

  // 5. Compter les clips préservés
  const clips = await db.select().from(clip).where(eq(clip.runId, runId))
  const preservedClips = clips.filter((c) => c.status === 'completed').length
  const totalClips = clips.length

  const durationMs = Date.now() - start

  logger.info({
    event: 'kill_switch_complete',
    runId,
    preservedClips,
    totalClips,
    durationMs,
  })

  return { killed: true, preservedClips, totalClips, durationMs }
}
