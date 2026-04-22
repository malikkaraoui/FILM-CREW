import type { AgentRole } from '@/types/agent'
import { AGENT_PROFILES } from './profiles'

/**
 * Séquence complète des interventions dans une réunion.
 * Miroir exact du flow de MeetingCoordinator.runMeeting().
 *
 * Phase 1 : Mia ouvre
 * Phase 2 : Tour de table (lenny, nael, laura, nico, emilie)
 * Phase 3 : Discussion libre (2 rounds × lenny, laura, nael)
 * Phase 4 : Emilie valide le Brand Kit
 * Phase 5 : Chaque agent rédige sa section (lenny, laura, nael, emilie, nico)
 * Phase 6 : Mia conclut
 */
export const FULL_SPEAKING_SEQUENCE: AgentRole[] = [
  // Phase 1
  'mia',
  // Phase 2
  'lenny', 'nael', 'laura', 'nico', 'emilie',
  // Phase 3 — round 1
  'lenny', 'laura', 'nael',
  // Phase 3 — round 2
  'lenny', 'laura', 'nael',
  // Phase 4
  'emilie',
  // Phase 5
  'lenny', 'laura', 'nael', 'emilie', 'nico',
  // Phase 6
  'mia',
]

export type MeetingPhase = {
  name: string
  number: number
  startIndex: number
  endIndex: number // exclusive
}

const PHASES: MeetingPhase[] = [
  { name: 'Ouverture', number: 1, startIndex: 0, endIndex: 1 },
  { name: 'Tour de table', number: 2, startIndex: 1, endIndex: 6 },
  { name: 'Discussion libre', number: 3, startIndex: 6, endIndex: 12 },
  { name: 'Validation Brand Kit', number: 4, startIndex: 12, endIndex: 13 },
  { name: 'Rédaction du brief', number: 5, startIndex: 13, endIndex: 18 },
  { name: 'Conclusion', number: 6, startIndex: 18, endIndex: 19 },
]

export type MeetingState = {
  phase: MeetingPhase
  nextSpeaker: AgentRole | null
  nextSpeakerLabel: string
  progress: number // 0-100
  totalExpected: number
  completed: number
}

/**
 * Détermine l'état courant de la réunion à partir du nombre de traces reçues.
 */
export function getMeetingState(traceCount: number): MeetingState {
  const total = FULL_SPEAKING_SEQUENCE.length
  const clamped = Math.min(traceCount, total)

  // Trouver la phase courante
  let phase = PHASES[PHASES.length - 1]
  for (const p of PHASES) {
    if (clamped < p.endIndex) {
      phase = p
      break
    }
  }

  const nextSpeaker = clamped < total ? FULL_SPEAKING_SEQUENCE[clamped] : null
  const nextProfile = nextSpeaker ? AGENT_PROFILES[nextSpeaker] : null

  return {
    phase,
    nextSpeaker,
    nextSpeakerLabel: nextProfile
      ? `${nextProfile.displayName} — ${nextProfile.title}`
      : 'Réunion terminée',
    progress: Math.round((clamped / total) * 100),
    totalExpected: total,
    completed: clamped,
  }
}
