'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

type Clip = {
  id: string
  stepIndex: number
  prompt: string
  provider: string
  status: string
  filePath: string | null
  seed: number | null
  costEur: number | null
}

type StoryboardImage = {
  sceneIndex: number
  description: string
  filePath: string
  status: 'pending' | 'generated' | 'validated' | 'rejected'
}

type PreviewManifest = {
  mode: 'video_finale' | 'animatic' | 'storyboard_only' | 'none'
  playableFilePath: string | null
  mediaType: string | null
  hasAudio: boolean
  assemblyError: string | null
}

const MODE_LABELS: Record<string, string> = {
  video_finale: 'Vidéo finale',
  animatic: 'Animatic',
  storyboard_only: 'Storyboard seul',
  none: 'Aucun média',
}

const MODE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  video_finale: 'default',
  animatic: 'secondary',
  storyboard_only: 'outline',
  none: 'destructive',
}

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>()
  const [clips, setClips] = useState<Clip[]>([])
  const [storyboard, setStoryboard] = useState<StoryboardImage[]>([])
  const [manifest, setManifest] = useState<PreviewManifest | null>(null)
  const [loading, setLoading] = useState(true)

  const loadClips = async () => {
    try {
      const res = await fetch(`/api/runs/${id}/clips`)
      const json = await res.json()
      if (json.data) setClips(json.data)
    } catch { /* silencieux */ }
  }

  const loadStoryboard = async () => {
    try {
      const res = await fetch(`/api/runs/${id}/storyboard`)
      const json = await res.json()
      if (json.data?.images) setStoryboard(json.data.images)
    } catch { /* silencieux */ }
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
    void Promise.all([loadClips(), loadStoryboard(), loadManifest()]).then(() => setLoading(false))
  }, [id])

  if (loading) return <p className="text-sm text-muted-foreground">Chargement...</p>

  const completedClips = clips.filter(c => c.status === 'completed')
  const generatedImages = storyboard.filter(i => i.status === 'generated')
  const hasPlayable = !!(manifest?.playableFilePath)
  const hasClips = completedClips.length > 0
  const hasStoryboard = generatedImages.length > 0
  const mode = manifest?.mode ?? 'none'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Preview</h1>
        <Badge variant={MODE_VARIANTS[mode] ?? 'outline'}>
          {MODE_LABELS[mode] ?? mode}
        </Badge>
        {manifest?.hasAudio && (
          <Badge variant="outline" className="text-xs">Audio</Badge>
        )}
      </div>

      {/* Player vidéo ou animatic */}
      {hasPlayable && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {mode === 'video_finale'
              ? 'Clips vidéo réels assemblés'
              : 'Animatic — slideshow storyboard' + (manifest?.hasAudio ? ' + audio' : '')}
          </p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            controls
            className="w-full max-w-xs rounded-lg border bg-black"
            style={{ aspectRatio: '9/16' }}
            src={`/api/runs/${id}/media`}
            preload="metadata"
          />
        </div>
      )}

      {/* Erreur d'assemblage */}
      {manifest?.assemblyError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          Erreur assemblage : {manifest.assemblyError}
        </div>
      )}

      {/* État réel du run (quand pas de playable) */}
      {!hasPlayable && (
        <div className="rounded-md border p-3 text-sm">
          {hasClips ? (
            <p className="text-amber-700">{completedClips.length} clip(s) présent(s) — assemblage non encore exécuté (step 7 non atteint).</p>
          ) : hasStoryboard ? (
            <p className="text-amber-700">Storyboard disponible. Pas de clips vidéo (providers non configurés). Aucun animatic assemblé.</p>
          ) : (
            <p className="text-muted-foreground">Aucun artefact visuel disponible. Le pipeline doit atteindre au moins le step 4 (Storyboard).</p>
          )}
        </div>
      )}

      {/* Storyboard comme preview visuelle */}
      {hasStoryboard && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium">Storyboard — {generatedImages.length} scène(s)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {generatedImages.map((img) => (
              <div key={img.sceneIndex} className="rounded-lg border overflow-hidden">
                <div className="aspect-[9/16] bg-muted relative">
                  <span className="absolute top-2 left-2 rounded-full bg-background/80 px-2 py-0.5 text-xs font-mono">
                    {img.sceneIndex}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/runs/${id}/storyboard/image/${img.sceneIndex}`}
                    alt={`Scène ${img.sceneIndex}`}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
                <div className="p-2">
                  <p className="text-xs text-muted-foreground line-clamp-2">{img.description}</p>
                  <Badge variant="secondary" className="text-[9px] mt-1">
                    {img.status === 'generated' ? 'Généré' : img.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline clips si présents */}
      {hasClips && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium">Clips vidéo — {completedClips.length}</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className="flex-shrink-0 w-28 rounded-lg border p-2"
              >
                <div className="aspect-[9/16] rounded bg-muted flex items-center justify-center mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{clip.stepIndex}</span>
                </div>
                <Badge
                  variant={clip.status === 'completed' ? 'default' : 'destructive'}
                  className="text-[9px] w-full justify-center"
                >
                  {clip.status === 'completed' ? 'OK' : 'Échec'}
                </Badge>
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{clip.prompt}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
