'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ViralSessionStatus, ViralShortExport, ViralSubtitleStyle } from '@/lib/viral/viral-types'

type Segment = {
  index: number
  start_s: number
  end_s: number
  title: string
  reason: string
  excerpt: string
}

type SessionAssets = {
  sourceAvailable: boolean
  captionsAvailable: boolean
}

type ShortHistoryEntry = {
  viralId: string
  segmentIndex: number
  title: string
  start_s: number
  end_s: number
  crop916: boolean
  burnSubtitles: boolean
  status: string
  createdAt: string
  updatedAt: string
  sourceUrl: string | null
}

type SessionPayload = {
  status?: ViralSessionStatus
  segments?: Segment[]
  shorts?: ViralShortExport[]
  assets?: SessionAssets
}

type SegmentOptionState = {
  crop916: boolean
  burnSubtitles: boolean
  subtitleStyle: ViralSubtitleStyle
}

const FALLBACK_SUBTITLE_STYLE: ViralSubtitleStyle = {
  fontSize: 16,
  fontFamily: 'Arial',
  color: '#ffff00',
  maxCharsPerLine: 18,
  maxLines: 2,
}

const SUBTITLE_PREFS_KEY = 'filmcrew:subtitle-style'

function loadSavedSubtitleStyle(): ViralSubtitleStyle {
  if (typeof window === 'undefined') return FALLBACK_SUBTITLE_STYLE
  try {
    const raw = localStorage.getItem(SUBTITLE_PREFS_KEY)
    if (!raw) return FALLBACK_SUBTITLE_STYLE
    const parsed = JSON.parse(raw)
    return {
      fontSize: Math.min(48, Math.max(12, Number(parsed.fontSize) || FALLBACK_SUBTITLE_STYLE.fontSize)),
      fontFamily: String(parsed.fontFamily || FALLBACK_SUBTITLE_STYLE.fontFamily),
      color: /^#[0-9a-fA-F]{6}$/.test(parsed.color) ? parsed.color : FALLBACK_SUBTITLE_STYLE.color,
      maxCharsPerLine: Math.min(42, Math.max(10, Number(parsed.maxCharsPerLine) || FALLBACK_SUBTITLE_STYLE.maxCharsPerLine)),
      maxLines: Math.min(3, Math.max(1, Number(parsed.maxLines) || FALLBACK_SUBTITLE_STYLE.maxLines)),
    }
  } catch { return FALLBACK_SUBTITLE_STYLE }
}

function saveSubtitleStyle(style: ViralSubtitleStyle) {
  try { localStorage.setItem(SUBTITLE_PREFS_KEY, JSON.stringify(style)) } catch {}
}

const DEFAULT_SUBTITLE_STYLE = loadSavedSubtitleStyle()

const FONT_CHOICES = [
  'Arial',
  'Helvetica',
  'Verdana',
  'Trebuchet MS',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Avenir Next',
]

export default function ViralPage() {
  const [url, setUrl] = useState('')
  const [instruction, setInstruction] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [segments, setSegments] = useState<Segment[]>([])
  const [viralId, setViralId] = useState<string | null>(null)
  const [status, setStatus] = useState<ViralSessionStatus | null>(null)
  const [shortHistory, setShortHistory] = useState<ShortHistoryEntry[]>([])
  const [shorts, setShorts] = useState<ViralShortExport[]>([])
  const [assets, setAssets] = useState<SessionAssets>({ sourceAvailable: false, captionsAvailable: false })
  const [segmentOptions, setSegmentOptions] = useState<Record<number, SegmentOptionState>>({})
  const [exporting, setExporting] = useState<Record<number, boolean>>({})
  const [pollSeed, setPollSeed] = useState(0)

  useEffect(() => {
    void loadShortHistory()
  }, [])

  async function loadShortHistory() {
    try {
      const res = await fetch('/api/viral/shorts', { cache: 'no-store' })
      const json = await res.json()
      if (json.data) {
        setShortHistory(json.data as ShortHistoryEntry[])
      }
    } catch {
      // silencieux
    }
  }

  async function loadSession(currentViralId: string): Promise<SessionPayload | null> {
    const res = await fetch(`/api/viral/${currentViralId}`, { cache: 'no-store' })
    const json = await res.json()
    if (!json.data) return null

    const payload = json.data as SessionPayload
    setError('')

    if (payload.status) {
      setStatus(payload.status)
      if ((payload.status.state === 'error' || ((payload.segments?.length ?? 0) === 0 && payload.status.state === 'completed')) && payload.status.error) {
        setError(payload.status.error)
      }
    }

    setSegments(payload.segments ?? [])
    setShorts(payload.shorts ?? [])
    setAssets(payload.assets ?? { sourceAvailable: false, captionsAvailable: false })
    return payload
  }

  useEffect(() => {
    if (!viralId) return
    const currentViralId = viralId

    let cancelled = false
    let timeoutId: number | null = null

    async function poll() {
      try {
        const payload = await loadSession(currentViralId)
        if (cancelled || !payload) return

        const state = payload.status?.state
        const hasPendingShort = (payload.shorts ?? []).some((entry) => entry.status === 'queued' || entry.status === 'processing')

        if ((state === 'completed' || state === 'error') && !hasPendingShort) {
          setAnalyzing(false)
          setExporting({})
          await loadShortHistory()
          return
        }

        timeoutId = window.setTimeout(poll, 1500)
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message)
          setAnalyzing(false)
        }
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [viralId, pollSeed])

  async function handleLaunch() {
    if (!url.trim()) return

    setAnalyzing(true)
    setError('')
    setSegments([])
    setShorts([])
    setStatus(null)
    setViralId(null)
    setAssets({ sourceAvailable: false, captionsAvailable: false })

    try {
      const res = await fetch('/api/viral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), instruction: instruction.trim() || undefined }),
      })
      const json = await res.json()

      if (json.error) {
        setError(json.error.message)
        setAnalyzing(false)
        return
      }

      if (json.data) {
        setViralId(json.data.id as string)
        setStatus({
          id: json.data.id,
          url: json.data.url,
          state: json.data.status,
          currentStep: 'queued',
          message: json.data.message,
          logs: [],
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        setPollSeed((value) => value + 1)
      }
    } catch (e) {
      setError((e as Error).message)
      setAnalyzing(false)
    }
  }

  async function handleRefreshSession() {
    if (!viralId) return

    try {
      setError('')
      await loadSession(viralId)
      await loadShortHistory()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function getStepLabel(step: string): string {
    switch (step) {
      case 'queued':
        return 'file d’attente'
      case 'downloading':
        return 'téléchargement'
      case 'transcribing':
        return 'transcription'
      case 'analyzing':
        return 'analyse'
      case 'completed':
        return 'terminé'
      case 'error':
        return 'erreur'
      default:
        return step
    }
  }

  function getSegmentOptions(segmentIndex: number) {
    return segmentOptions[segmentIndex] ?? {
      crop916: false,
      burnSubtitles: false,
      subtitleStyle: DEFAULT_SUBTITLE_STYLE,
    }
  }

  function toggleSegmentOption(segmentIndex: number, option: 'crop916' | 'burnSubtitles') {
    if (option === 'burnSubtitles' && !assets.captionsAvailable) return

    setSegmentOptions((prev) => ({
      ...prev,
      [segmentIndex]: {
        ...getSegmentOptions(segmentIndex),
        [option]: !getSegmentOptions(segmentIndex)[option],
      },
    }))
  }

  function updateSubtitleStyle(
    segmentIndex: number,
    field: keyof ViralSubtitleStyle,
    value: string | number,
  ) {
    const current = getSegmentOptions(segmentIndex)
    const numericFields: Array<keyof ViralSubtitleStyle> = ['fontSize', 'maxCharsPerLine', 'maxLines']
    const numericFallbacks = {
      fontSize: FALLBACK_SUBTITLE_STYLE.fontSize,
      maxCharsPerLine: FALLBACK_SUBTITLE_STYLE.maxCharsPerLine,
      maxLines: FALLBACK_SUBTITLE_STYLE.maxLines,
    }
    const nextStyle: ViralSubtitleStyle = {
      ...current.subtitleStyle,
      [field]: numericFields.includes(field)
        ? Math.round(Number(value) || numericFallbacks[field as keyof typeof numericFallbacks])
        : String(value),
    }

    saveSubtitleStyle(nextStyle)

    setSegmentOptions((prev) => ({
      ...prev,
      [segmentIndex]: {
        ...current,
        subtitleStyle: nextStyle,
      },
    }))
  }

  function getShortForSegment(segmentIndex: number) {
    return shorts.find((item) => item.segmentIndex === segmentIndex) ?? null
  }

  async function handleExportShort(segment: Segment) {
    if (!viralId) return

    setExporting((prev) => ({ ...prev, [segment.index]: true }))
    setError('')

    try {
      const options = getSegmentOptions(segment.index)
      const res = await fetch(`/api/viral/${viralId}/shorts/${segment.index}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error?.message ?? 'Impossible d’exporter ce short')
        return
      }

      setPollSeed((value) => value + 1)
      await loadShortHistory()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setExporting((prev) => ({ ...prev, [segment.index]: false }))
    }
  }

  const statusTone = status?.state === 'error'
    ? 'destructive'
    : status?.state === 'completed'
      ? 'default'
      : 'secondary'

  const isRunning = status?.state === 'running'
  const activeLogIndex = isRunning && status?.logs?.length ? status.logs.length - 1 : -1

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Découpage viral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Collez une URL YouTube pour extraire des shorts viraux.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Ici, pas de pipeline “idée → storyboard → génération”. On analyse, on repère les passages marquants, puis on coupe la vidéo source localement pour sortir un short rapide, avec ou sans sous-titres.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div>
            <CardTitle className="text-base">Historique des shorts viraux</CardTitle>
            <CardDescription>
              Archive des exports rapides déjà sortis depuis des segments viraux.
            </CardDescription>
          </div>

          {shortHistory.length === 0 ? (
            <div className="rounded-md border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
              Aucun short viral exporté pour le moment.
            </div>
          ) : (
            <div className="space-y-2">
              {shortHistory.map((entry) => (
                <div key={`${entry.viralId}-${entry.segmentIndex}`} className="rounded-md border px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{entry.title}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant={entry.status === 'completed' ? 'default' : entry.status === 'processing' || entry.status === 'queued' ? 'secondary' : 'destructive'}>
                        {entry.status}
                      </Badge>
                      {entry.status === 'completed' && (
                        <a href={`/api/viral/${entry.viralId}/shorts/${entry.segmentIndex}?asset=1`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="h-7 text-xs">Ouvrir le short</Button>
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Segment {entry.segmentIndex} · {formatTime(entry.start_s)} → {formatTime(entry.end_s)}
                    {' · '}
                    {entry.crop916 ? '9:16' : 'ratio source'}
                    {' · '}
                    {entry.burnSubtitles ? 'sous-titres intégrés' : 'sans sous-titres'}
                    {' · '}
                    {new Date(entry.updatedAt).toLocaleString('fr-FR')}
                  </div>
                  {entry.sourceUrl && (
                    <div className="mt-1 truncate text-[11px] text-muted-foreground">
                      Source : {entry.sourceUrl}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardHeader>
      </Card>

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
            placeholder="Focus sur les clashs, les révélations, les moments drôles..."
          />
        </div>

        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button onClick={handleLaunch} disabled={analyzing || !url.trim()}>
          {analyzing ? 'Analyse en cours...' : 'Lancer'}
        </Button>
      </div>

      {(status || viralId) && (
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
                <CardTitle className="text-base">Suivi d’analyse</CardTitle>
                <CardDescription>
                  {status?.message ?? 'Initialisation du suivi...'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {viralId && (
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleRefreshSession}>
                    Rafraîchir
                  </Button>
                )}
                {status && <Badge variant={statusTone}>{status.state === 'running' ? 'en cours' : status.state}</Badge>}
              </div>
            </div>

            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="font-medium text-foreground">Session :</span>{' '}
                {viralId}
              </div>
              <div>
                <span className="font-medium text-foreground">Étape :</span>{' '}
                {status?.currentStep ?? 'queued'}
              </div>
              <div>
                <span className="font-medium text-foreground">Provider LLM :</span>{' '}
                {status?.providerUsed ?? 'pas encore déterminé'}
              </div>
              <div>
                <span className="font-medium text-foreground">Exécution :</span>{' '}
                {status?.providerMode === 'local'
                  ? 'analyse LLM en local'
                  : status?.providerMode === 'external'
                    ? 'analyse LLM via service externe'
                    : 'téléchargement/transcription en local sur cette machine'}
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
              <div><span className="font-medium text-foreground">Téléchargement YouTube :</span> local via `yt-dlp`</div>
              <div><span className="font-medium text-foreground">Vidéo source :</span> {assets.sourceAvailable ? 'source.mp4 prête pour le cut' : 'pas encore disponible'}</div>
              <div><span className="font-medium text-foreground">Sous-titres horodatés :</span> {assets.captionsAvailable ? 'VTT YouTube disponible pour incrustation dynamique' : 'indisponibles sur cette source — export sans sous-titres uniquement'}</div>
              <div><span className="font-medium text-foreground">Export court :</span> cut local FFmpeg sur `source.mp4`, sans storyboard ni régénération vidéo</div>
            </div>

            {status?.failover && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                Failover détecté : {status.failover.original} → {status.failover.fallback} ({status.failover.reason})
              </div>
            )}

            {status?.logs?.length ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Journal d’exécution</div>
                <div className="space-y-2">
                  {status.logs.map((entry, idx) => (
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
                            {idx === activeLogIndex ? 'en cours' : status.state === 'error' && idx === status.logs.length - 1 ? 'erreur' : 'terminé'}
                          </Badge>
                          <Badge variant="outline">{entry.scope}</Badge>
                        </div>
                      </div>
                      <div className="mt-1 text-muted-foreground">{getStepLabel(entry.step)} — {new Date(entry.at).toLocaleTimeString('fr-FR')}</div>
                      {entry.details && <div className="mt-1 whitespace-pre-line text-muted-foreground">{entry.details}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardHeader>
        </Card>
      )}

      {status?.state === 'completed' && segments.length === 0 && !error && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-900 dark:text-amber-200">
          <div>Analyse terminée, mais aucun segment exploitable n’a pu être extrait de la réponse LLM.</div>
          {viralId && (
            <div className="mt-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleRefreshSession}>
                Relire cette session
              </Button>
            </div>
          )}
        </div>
      )}

      {segments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            {segments.length} segment{segments.length > 1 ? 's' : ''} détecté{segments.length > 1 ? 's' : ''}
          </h2>

          {segments.map((segment) => {
            const currentShort = getShortForSegment(segment.index)
            const currentOptions = getSegmentOptions(segment.index)

            return (
              <Card key={segment.index}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{segment.title}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {formatTime(segment.start_s)} → {formatTime(segment.end_s)} ({segment.end_s - segment.start_s}s)
                    </Badge>
                  </div>

                  <CardDescription className="text-xs">{segment.reason}</CardDescription>

                  {segment.excerpt && (
                    <p className="text-xs text-muted-foreground italic mt-1">
                      &laquo; {segment.excerpt} &raquo;
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={currentOptions.crop916 ? 'default' : 'outline'}
                      className="text-xs"
                      onClick={() => toggleSegmentOption(segment.index, 'crop916')}
                    >
                      {currentOptions.crop916 ? 'Recadrage 9:16 prêt' : 'Recadrer 9:16'}
                    </Button>
                    <Button
                      size="sm"
                      variant={currentOptions.burnSubtitles ? 'default' : 'outline'}
                      className="text-xs"
                      disabled={!assets.captionsAvailable}
                      onClick={() => toggleSegmentOption(segment.index, 'burnSubtitles')}
                    >
                      {!assets.captionsAvailable
                        ? 'Sous-titres indisponibles'
                        : currentOptions.burnSubtitles
                          ? 'Sous-titres prêts'
                          : 'Ajouter sous-titres'}
                    </Button>
                  </div>

                  <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
                    <div><span className="font-medium text-foreground">Mode :</span> export local rapide du passage source</div>
                    <div><span className="font-medium text-foreground">Traitement :</span> pas de storyboard, pas de prompts, pas de run pipeline, pas de régénération d’image ou de vidéo</div>
                    <div>
                      <span className="font-medium text-foreground">Sortie :</span>{' '}
                      {currentOptions.crop916 ? 'short vertical 9:16' : 'cut au ratio source'}
                      {' · '}
                      {currentOptions.burnSubtitles ? 'avec sous-titres colorés' : 'sans sous-titres'}
                    </div>
                    {currentOptions.burnSubtitles && (
                      <div>
                        <span className="font-medium text-foreground">Style sous-titres :</span>{' '}
                        {currentOptions.subtitleStyle.fontFamily} · {currentOptions.subtitleStyle.fontSize}px · {currentOptions.subtitleStyle.color} · {currentOptions.subtitleStyle.maxCharsPerLine} car/ligne · {currentOptions.subtitleStyle.maxLines} ligne(s) max
                      </div>
                    )}
                  </div>

                  {currentOptions.burnSubtitles && assets.captionsAvailable && (
                    <div className="mt-3 rounded-md border bg-muted/20 px-3 py-3 text-xs">
                      <div className="mb-3 font-medium text-foreground">Réglages des sous-titres</div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`subtitle-font-${segment.index}`}>Police</Label>
                          <select
                            id={`subtitle-font-${segment.index}`}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                            value={currentOptions.subtitleStyle.fontFamily}
                            onChange={(e) => updateSubtitleStyle(segment.index, 'fontFamily', e.target.value)}
                          >
                            {FONT_CHOICES.map((font) => (
                              <option key={font} value={font}>{font}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`subtitle-size-${segment.index}`}>Taille</Label>

                        <div className="space-y-1.5">
                          <Label htmlFor={`subtitle-maxchars-${segment.index}`}>Caractères / ligne</Label>
                          <Input
                            id={`subtitle-maxchars-${segment.index}`}
                            type="number"
                            min={10}
                            max={42}
                            step={1}
                            value={currentOptions.subtitleStyle.maxCharsPerLine}
                            onChange={(e) => updateSubtitleStyle(segment.index, 'maxCharsPerLine', e.target.value)}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`subtitle-maxlines-${segment.index}`}>Lignes max</Label>
                          <Input
                            id={`subtitle-maxlines-${segment.index}`}
                            type="number"
                            min={1}
                            max={3}
                            step={1}
                            value={currentOptions.subtitleStyle.maxLines}
                            onChange={(e) => updateSubtitleStyle(segment.index, 'maxLines', e.target.value)}
                          />
                        </div>
                          <Input
                            id={`subtitle-size-${segment.index}`}
                            type="number"
                            min={12}
                            max={48}
                            step={1}
                            value={currentOptions.subtitleStyle.fontSize}
                            onChange={(e) => updateSubtitleStyle(segment.index, 'fontSize', e.target.value)}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`subtitle-color-${segment.index}`}>Couleur</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`subtitle-color-${segment.index}`}
                              type="color"
                              className="h-9 w-14 p-1"
                              value={currentOptions.subtitleStyle.color}
                              onChange={(e) => updateSubtitleStyle(segment.index, 'color', e.target.value)}
                            />
                            <Input
                              value={currentOptions.subtitleStyle.color}
                              onChange={(e) => updateSubtitleStyle(segment.index, 'color', e.target.value)}
                              placeholder="#ffff00"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Mini aperçu du style */}
                      <div
                        className="mt-3 flex items-end justify-center rounded-md border border-dashed"
                        style={{ aspectRatio: '16/9', maxHeight: 120, background: 'linear-gradient(to bottom, #1a1a1a 0%, #000 100%)' }}
                      >
                        <span
                          className="mb-3 px-2 py-0.5 text-center leading-tight"
                          style={{
                            fontFamily: currentOptions.subtitleStyle.fontFamily,
                            fontSize: Math.min(currentOptions.subtitleStyle.fontSize, 24),
                            color: currentOptions.subtitleStyle.color,
                            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            borderRadius: 2,
                          }}
                        >
                          Aperçu des sous-titres
                        </span>
                      </div>
                    </div>
                  )}

                  {currentShort && (
                    <div className="mt-3 rounded-md border px-3 py-3 text-xs space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={currentShort.status === 'completed' ? 'default' : currentShort.status === 'processing' || currentShort.status === 'queued' ? 'secondary' : 'destructive'}>
                          {currentShort.status}
                        </Badge>
                        <span className="text-muted-foreground">
                          {currentShort.crop916 ? '9:16' : 'ratio source'} · {currentShort.burnSubtitles ? 'sous-titres colorés' : 'sans sous-titres'}
                        </span>
                      </div>

                      {currentShort.burnSubtitles && currentShort.subtitleStyle && (
                        <div className="text-muted-foreground">
                          Police {currentShort.subtitleStyle.fontFamily} · {currentShort.subtitleStyle.fontSize}px · {currentShort.subtitleStyle.color} · {currentShort.subtitleStyle.maxCharsPerLine} car/ligne · {currentShort.subtitleStyle.maxLines} ligne(s) max
                        </div>
                      )}

                      {currentShort.error && (
                        <div className="text-destructive">{currentShort.error}</div>
                      )}

                      {currentShort.status === 'completed' && (
                        <div className="space-y-2">
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <video
                            controls
                            className="w-full max-w-xs rounded-lg border bg-black"
                            style={{ aspectRatio: currentShort.crop916 ? '9/16' : '16/9' }}
                            src={`/api/viral/${viralId}/shorts/${segment.index}?asset=1`}
                            preload="metadata"
                          />
                          <div className="flex flex-wrap gap-2">
                            <a href={`/api/viral/${viralId}/shorts/${segment.index}?asset=1`} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" className="text-xs">Ouvrir</Button>
                            </a>
                            <a href={`/api/viral/${viralId}/shorts/${segment.index}?asset=1`} download>
                              <Button size="sm" variant="outline" className="text-xs">Télécharger</Button>
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      className="text-xs"
                      disabled={!viralId || (exporting[segment.index] ?? false) || currentShort?.status === 'processing' || currentShort?.status === 'queued'}
                      onClick={() => handleExportShort(segment)}
                    >
                      {exporting[segment.index] || currentShort?.status === 'processing' || currentShort?.status === 'queued'
                        ? 'Export du short...'
                        : 'Exporter le short'}
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            )
          })}
        </div>
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
