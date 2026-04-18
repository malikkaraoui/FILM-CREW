import { getActiveRun } from '@/lib/db/queries/runs'

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
