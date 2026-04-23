'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Run } from '@/types/run'
import type { Chain } from '@/types/chain'
import { getProjectStatusClass, getProjectStatusLabel, getRunLandingHref, getRunStepLabel } from '@/lib/runs/presentation'

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Projets</h1>
          <p className="text-sm text-muted-foreground">
            Vue globale des projets, de leur étape courante et de leur historique.
          </p>
        </div>
        <Link href="/runs/new">
          <Button>Nouveau projet</Button>
        </Link>
      </div>

      {runs.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Aucun projet. Crée ton premier projet depuis une chaîne ou depuis cette page.
        </p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 font-medium">Projet</th>
              <th className="py-2 font-medium">Chaîne</th>
              <th className="py-2 font-medium">Étape</th>
              <th className="py-2 font-medium">Statut</th>
              <th className="py-2 font-medium">Coût</th>
              <th className="py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b hover:bg-accent/30">
                <td className="py-2">
                  <Link href={getRunLandingHref(r)} className="font-medium hover:underline">
                    {r.idea}
                  </Link>
                </td>
                <td className="py-2 text-muted-foreground">
                  {r.chainId && chainMap[r.chainId]
                    ? <Link href={`/chains/${r.chainId}`} className="hover:underline">{chainMap[r.chainId].name}</Link>
                    : <span className="text-xs">{r.chainId ? `${r.chainId.slice(0, 8)}…` : 'Sans chaîne'}</span>
                  }
                </td>
                <td className="py-2 text-muted-foreground">
                  {getRunStepLabel(r)}
                </td>
                <td className="py-2">
                  <span className={`font-medium ${getProjectStatusClass(r.status)}`}>
                    {getProjectStatusLabel(r)}
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
