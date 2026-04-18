import { getActiveRun } from '@/lib/db/queries/runs'

export async function checkInterruptedRun() {
  const active = await getActiveRun()
  if (!active) return null

  // Un run avec status 'running' au démarrage = run interrompu
  // Le heartbeat confirme si c'est un vrai zombie
  if (active.lastHeartbeat) {
    const elapsed = Date.now() - new Date(active.lastHeartbeat).getTime()
    if (elapsed > 30_000) {
      return active // zombie confirmé — plus de 30s sans heartbeat
    }
  }

  // Pas de heartbeat = run jamais démarré correctement ou interruption ancienne
  return active
}
