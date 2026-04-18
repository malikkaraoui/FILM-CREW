'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AgentChat } from '@/components/studio/agent-chat'

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

  useEffect(() => {
    loadTraces()
    const interval = setInterval(loadTraces, 3_000)
    return () => clearInterval(interval)
  }, [id])

  async function loadTraces() {
    try {
      const res = await fetch(`/api/runs/${id}/traces`)
      const json = await res.json()
      if (json.data) setTraces(json.data)
    } catch { /* silencieux */ }
    setLoading(false)
  }

  async function startMeeting() {
    setRunning(true)
    setError('')
    try {
      const res = await fetch(`/api/runs/${id}/meeting`, { method: 'POST' })
      const json = await res.json()
      if (json.error) {
        setError(json.error.message)
      } else {
        await loadTraces()
      }
    } catch (e) {
      setError((e as Error).message)
    }
    setRunning(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Studio Virtuel</h1>
        <Button
          onClick={startMeeting}
          disabled={running}
          size="sm"
        >
          {running ? 'Réunion en cours...' : 'Lancer la réunion'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <AgentChat traces={traces} loading={loading} />
    </div>
  )
}
