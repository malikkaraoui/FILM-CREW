'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (data: { name: string; langSource: string; audience?: string }) => void
}

export function CreateChainDialog({ open, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState('')
  const [langSource, setLangSource] = useState('fr')
  const [audience, setAudience] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onCreate({ name: name.trim(), langSource, audience: audience.trim() || undefined })
    setName('')
    setAudience('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle chaîne</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">Nom</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Actu Sport FR" />
          </div>
          <div>
            <Label htmlFor="lang">Langue source</Label>
            <Input id="lang" value={langSource} onChange={(e) => setLangSource(e.target.value)} placeholder="fr" />
          </div>
          <div>
            <Label htmlFor="audience">Audience cible (optionnel)</Label>
            <Input id="audience" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="18-35 ans, fans de sport" />
          </div>
          <Button type="submit" disabled={!name.trim()}>Créer</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
