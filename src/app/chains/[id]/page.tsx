'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandKitForm } from '@/components/brand-kit/brand-kit-form'
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

export default function ChainDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [chain, setChain] = useState<Chain | null>(null)
  const [name, setName] = useState('')
  const [langSource, setLangSource] = useState('')
  const [audience, setAudience] = useState('')
  const [saving, setSaving] = useState(false)
  const [runs, setRuns] = useState<Run[]>([])

  useEffect(() => {
    fetch(`/api/chains/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setChain(json.data)
          setName(json.data.name)
          setLangSource(json.data.langSource)
          setAudience(json.data.audience || '')
        }
      })

    fetch('/api/runs')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setRuns((json.data as Run[]).filter((r) => r.chainId === id).slice(0, 5))
      })
  }, [id])

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/chains/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, langSource, audience }),
    })
    setSaving(false)
  }

  async function handleDuplicate() {
    const res = await fetch(`/api/chains/${id}/duplicate`, { method: 'POST' })
    const json = await res.json()
    if (json.data) {
      router.push(`/chains/${json.data.id}`)
    }
  }

  async function handleDelete() {
    if (!confirm('Supprimer cette chaîne et tous ses fichiers ?')) return
    await fetch(`/api/chains/${id}`, { method: 'DELETE' })
    router.push('/chains')
  }

  if (!chain) return <p className="text-sm text-muted-foreground">Chargement...</p>

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold">{chain.name}</h1>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <Label htmlFor="name">Nom</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="lang">Langue source</Label>
          <Input id="lang" value={langSource} onChange={(e) => setLangSource(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="audience">Audience cible</Label>
          <Input id="audience" value={audience} onChange={(e) => setAudience(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
          <Button variant="outline" onClick={handleDuplicate}>
            Dupliquer
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Supprimer
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Brand Kit</h2>
        <BrandKitForm chainId={id} />
      </div>

      {/* Runs de cette chaîne */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Runs</h2>
          <Link href="/runs/new">
            <Button variant="outline" size="sm">Lancer un run</Button>
          </Link>
        </div>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun run pour cette chaîne.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {runs.map((r) => (
              <Link
                key={r.id}
                href={`/runs/${r.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/50"
              >
                <span className="min-w-0 truncate">{r.idea}</span>
                <div className="ml-3 flex shrink-0 items-center gap-3">
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

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Publication</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Comptes de publication (TikTok, YouTube…) — non configuré dans cette version.
        </p>
      </div>
    </div>
  )
}
