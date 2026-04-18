'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import type { Chain } from '@/types/chain'

type CostBreakdown = {
  step: string
  provider: string
  costEur: number
  note: string
}

type CostEstimate = {
  totalEur: number
  breakdown: CostBreakdown[]
  warning: string | null
}

export default function NewRunPage() {
  const router = useRouter()
  const [chains, setChains] = useState<Chain[]>([])
  const [chainId, setChainId] = useState('')
  const [idea, setIdea] = useState('')
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState('')
  const [estimate, setEstimate] = useState<CostEstimate | null>(null)
  const [loadingEstimate, setLoadingEstimate] = useState(true)

  useEffect(() => {
    fetch('/api/chains')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setChains(json.data)
          if (json.data.length > 0) setChainId(json.data[0].id)
        }
      })

    fetch('/api/runs/estimate')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setEstimate(json.data)
      })
      .finally(() => setLoadingEstimate(false))
  }, [])

  async function handleLaunch() {
    if (!chainId || !idea.trim()) return
    setLaunching(true)
    setError('')

    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId, idea: idea.trim() }),
    })
    const json = await res.json()

    if (json.error) {
      setError(json.error.message)
      setLaunching(false)
      return
    }

    router.push(`/runs/${json.data.id}`)
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold">Nouveau run</h1>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <Label htmlFor="chain">Chaîne</Label>
          <select
            id="chain"
            value={chainId}
            onChange={(e) => setChainId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            {chains.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="idea">Idée</Label>
          <Input
            id="idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="La polémique Mbappé expliquée en 90 secondes"
          />
        </div>

        {/* Estimation de coût */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Coût estimé</CardTitle>
            {loadingEstimate ? (
              <p className="text-xs text-muted-foreground">Calcul en cours...</p>
            ) : estimate ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">{estimate.totalEur.toFixed(2)} €</span>
                  <span className="text-xs text-muted-foreground">estimation moyenne</span>
                </div>

                <div className="space-y-1">
                  {estimate.breakdown
                    .filter((b) => b.costEur > 0)
                    .map((b) => (
                      <div key={b.step} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{b.step}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground">{b.provider}</span>
                          <span className="font-mono">{b.costEur.toFixed(2)} €</span>
                        </span>
                      </div>
                    ))}
                </div>

                {estimate.warning && (
                  <div className="rounded-md border border-amber-400 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    {estimate.warning}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Estimation indisponible</p>
            )}
          </CardHeader>
        </Card>

        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button onClick={handleLaunch} disabled={launching || !chainId || !idea.trim()}>
          {launching ? 'Lancement...' : 'Lancer'}
        </Button>
      </div>
    </div>
  )
}
