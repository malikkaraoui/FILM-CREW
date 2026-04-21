'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { Chain } from '@/types/chain'
import type { Run } from '@/types/run'

type ActiveRun = {
  id: string
  idea: string
  currentStep: number | null
  costEur: number | null
  status: string
}

type QueueState = {
  pendingCount: number
  runningCount: number
  active: ActiveRun | null
  queue: ActiveRun[]
}

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

export default function Dashboard() {
  const [chains, setChains] = useState<Chain[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [queue, setQueue] = useState<QueueState | null>(null)

  useEffect(() => {
    fetch('/api/chains')
      .then((r) => r.json())
      .then((json) => { if (json.data) setChains(json.data) })

    fetch('/api/runs')
      .then((r) => r.json())
      .then((json) => { if (json.data) setRuns(json.data) })

    fetch('/api/queue')
      .then((r) => r.json())
      .then((json) => { if (json.data) setQueue(json.data) })
  }, [])

  const chainMap = Object.fromEntries(chains.map((c) => [c.id, c]))
  const lastRuns = runs.slice(0, 5)
  const activeRunFull = queue?.active ? runs.find((r) => r.id === queue.active!.id) ?? null : null

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tour de contrôle</h1>
          <p className="text-xs text-muted-foreground">
            {chains.length} chaîne{chains.length !== 1 ? 's' : ''} · {runs.length} run{runs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {queue?.active && (
            <Link href={`/runs/${queue.active.id}`}>
              <Button variant="outline" size="sm">Voir le run actif</Button>
            </Link>
          )}
          <Link href="/runs/new">
            <Button size="sm">Lancer un run</Button>
          </Link>
        </div>
      </div>

      {/* Run actif */}
      {queue?.active ? (
        <Card className="border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Run en cours — Étape {queue.active.currentStep ?? '?'}/8
                </CardTitle>
                <CardDescription className="mt-0.5 truncate text-xs">
                  {queue.active.idea}
                  {activeRunFull && chainMap[activeRunFull.chainId] && (
                    <span className="ml-1 text-muted-foreground">· {chainMap[activeRunFull.chainId].name}</span>
                  )}
                </CardDescription>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-sm text-blue-700 dark:text-blue-300">
                  {(queue.active.costEur ?? 0).toFixed(2)} €
                </span>
                <Link href={`/runs/${queue.active.id}`}>
                  <Button size="sm" variant="outline" className="h-7 text-xs">Suivre</Button>
                </Link>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : queue?.pendingCount ? (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/20">
          <span className="text-amber-600 dark:text-amber-400">
            {queue.pendingCount} run{queue.pendingCount > 1 ? 's' : ''} en attente
          </span>
          <Link href="/runs" className="text-xs text-amber-500 hover:underline">Voir la queue</Link>
        </div>
      ) : null}

      {/* Chaînes */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chaînes</h2>
          <Link href="/chains" className="text-xs text-muted-foreground hover:underline">Gérer</Link>
        </div>
        {chains.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune chaîne.{' '}
            <Link href="/chains" className="underline">Créez-en une</Link> pour commencer.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chains.map((c) => {
              const chainRuns = runs.filter((r) => r.chainId === c.id)
              const lastRun = chainRuns[0] ?? null
              return (
                <Link key={c.id} href={`/chains/${c.id}`}>
                  <Card className="cursor-pointer transition-colors hover:bg-accent/50">
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <CardDescription className="flex items-center justify-between text-xs">
                        <span>{c.langSource.toUpperCase()}{c.audience && ` · ${c.audience}`}</span>
                        {lastRun && (
                          <span className={`font-medium ${STATUS_CLASSES[lastRun.status] ?? ''}`}>
                            {STATUS_LABELS[lastRun.status] ?? lastRun.status}
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Derniers runs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Derniers runs</h2>
          <Link href="/runs" className="text-xs text-muted-foreground hover:underline">Tous les runs</Link>
        </div>
        {lastRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun run.{' '}
            <Link href="/runs/new" className="underline">Lancez votre première production.</Link>
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {lastRuns.map((r) => (
              <Link
                key={r.id}
                href={`/runs/${r.id}`}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent/50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="truncate">{r.idea}</span>
                  {chainMap[r.chainId] && (
                    <span className="shrink-0 text-xs text-muted-foreground">{chainMap[r.chainId].name}</span>
                  )}
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-3">
                  <span className={`text-xs font-medium ${STATUS_CLASSES[r.status] ?? ''}`}>
                    {r.status === 'running' && r.currentStep
                      ? `Étape ${r.currentStep}/8`
                      : (STATUS_LABELS[r.status] ?? r.status)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{(r.costEur ?? 0).toFixed(2)} €</span>
                  <span className="text-xs text-muted-foreground">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '-'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
