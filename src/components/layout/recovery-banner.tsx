'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Run } from '@/types/run'

export function RecoveryBanner() {
  const [interrupted, setInterrupted] = useState<Run | null>(null)
  const [resolved, setResolved] = useState<number | null>(null)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    fetch('/api/runs/recovery')
      .then((r) => r.json())
      .then((json) => { if (json.data) setInterrupted(json.data) })
      .catch(() => { /* silencieux */ })
  }, [])

  async function handleResolve() {
    setResolving(true)
    try {
      const res = await fetch('/api/runs/recovery', { method: 'POST' })
      const json = await res.json()
      setResolved(json.data?.recovered ?? 0)
      setInterrupted(null)
    } finally {
      setResolving(false)
    }
  }

  if (resolved !== null) {
    return (
      <div className="flex items-center justify-between border-b bg-green-50 px-4 py-2 text-sm dark:bg-green-950">
        <span>{resolved} run{resolved !== 1 ? 's' : ''} zombie{resolved !== 1 ? 's' : ''} résolu{resolved !== 1 ? 's' : ''} automatiquement.</span>
        <Button size="sm" variant="outline" onClick={() => setResolved(null)}>Fermer</Button>
      </div>
    )
  }

  if (!interrupted) return null

  return (
    <div className="flex items-center justify-between border-b bg-amber-50 px-4 py-2 text-sm dark:bg-amber-950">
      <span>
        Run interrompu détecté : « {interrupted.idea} » — étape {interrupted.currentStep}/8
      </span>
      <Button size="sm" variant="outline" onClick={handleResolve} disabled={resolving}>
        {resolving ? 'Résolution…' : 'Résoudre'}
      </Button>
    </div>
  )
}
