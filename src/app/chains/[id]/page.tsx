'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandKitForm } from '@/components/brand-kit/brand-kit-form'
import type { Chain } from '@/types/chain'

export default function ChainDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [chain, setChain] = useState<Chain | null>(null)
  const [name, setName] = useState('')
  const [langSource, setLangSource] = useState('')
  const [audience, setAudience] = useState('')
  const [saving, setSaving] = useState(false)

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
          <Button variant="destructive" onClick={handleDelete}>
            Supprimer
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Brand Kit</h2>
        <BrandKitForm chainId={id} />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Publication</h2>
        <p className="text-sm text-muted-foreground">Comptes liés par plateforme — à venir</p>
      </div>
    </div>
  )
}
