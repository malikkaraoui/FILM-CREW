'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Run } from '@/types/run'

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([])

  useEffect(() => {
    fetch('/api/runs')
      .then((r) => r.json())
      .then((json) => { if (json.data) setRuns(json.data) })
  }, [])

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
                <td className="py-2">{r.status}</td>
                <td className="py-2">{(r.costEur ?? 0).toFixed(2)} €</td>
                <td className="py-2">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
