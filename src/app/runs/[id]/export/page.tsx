'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Metadata = {
  description?: string
  hashtags?: string[]
  title_variants?: Record<string, string>
}

type ArtifactInfo = { name: string; sizeBytes: number }

type PreviewManifest = {
  mode: 'video_finale' | 'animatic' | 'storyboard_only' | 'none'
  playableFilePath: string | null
  mediaType: string | null
  hasAudio: boolean
  mediaFile: string | null
}

const MODE_LABELS: Record<string, string> = {
  video_finale: 'Vidéo finale',
  animatic: 'Animatic',
  storyboard_only: 'Storyboard seul',
  none: 'Aucun média',
}

export default function ExportPage() {
  const { id } = useParams<{ id: string }>()
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [manifest, setManifest] = useState<PreviewManifest | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([])
  const [imageCount, setImageCount] = useState(0)
  const [loadingArtifacts, setLoadingArtifacts] = useState(false)

  const loadExportData = async () => {
    const res = await fetch(`/api/runs/${id}/export`)
    const json = await res.json()
    if (json.data) setMetadata(json.data.metadata)
  }

  const loadManifest = async () => {
    try {
      const res = await fetch(`/api/runs/${id}/preview-manifest`)
      if (res.ok) {
        const json = await res.json()
        if (json.data) setManifest(json.data)
      }
    } catch { /* silencieux */ }
  }

  useEffect(() => {
    void Promise.all([loadExportData(), loadManifest()])
  }, [id])

  async function handleRegenerate() {
    setRegenerating(true)
    const res = await fetch(`/api/runs/${id}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'regenerate_metadata' }),
    })
    const json = await res.json()
    if (json.data) setMetadata(json.data)
    setRegenerating(false)
  }

  async function handleListArtifacts() {
    setLoadingArtifacts(true)
    const res = await fetch(`/api/runs/${id}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'download_artifacts' }),
    })
    const json = await res.json()
    if (json.data) {
      setArtifacts(json.data.artifacts)
      setImageCount(json.data.storyboardImages?.length ?? 0)
    }
    setLoadingArtifacts(false)
  }

  const hasPlayable = !!(manifest?.playableFilePath)
  const mode = manifest?.mode ?? 'none'

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Artefacts & Export</h1>
        {manifest && (
          <Badge variant={mode === 'video_finale' ? 'default' : mode === 'animatic' ? 'secondary' : 'outline'}>
            {MODE_LABELS[mode] ?? mode}
          </Badge>
        )}
      </div>

      {/* État média honnête */}
      {hasPlayable ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {mode === 'video_finale'
            ? 'Vidéo finale disponible — clips vidéo réels assemblés.'
            : 'Animatic disponible — slideshow storyboard' + (manifest?.hasAudio ? ' + audio' : '') + '.'}
          {' '}Fichier : <code className="text-[11px]">{manifest?.mediaFile ?? 'final/'}</code>
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {mode === 'storyboard_only'
            ? 'Storyboard disponible, mais aucun fichier média playable assemblé.'
            : 'Aucun fichier média playable. Les artefacts texte et storyboard restent consultables ci-dessous.'}
        </div>
      )}

      {/* Métadonnées */}
      <Card>
        <CardHeader className="py-3 space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Métadonnées</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              {regenerating ? 'Génération...' : 'Régénérer via IA'}
            </Button>
          </div>

          {metadata ? (
            <div className="space-y-2">
              <CardDescription>{metadata.description || 'Aucune description'}</CardDescription>
              {metadata.hashtags && metadata.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {metadata.hashtags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
              )}
              {metadata.title_variants && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {Object.entries(metadata.title_variants).map(([platform, title]) => (
                    <div key={platform}><span className="font-medium">{platform}:</span> {title}</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <CardDescription>Pas encore de métadonnées. Cliquez sur Régénérer via IA.</CardDescription>
          )}
        </CardHeader>
      </Card>

      {/* Artefacts du run */}
      <Card>
        <CardHeader className="py-3 space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Artefacts du run</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleListArtifacts}
              disabled={loadingArtifacts}
            >
              {loadingArtifacts ? 'Chargement...' : 'Lister les fichiers'}
            </Button>
          </div>

          {artifacts.length > 0 ? (
            <div className="space-y-1">
              {artifacts.map((a) => (
                <div key={a.name} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground">{a.name}</span>
                  <span className="text-muted-foreground">{(a.sizeBytes / 1024).toFixed(1)} KB</span>
                </div>
              ))}
              {imageCount > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  + {imageCount} image(s) storyboard (PNG)
                </div>
              )}
            </div>
          ) : (
            <CardDescription>
              Cliquez sur Lister pour voir les artefacts produits par le pipeline.
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      <p className="text-xs text-muted-foreground">
        Les artefacts sont disponibles dans <code className="text-[10px]">storage/runs/{id}/</code>.
      </p>
    </div>
  )
}
