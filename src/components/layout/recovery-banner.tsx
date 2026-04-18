'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Run } from '@/types/run'

export function RecoveryBanner() {
  const [interrupted, setInterrupted] = useState<Run | null>(null)

  useEffect(() => {
    fetch('/api/runs/recovery')
      .then((r) => r.json())
      .then((json) => { if (json.data) setInterrupted(json.data) })
  }, [])

  if (!interrupted) return null

  return (
    <div className="flex items-center justify-between border-b bg-amber-50 px-4 py-2 text-sm dark:bg-amber-950">
      <span>
        Run interrompu détecté : « {interrupted.idea} » — étape {interrupted.currentStep}/8
      </span>
      <Link href={`/runs/${interrupted.id}`}>
        <Button size="sm" variant="outline">Reprendre</Button>
      </Link>
    </div>
  )
}
