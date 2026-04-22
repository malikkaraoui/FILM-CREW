'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AgentChat } from '@/components/studio/agent-chat'
import { getMeetingState } from '@/lib/agents/meeting-sequence'
import type { MeetingState } from '@/lib/agents/meeting-sequence'

type TraceEntry = {
  id: string
  agentName: string
  messageType: string
  content: { text: string; metadata?: { model?: string; latencyMs?: number; costEur?: number } }
  createdAt: string
}

export default function StudioPage() {
  const { id } = useParams<{ id: string }>()
  const [traces, setTraces] = useState<TraceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [meetingState, setMeetingState] = useState<MeetingState | null>(null)
  const hasMeeting = traces.length > 0
  const meetingDone = traces.length >= 19

  useEffect(() => {
    loadTraces()
    const interval = setInterval(loadTraces, 3_000)
    return () => clearInterval(interval)
  }, [id])

  useEffect(() => {
    if (running || (hasMeeting && !meetingDone)) {
      setMeetingState(getMeetingState(traces.length))
    } else {
      setMeetingState(null)
    }
  }, [traces.length, running, hasMeeting, meetingDone])

  async function loadTraces() {
    try {
      const res = await fetch(`/api/runs/${id}/traces`)
      const json = await res.json()
      if (json.data) setTraces(json.data)
    } catch { /* silencieux */ }
    setLoading(false)
  }

  async function startMeeting() {
    if (hasMeeting) {
      setError("Réunion déjà générée pour ce run — relance bloquée pour éviter les doublons d'agents.")
      return
    }

    setRunning(true)
    setError('')
    try {
      const res = await fetch(`/api/runs/${id}/meeting`, { method: 'POST' })
      const json = await res.json()
      if (json.error) {
        setError(json.error.message)
      }
      await loadTraces()
    } catch (e) {
      setError((e as Error).message)
    }
    setRunning(false)
  }

  // Trois états UX distincts
  const isLive = running || (hasMeeting && !meetingDone)
  const isIdle = !hasMeeting && !running

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Studio Virtuel</h1>
        {isIdle && (
          <Button onClick={startMeeting} size="sm">
            Lancer la réunion
          </Button>
        )}
      </div>

      {/* Bandeau d'état — sans ambiguïté */}
      {isLive && meetingState && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Réunion en cours — patiente, les agents parlent tour à tour
              </span>
            </div>
            <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
              {meetingState.completed}/{meetingState.totalExpected}
            </span>
          </div>
          {/* Barre de progression */}
          <div className="mt-2 h-1.5 w-full rounded-full bg-blue-100 dark:bg-blue-900/50">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${meetingState.progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-blue-600 dark:text-blue-400">
            Phase {meetingState.phase.number}/6 — {meetingState.phase.name}
          </p>
        </div>
      )}

      {meetingDone && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/50 dark:bg-green-950/30">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-green-800 dark:text-green-200">
              Réunion terminée — {traces.length} interventions enregistrées
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <AgentChat traces={traces} loading={loading} meetingState={isLive ? meetingState : null} />
    </div>
  )
}
