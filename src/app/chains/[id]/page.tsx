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

type PublicationAccount = {
  id: string
  chainId: string
  platform: string
  isActive: number
  createdAt: string | null
}

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X (Twitter)',
}

const ALLOWED_PLATFORMS = ['tiktok', 'youtube', 'instagram', 'facebook', 'x']

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
  const [publicationAccounts, setPublicationAccounts] = useState<PublicationAccount[]>([])
  const [addingPlatform, setAddingPlatform] = useState('tiktok')
  const [addingAccount, setAddingAccount] = useState(false)

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

    fetch(`/api/chains/${id}/publication-accounts`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setPublicationAccounts(json.data)
      })
  }, [id])

  async function handleAddAccount() {
    setAddingAccount(true)
    const res = await fetch(`/api/chains/${id}/publication-accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: addingPlatform }),
    })
    const json = await res.json()
    if (json.data) setPublicationAccounts((prev) => [...prev, json.data])
    setAddingAccount(false)
  }

  async function handleDeleteAccount(accountId: string) {
    await fetch(`/api/chains/${id}/publication-accounts/${accountId}`, { method: 'DELETE' })
    setPublicationAccounts((prev) => prev.filter((a) => a.id !== accountId))
  }

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
          <Link href={`/runs/new?chainId=${id}`}>
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

      {/* Comptes de publication */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Publication</h2>

        {publicationAccounts.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Aucun compte de publication lié à cette chaîne.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-1">
            {publicationAccounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">{PLATFORM_LABELS[a.platform] ?? a.platform}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-destructive"
                  onClick={() => handleDeleteAccount(a.id)}
                >
                  Retirer
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <select
            value={addingPlatform}
            onChange={(e) => setAddingPlatform(e.target.value)}
            className="flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
          >
            {ALLOWED_PLATFORMS.map((p) => (
              <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={handleAddAccount} disabled={addingAccount}>
            {addingAccount ? 'Ajout...' : 'Lier ce compte'}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Les credentials (tokens) sont configurés via les variables d'environnement, pas dans l'UI.
        </p>
      </div>
    </div>
  )
}
