'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SketchSessionStatus } from '@/lib/sketch/sketch-types'

export default function TestSketchPage() {
  // Étape 1 : idée brute
  const [idea, setIdea] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('mistral:latest')
  const [enriching, setEnriching] = useState(false)

  // Étape 2 : texte enrichi (éditable)
  const [enrichedText, setEnrichedText] = useState('')
  const [enrichMeta, setEnrichMeta] = useState<{ model: string; latencyMs: number } | null>(null)

  // Étape 3 : génération sketch
  const [generating, setGenerating] = useState(false)
  const [sketchId, setSketchId] = useState<string | null>(null)
  const [sketchStatus, setSketchStatus] = useState<SketchSessionStatus | null>(null)
  const [generationError, setGenerationError] = useState('')

  // Charger les modèles Ollama au mount
  useEffect(() => {
    fetch('/api/test/ollama-models')
      .then((r) => r.json())
      .then((data) => {
        if (data.models?.length) {
          setModels(data.models)
          // Garder mistral par défaut s'il existe, sinon le premier
          if (!data.models.includes('mistral:latest')) {
            setSelectedModel(data.models[0])
          }
        }
      })
      .catch(() => {})
  }, [])

  async function handleEnrich() {
    setEnriching(true)
    setEnrichedText('')
    setEnrichMeta(null)
    setGenerationError('')
    setSketchId(null)
    setSketchStatus(null)
    try {
      const res = await fetch('/api/test/sketch-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, model: selectedModel }),
      })
      const json = await res.json()
      if (json.success) {
        setEnrichedText(json.enrichedText)
        setEnrichMeta({ model: json.model, latencyMs: json.latencyMs })
      } else {
        setEnrichedText('')
        setGenerationError(json.message)
      }
    } catch (e) {
      setGenerationError((e as Error).message)
    } finally {
      setEnriching(false)
    }
  }

  useEffect(() => {
    if (!sketchId) return

    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(`/api/test/sketch-generate/${sketchId}`, { cache: 'no-store' })
        const json = await res.json()

        if (cancelled || !json.data?.status) return

        setSketchStatus(json.data.status)

        if (json.data.status.state === 'error') {
          setGenerationError(json.data.status.error ?? json.data.status.message)
          setGenerating(false)
          return
        }

        if (json.data.status.state === 'completed') {
          setGenerationError('')
          setGenerating(false)
          return
        }

        window.setTimeout(poll, 1200)
      } catch (e) {
        if (!cancelled) {
          setGenerationError((e as Error).message)
          setGenerating(false)
        }
      }
    }

    void poll()

    return () => {
      cancelled = true
    }
  }, [sketchId])

  async function handleGenerate() {
    setGenerating(true)
    setGenerationError('')
    setSketchId(null)
    setSketchStatus(null)
    try {
      const res = await fetch('/api/test/sketch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: enrichedText, duration: 5 }),
      })
      const json = await res.json()

      if (json.data?.id) {
        setSketchId(json.data.id)
        setSketchStatus({
          id: json.data.id,
          promptExcerpt: enrichedText.trim().slice(0, 160),
          requestedDurationSeconds: 5,
          state: json.data.status,
          currentStep: 'queued',
          message: json.data.message,
          logs: [],
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          providerUsed: json.data.provider,
          providerMode: 'local',
        })
      } else {
        setGenerationError(json.message ?? 'Échec du lancement de la génération sketch')
        setGenerating(false)
      }
    } catch (e) {
      setGenerationError((e as Error).message)
      setGenerating(false)
    } finally {
      if (!sketchId) {
        // la boucle de polling prendra le relais quand un id est reçu
      }
    }
  }

  const statusTone = sketchStatus?.state === 'error'
    ? 'destructive'
    : sketchStatus?.state === 'completed'
      ? 'default'
      : 'secondary'

  const isRunning = sketchStatus?.state === 'running' || sketchStatus?.state === 'queued'
  const activeLogIndex = isRunning && sketchStatus?.logs?.length ? sketchStatus.logs.length - 1 : -1

  function getStepLabel(step: string): string {
    switch (step) {
      case 'queued':
        return 'file d’attente'
      case 'validating':
        return 'validation'
      case 'preparing':
        return 'préparation'
      case 'rendering':
        return 'rendu'
      case 'completed':
        return 'terminé'
      case 'error':
        return 'erreur'
      default:
        return step
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Test sketch local</h1>
        <p className="text-sm text-muted-foreground">
          Ici aussi, pas de boîte noire : on affiche la session, l’étape courante, les logs et le rendu final du provider local.
        </p>
      </div>

      {/* Étape 1 — Idée + choix modèle */}
      <Card>
        <CardHeader>
          <CardTitle>1. Ton idée</CardTitle>
        </CardHeader>
        <div className="p-6 pt-0 space-y-4">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Décris ton idée en quelques mots... ex: un chat astronaute flottant dans l'espace"
            className="w-full p-3 border rounded text-sm"
            rows={2}
          />

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium whitespace-nowrap">Modèle Ollama :</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="flex-1 p-2 border rounded text-sm"
            >
              {models.length === 0 && <option value="mistral:latest">mistral:latest</option>}
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <Button onClick={handleEnrich} disabled={enriching || !idea.trim()} className="w-full">
            {enriching ? 'Enrichissement en cours...' : 'Enrichir avec Ollama'}
          </Button>
        </div>
      </Card>

      {/* Étape 2 — Texte enrichi (éditable) */}
      {enrichedText && (
        <Card>
          <CardHeader>
            <CardTitle>2. Texte enrichi</CardTitle>
            {enrichMeta && (
              <p className="text-xs text-gray-500">
                via {enrichMeta.model} — {Math.round(enrichMeta.latencyMs / 1000)}s
              </p>
            )}
          </CardHeader>
          <div className="p-6 pt-0 space-y-4">
            <textarea
              value={enrichedText}
              onChange={(e) => setEnrichedText(e.target.value)}
              className="w-full p-3 border rounded text-sm"
              rows={6}
            />

            <div className="flex gap-2">
              <Button onClick={handleEnrich} disabled={enriching} variant="outline" className="flex-1">
                {enriching ? 'Régénération...' : 'Régénérer'}
              </Button>
              <Button onClick={handleGenerate} disabled={generating || !enrichedText.trim()} className="flex-1">
                {generating ? 'Lancement du sketch...' : 'Générer le sketch'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {generationError && (
        <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {generationError}
        </div>
      )}

      {(sketchStatus || sketchId) && (
        <Card className={`relative overflow-hidden ${isRunning ? 'border-lime-400/60 shadow-[0_0_0_1px_rgba(163,230,53,0.25),0_0_24px_rgba(132,204,22,0.18)]' : ''}`}>
          {isRunning && (
            <>
              <div className="pointer-events-none absolute inset-0 rounded-lg bg-[radial-gradient(circle_at_top,rgba(132,204,22,0.10),transparent_55%)]" />
              <div className="viral-electric-sweep pointer-events-none absolute inset-y-0 -left-1/3 w-1/3" />
            </>
          )}
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Suivi de génération sketch</CardTitle>
                <CardDescription>
                  {sketchStatus?.message ?? 'Initialisation du suivi...'}
                </CardDescription>
              </div>
              {sketchStatus && <Badge variant={statusTone}>{sketchStatus.state === 'running' ? 'en cours' : sketchStatus.state}</Badge>}
            </div>

            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="font-medium text-foreground">Session :</span> {sketchId}
              </div>
              <div>
                <span className="font-medium text-foreground">Étape :</span> {sketchStatus?.currentStep ?? 'queued'}
              </div>
              <div>
                <span className="font-medium text-foreground">Provider :</span> {sketchStatus?.providerUsed ?? 'sketch-local (prévu)'}
              </div>
              <div>
                <span className="font-medium text-foreground">Exécution :</span> local sur cette machine
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
              <div><span className="font-medium text-foreground">Moteur sketch :</span> `sketch-local`</div>
              <div><span className="font-medium text-foreground">Rendu :</span> vidéo papier via `ffmpeg` local</div>
              <div><span className="font-medium text-foreground">Durée cible :</span> {sketchStatus?.requestedDurationSeconds ?? 5}s</div>
              <div><span className="font-medium text-foreground">Prompt utilisé :</span> {sketchStatus?.promptExcerpt ?? enrichedText.slice(0, 160)}</div>
            </div>

            {sketchStatus?.logs?.length ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Journal d’exécution</div>
                <div className="space-y-2">
                  {sketchStatus.logs.map((entry, idx) => (
                    <div
                      key={`${entry.at}-${idx}`}
                      className={`relative overflow-hidden rounded-md border px-3 py-2 text-xs transition-all ${idx === activeLogIndex ? 'border-lime-400/60 bg-lime-500/5 shadow-[0_0_0_1px_rgba(163,230,53,0.18),0_0_18px_rgba(132,204,22,0.12)]' : 'bg-background/40'}`}
                    >
                      {idx === activeLogIndex && (
                        <>
                          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(163,230,53,0.10),transparent_60%)]" />
                          <div className="viral-electric-sweep pointer-events-none absolute inset-y-0 -left-1/3 w-1/3" />
                        </>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{entry.message}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={idx === activeLogIndex ? 'default' : 'outline'}>
                            {idx === activeLogIndex ? 'en cours' : sketchStatus?.state === 'error' && idx === sketchStatus.logs.length - 1 ? 'erreur' : 'terminé'}
                          </Badge>
                          <Badge variant="outline">{entry.scope}</Badge>
                        </div>
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {getStepLabel(entry.step)} — {new Date(entry.at).toLocaleTimeString('fr-FR')}
                      </div>
                      {entry.details && <div className="mt-1 text-muted-foreground">{entry.details}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardHeader>
        </Card>
      )}

      {sketchStatus?.state === 'completed' && sketchId && sketchStatus.outputFilePath && (
        <Card>
          <CardHeader>
            <CardTitle>3. Rendu final</CardTitle>
            <CardDescription>
              Le sketch local est prêt. Plus besoin de lire les entrailles du serveur comme du marc de café.
            </CardDescription>
          </CardHeader>
          <div className="space-y-3 p-6 pt-0">
            <video
              controls
              className="w-full rounded-md border bg-black"
              src={`/api/test/sketch-generate/${sketchId}?asset=1`}
            />
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <div><span className="font-medium text-foreground">Fichier local :</span> {sketchStatus.outputFilePath}</div>
              <div><span className="font-medium text-foreground">Durée demandée :</span> {sketchStatus.requestedDurationSeconds}s</div>
            </div>
          </div>
        </Card>
      )}

      <style jsx>{`
        .viral-electric-sweep {
          background: linear-gradient(90deg, transparent 0%, rgba(163,230,53,0.00) 8%, rgba(163,230,53,0.18) 30%, rgba(187,247,208,0.95) 48%, rgba(163,230,53,0.20) 68%, rgba(163,230,53,0.00) 92%, transparent 100%);
          filter: blur(10px);
          animation: viral-electric-sweep 1.8s linear infinite;
        }

        @keyframes viral-electric-sweep {
          0% {
            transform: translateX(0%);
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          100% {
            transform: translateX(420%);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
