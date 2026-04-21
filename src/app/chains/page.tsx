'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CreateChainDialog } from '@/components/brand-kit/create-chain-dialog'
import Link from 'next/link'
import type { Chain } from '@/types/chain'
import type { Run } from '@/types/run'

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

export default function ChainsPage() {
  const [chains, setChains] = useState<Chain[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [open, setOpen] = useState(false)

  async function loadChains() {
    const res = await fetch('/api/chains')
    const json = await res.json()
    if (json.data) setChains(json.data)
  }

  useEffect(() => {
    void loadChains()
    fetch('/api/runs')
      .then((r) => r.json())
      .then((json) => { if (json.data) setRuns(json.data) })
  }, [])

  async function handleCreate(data: { name: string; langSource: string; audience?: string }) {
    const res = await fetch('/api/chains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      setOpen(false)
      loadChains()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette chaîne et tous ses fichiers ?')) return
    await fetch(`/api/chains/${id}`, { method: 'DELETE' })
    loadChains()
  }

  // Dernier run par chaîne (runs est trié par createdAt desc)
  function lastRunForChain(chainId: string): Run | null {
    return runs.find((r) => r.chainId === chainId) ?? null
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Chaînes</h1>
        <Button onClick={() => setOpen(true)}>Nouvelle chaîne</Button>
      </div>

      {chains.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Aucune chaîne. Créez-en une pour commencer.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {chains.map((c) => {
            const last = lastRunForChain(c.id)
            return (
              <Card key={c.id}>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">
                      <Link href={`/chains/${c.id}`} className="hover:underline">
                        {c.name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-3 text-xs">
                      <span>{c.langSource.toUpperCase()}{c.audience && ` · ${c.audience}`}</span>
                      {last && (
                        <span className={`font-medium ${STATUS_CLASSES[last.status] ?? ''}`}>
                          {STATUS_LABELS[last.status] ?? last.status}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={`/runs/new?chainId=${c.id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs">Lancer</Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="text-destructive">
                      Supprimer
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      )}

      <CreateChainDialog open={open} onOpenChange={setOpen} onCreate={handleCreate} />
    </div>
  )
}
