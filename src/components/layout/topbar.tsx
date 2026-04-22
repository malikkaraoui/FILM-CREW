'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'
import { Badge } from '@/components/ui/badge'
import { getMeetingState } from '@/lib/agents/meeting-sequence'
import type { MeetingState } from '@/lib/agents/meeting-sequence'
import { formatPipelineStepLabel } from '@/lib/pipeline/constants'

type ProviderStatus = {
  name: string
  type: string
  health: { status: string; details?: string }
}

type ActiveRun = {
  id: string
  idea: string
  currentStep: number
  costEur: number
  status: string
}

type FailoverEvent = {
  original: string
  fallback: string
  type: string
  reason: string
  timestamp: string
}

const STATUS_COLORS: Record<string, string> = {
  free: 'bg-green-500',
  busy: 'bg-amber-500',
  killing: 'bg-orange-500',
  down: 'bg-red-500',
  degraded: 'bg-amber-600',
}

const STATUS_LABELS: Record<string, string> = {
  free: 'libre',
  busy: 'en cours',
  killing: 'arrêt en cours',
  down: 'hors ligne',
  degraded: 'dégradé',
}

export function Topbar() {
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null)
  const [costAlert, setCostAlert] = useState(false)
  const [failovers, setFailovers] = useState<FailoverEvent[]>([])
  const [meeting, setMeeting] = useState<MeetingState | null>(null)

  const loadProviders = async () => {
    try {
      const res = await fetch('/api/providers')
      const json = await res.json()
      if (json.data) setProviders(json.data)
    } catch { /* silencieux */ }
  }

  const loadOllamaStatus = async () => {
    try {
      const res = await fetch('/api/providers/ollama', { cache: 'no-store' })
      const json = await res.json()
      if (json.data) {
        setProviders((prev) => {
          const withoutOllama = prev.filter((p) => p.name !== 'ollama')
          return [json.data as ProviderStatus, ...withoutOllama]
        })
      }
    } catch { /* silencieux */ }
  }

  const loadActiveRun = async () => {
    try {
      const res = await fetch('/api/queue')
      const json = await res.json()
      if (json.data?.active) {
        setActiveRun(json.data.active)
        const configRes = await fetch('/api/config')
        const configJson = await configRes.json()
        if (configJson.data) {
          const alertCfg = configJson.data.find((c: { key: string }) => c.key === 'cost_alert_per_run')
          if (alertCfg) {
            const threshold = parseFloat(alertCfg.value) * 0.8
            setCostAlert((json.data.active.costEur ?? 0) >= threshold)
          }
        }
      } else {
        setActiveRun(null)
        setCostAlert(false)
      }
    } catch { /* silencieux */ }
  }

  const loadFailovers = async () => {
    try {
      const res = await fetch('/api/providers/failovers')
      const json = await res.json()
      if (json.data) setFailovers(json.data)
    } catch { /* silencieux */ }
  }

  const loadMeetingStatus = async (runId: string) => {
    try {
      const res = await fetch(`/api/runs/${runId}/traces`)
      const json = await res.json()
      if (json.data) {
        const traceCount = json.data.length
        if (traceCount > 0 && traceCount < 19) {
          setMeeting(getMeetingState(traceCount))
        } else {
          setMeeting(null)
        }
      }
    } catch { setMeeting(null) }
  }

  useEffect(() => {
    void loadProviders()
    void loadOllamaStatus()
    void loadActiveRun()
    void loadFailovers()
    const pi = setInterval(() => void loadProviders(), 60_000)
    const oi = setInterval(() => void loadOllamaStatus(), 1_000)
    const ri = setInterval(() => void loadActiveRun(), 3_000)
    const fi = setInterval(() => void loadFailovers(), 5_000)
    return () => { clearInterval(pi); clearInterval(oi); clearInterval(ri); clearInterval(fi) }
  }, [])

  // Poller le meeting quand un run est actif
  useEffect(() => {
    if (!activeRun?.id || activeRun.status !== 'running') {
      setMeeting(null)
      return
    }
    void loadMeetingStatus(activeRun.id)
    const mi = setInterval(() => void loadMeetingStatus(activeRun.id), 3_000)
    return () => clearInterval(mi)
  }, [activeRun?.id, activeRun?.status])

  async function dismissFailovers() {
    await fetch('/api/providers/failovers', { method: 'DELETE' })
    setFailovers([])
  }

  const ollama = providers.find((p) => p.name === 'ollama')
  const ollamaStatusLabel = ollama ? (STATUS_LABELS[ollama.health.status] ?? ollama.health.status) : null
  const showOllamaBanner = !!ollama && ollama.health.status !== 'free'

  return (
    <header className="sticky top-0 z-50 flex flex-col border-b bg-background">
      <div className="flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">FILM-CREW</span>

          {ollama && (
            <div
              className={`hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] md:flex ${
                ollama.health.status === 'free'
                  ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300'
                  : ollama.health.status === 'busy'
                    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300'
                    : ollama.health.status === 'killing'
                      ? 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
              }`}
              title={ollama.health.details ? `ollama — ${ollama.health.details}` : `ollama — ${ollamaStatusLabel}`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${STATUS_COLORS[ollama.health.status] ?? 'bg-gray-400'}`} />
              <span className="font-medium">ollama</span>
              <span>· {ollamaStatusLabel}</span>
            </div>
          )}

          {activeRun && (
            <div className="flex items-center gap-2 text-xs">
              <Link
                href={`/runs/${activeRun.id}`}
                className="max-w-30 truncate text-muted-foreground hover:underline"
              >
                {activeRun.idea}
              </Link>
              <span className="text-muted-foreground">
                {formatPipelineStepLabel(activeRun.currentStep)}
              </span>
              <span className={`font-mono ${costAlert ? 'animate-pulse font-bold text-red-500' : 'text-muted-foreground'}`}>
                {(activeRun.costEur ?? 0).toFixed(2)} €
              </span>
            </div>
          )}

          {meeting && (
            <div className="hidden items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] dark:border-blue-900/50 dark:bg-blue-950/30 md:flex">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="font-medium text-blue-700 dark:text-blue-300">
                Réunion
              </span>
              <span className="text-blue-500 dark:text-blue-400">
                · {meeting.progress}%
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {providers.filter((p) => p.name !== 'ollama').map((p) => (
            <div key={p.name} className="flex items-center gap-1" title={`${p.name} — ${p.health.status}`}>
              <span className={`inline-block h-2 w-2 rounded-full ${STATUS_COLORS[p.health.status] ?? 'bg-gray-400'}`} />
              <span className="text-[10px] text-muted-foreground">{p.name}</span>
            </div>
          ))}
          <ThemeToggle />
        </div>
      </div>

      {showOllamaBanner && ollama && (
        <div className="flex items-center justify-between border-t bg-amber-50 px-4 py-1.5 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
            <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
              Ollama
            </Badge>
            <span>
              État : {ollamaStatusLabel}
              {ollama.health.details ? ` — ${ollama.health.details}` : ''}
            </span>
          </div>
        </div>
      )}

      {meeting && activeRun && (
        <div className="flex items-center justify-between border-t bg-blue-50 px-4 py-1.5 dark:bg-blue-950/30">
          <div className="flex items-center gap-2 text-xs text-blue-800 dark:text-blue-200">
            <Badge variant="outline" className="border-blue-400 text-blue-700 dark:text-blue-300">
              Réunion
            </Badge>
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span>
              {meeting.nextSpeaker
                ? `${meeting.nextSpeakerLabel} réfléchit…`
                : 'Réunion terminée'}
            </span>
            <span className="text-blue-500 dark:text-blue-400">
              — Phase {meeting.phase.number}/6 · {meeting.phase.name} · {meeting.progress}%
            </span>
          </div>
          <Link
            href={`/runs/${activeRun.id}/studio`}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:underline"
          >
            Ouvrir le studio
          </Link>
        </div>
      )}

      {failovers.length > 0 && (
        <div className="flex items-center justify-between border-t bg-amber-50 px-4 py-1.5 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
            <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
              Failover
            </Badge>
            <span>
              {failovers[0].original} indisponible — basculé sur {failovers[0].fallback}
              {' '}({new Date(failovers[0].timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})
            </span>
            {failovers.length > 1 && (
              <span className="text-amber-600 dark:text-amber-400">
                +{failovers.length - 1} autre{failovers.length > 2 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={dismissFailovers}
            className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
          >
            Fermer
          </button>
        </div>
      )}
    </header>
  )
}
