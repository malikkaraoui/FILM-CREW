'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  chainId: string
}

export function BrandKitForm({ chainId }: Props) {
  const [palette, setPalette] = useState('')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    setMessage('')

    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('type', 'image')
      form.append('file', file)
      await fetch(`/api/chains/${chainId}/brand-kit`, { method: 'POST', body: form })
    }

    setUploading(false)
    setMessage(`${files.length} image(s) envoyée(s)`)
  }

  async function handleVoiceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMessage('')

    const form = new FormData()
    form.append('type', 'voice')
    form.append('file', file)
    await fetch(`/api/chains/${chainId}/brand-kit`, { method: 'POST', body: form })

    setUploading(false)
    setMessage('Voix envoyée')
  }

  async function handleSavePalette() {
    if (!palette.trim()) return
    setUploading(true)

    const brandData = JSON.stringify({ palette: palette.split(',').map((c) => c.trim()) }, null, 2)
    const form = new FormData()
    form.append('type', 'brand_json')
    form.append('data', brandData)
    await fetch(`/api/chains/${chainId}/brand-kit`, { method: 'POST', body: form })

    setUploading(false)
    setMessage('Palette sauvegardée')
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Images de référence (JPG, PNG, WebP)</Label>
        <Input type="file" accept="image/*" multiple onChange={handleImageUpload} disabled={uploading} />
      </div>

      <div>
        <Label>Voix designée (WAV, MP3, M4A)</Label>
        <Input type="file" accept="audio/*" onChange={handleVoiceUpload} disabled={uploading} />
      </div>

      <div>
        <Label htmlFor="palette">Palette couleur (hex séparés par des virgules)</Label>
        <div className="flex gap-2">
          <Input
            id="palette"
            value={palette}
            onChange={(e) => setPalette(e.target.value)}
            placeholder="#FF5733, #33FF57, #3357FF"
            disabled={uploading}
          />
          <Button onClick={handleSavePalette} disabled={uploading || !palette.trim()}>
            Sauver
          </Button>
        </div>
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}
