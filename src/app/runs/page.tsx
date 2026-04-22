'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Run } from '@/types/run'
import type { Chain } from '@/types/chain'
import { formatPipelineStepLabel } from '@/lib/pipeline/constants'

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  running: 'En cours',
  completed: 'Terminé',
  failed: 'Échoué',
  killed: 'Arrêté',
}

const STATUS_CLASSES: Record<string, string> = {
  pending: 'text-amber-500',
  running: 'text-blue-500',
  completed: 'text-green-600',
  failed: 'text-red-500',
  killed: 'text-muted-foreground',
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [chains, setChains] = useState<Chain[]>([])

  useEffect(() => {
    fetch('/api/runs')
      .then((r) => r.json())
      .then((json) => { if (json.data) setRuns(json.data) })

    fetch('/api/chains')
      .then((r) => r.json())
      .then((json) => { if (json.data) setChains(json.data) })
  }, [])

  const chainMap = Object.fromEntries(chains.map((c) => [c.id, c]))

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Runs</h1>
        <Link href="/runs/new">
          <Button>Nouveau run</Button>
        </Link>
      </div>

      {runs.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Aucun run. Lancez votre première production.
        </p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 font-medium">Idée</th>
              <th className="py-2 font-medium">Chaîne</th>
              <th className="py-2 font-medium">Statut</th>
              <th className="py-2 font-medium">Coût</th>
              <th className="py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b hover:bg-accent/30">
                <td className="py-2">
                  <Link href={`/runs/${r.id}`} className="hover:underline">
                    {r.idea}
                  </Link>
                </td>
                <td className="py-2 text-muted-foreground">
                  {r.chainId && chainMap[r.chainId]
                    ? <Link href={`/chains/${r.chainId}`} className="hover:underline">{chainMap[r.chainId].name}</Link>
                    : <span className="text-xs">{r.chainId ? `${r.chainId.slice(0, 8)}…` : 'Sans chaîne'}</span>
                  }
                </td>
                <td className="py-2">
                  <span className={`font-medium ${STATUS_CLASSES[r.status] ?? ''}`}>
                    {r.status === 'running' && r.currentStep
                      ? formatPipelineStepLabel(r.currentStep)
                      : (STATUS_LABELS[r.status] ?? r.status)}
                  </span>
                </td>
                <td className="py-2 font-mono">{(r.costEur ?? 0).toFixed(2)} €</td>
                <td className="py-2 text-muted-foreground">
                  {r.createdAt
                    ? new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
