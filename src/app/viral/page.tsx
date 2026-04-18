'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Segment = {
  index: number
  start_s: number
  end_s: number
  title: string
  reason: string
  excerpt: string
}

export default function ViralPage() {
  const [url, setUrl] = useState('')
  const [instruction, setInstruction] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [segments, setSegments] = useState<Segment[]>([])
  const [viralId, setViralId] = useState<string | null>(null)

  async function handleLaunch() {
    if (!url.trim()) return
    setRunning(true)
    setError('')
    setSegments([])

    try {
      const res = await fetch('/api/viral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), instruction: instruction.trim() || undefined }),
      })
      const json = await res.json()
      if (json.error) {
        setError(json.error.message)
      } else if (json.data) {
        setViralId(json.data.id)
        setSegments(json.data.segments ?? [])
      }
    } catch (e) {
      setError((e as Error).message)
    }
    setRunning(false)
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Découpage viral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Collez une URL YouTube pour extraire des shorts viraux.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="url">URL YouTube</Label>
          <Input
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>

        <div>
          <Label htmlFor="instruction">Consigne (optionnel)</Label>
          <Input
            id="instruction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Focus sur les clashs, les moments drôles..."
          />
        </div>

        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button onClick={handleLaunch} disabled={running || !url.trim()}>
          {running ? 'Analyse en cours...' : 'Lancer'}
        </Button>
      </div>

      {/* Résultats */}
      {segments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            {segments.length} segment{segments.length > 1 ? 's' : ''} détecté{segments.length > 1 ? 's' : ''}
          </h2>

          {segments.map((seg) => (
            <Card key={seg.index}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{seg.title}</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {formatTime(seg.start_s)} → {formatTime(seg.end_s)}
                    {' '}({seg.end_s - seg.start_s}s)
                  </Badge>
                </div>
                <CardDescription className="text-xs">{seg.reason}</CardDescription>
                {seg.excerpt && (
                  <p className="text-xs text-muted-foreground italic mt-1">
                    &laquo; {seg.excerpt} &raquo;
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" className="text-xs">
                    Recadrer 9:16
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs">
                    Ajouter sous-titres
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
