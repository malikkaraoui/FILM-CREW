'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { RunStepper } from '@/components/stepper/run-stepper'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ProjectConfig, Run, RunStep } from '@/types/run'
import { TOTAL_PIPELINE_STEPS } from '@/lib/pipeline/constants'
import { getProjectStatusClass, getProjectStatusLabel, getRunStepLabel } from '@/lib/runs/presentation'

type RunWithSteps = Run & { steps: RunStep[]; projectConfig?: ProjectConfig | null }

type Deliverable = {
  stepNumber: number
  title: string
  expected: string
  editable: boolean
  pageHref: string | null
  fileName: string | null
  available: boolean
  content: string | null
  summary: string
}

const STEP_EXPECTATIONS: Record<number, { label: string; expected: string }> = {
  1: { label: 'Idée', expected: 'intention.json — idée enrichie et cadrée' },
  2: { label: 'Brainstorm', expected: 'brief.json — réunion et sections agents' },
  3: { label: 'JSON structuré', expected: 'structure.json — structure canonique du film' },
  4: { label: 'Blueprint visuel', expected: 'storyboard-blueprint.json — plan visuel simple scène par scène' },
  5: { label: 'Storyboard', expected: 'manifest storyboard + rough local + planche de vignettes' },
  6: { label: 'Prompts', expected: 'prompt-manifest.json — prompts vidéo + négatifs' },
  7: { label: 'Génération', expected: 'generation-manifest.json — clips/audio générés' },
  8: { label: 'Preview', expected: 'preview-manifest.json + brouillon playable si dispo' },
  9: { label: 'Publication', expected: 'publish-manifest.json + contexte export' },
}

const STEP_ACTIONS: Record<number, string> = {
  1: 'Cadrer l’idée de départ',
  2: 'Lancer la réunion brainstorm',
  3: 'Générer la structure JSON du film',
  4: 'Fabriquer le blueprint visuel scène par scène',
  5: 'Générer le storyboard rough scène par scène',
  6: 'Préparer les prompts vidéo',
  7: 'Lancer la génération des clips',
  8: 'Assembler et relire la preview',
  9: 'Préparer la publication finale',
}

const STEP_VIEW_LABELS: Record<number, string> = {
  2: 'Suivre la réunion brainstorm',
  5: 'Ouvrir le storyboard',
  6: 'Ouvrir les prompts',
  7: 'Suivre la génération',
  8: 'Ouvrir la preview',
  9: 'Ouvrir la publication',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'à venir',
  running: 'en cours',
  paused: 'à valider',
  completed: 'terminée',
  failed: 'échouée',
  killed: 'arrêtée',
}

function getStepActionLabel(stepNumber: number): string {
  return STEP_ACTIONS[stepNumber] ?? 'Exécuter cette étape'
}

function getStepViewLabel(stepNumber: number): string {
  return STEP_VIEW_LABELS[stepNumber] ?? `Ouvrir l’étape ${stepNumber}`
}

function getStepGuidance(params: {
  stepNumber: number
  stepStatus: string
  currentStep: number
  runStatus: string
}): { tone: 'amber' | 'blue' | 'green' | 'red'; title: string; body: string } {
  const { stepNumber, stepStatus, currentStep, runStatus } = params
  const action = getStepActionLabel(stepNumber)
  const currentLabel = STEP_EXPECTATIONS[currentStep]?.label ?? `Étape ${currentStep}`
  const previousLabel = STEP_EXPECTATIONS[Math.max(1, stepNumber - 1)]?.label ?? `Étape ${Math.max(1, stepNumber - 1)}`
  const nextAction = stepNumber < TOTAL_PIPELINE_STEPS ? getStepActionLabel(stepNumber + 1) : null

  if (stepNumber === currentStep) {
    if (runStatus === 'running') {
      return {
        tone: 'blue',
        title: 'Étape en cours maintenant',
        body: `Le projet exécute actuellement : ${action}. Rien ne partira plus loin automatiquement ensuite.`,
      }
    }

    if (runStatus === 'paused' && stepStatus === 'completed') {
      return {
        tone: 'green',
        title: 'Étape terminée — validation requise',
        body: nextAction
          ? `Relis ce livrable puis décide : valider pour débloquer la suite (${nextAction}) ou relancer cette étape si le résultat n’est pas assez bon.`
          : 'La dernière étape est terminée. Il ne reste plus de passage suivant à débloquer.',
      }
    }

    if (runStatus === 'failed' || stepStatus === 'failed') {
      return {
        tone: 'red',
        title: 'Étape en erreur',
        body: `Cette étape a échoué pendant : ${action}. Corrige le blocage puis relance uniquement cette étape.`,
      }
    }

    if (runStatus === 'pending') {
      return {
        tone: 'amber',
        title: 'Étape prête à être lancée',
        body: `Action attendue ici : ${action}. Une fois terminée, le projet s’arrêtera en attente de ta validation.`,
      }
    }

    if (runStatus === 'completed') {
      return {
        tone: 'green',
        title: 'Projet terminé',
        body: 'Le pipeline est arrivé au bout. Tu peux relire les livrables ou repartir d’une étape précédente si besoin.',
      }
    }

    if (runStatus === 'killed') {
      return {
        tone: 'red',
        title: 'Projet arrêté',
        body: 'Le projet a été stoppé. Tu peux repartir depuis une étape déjà terminée si tu veux reprendre proprement.',
      }
    }
  }

  if (stepStatus === 'completed') {
    return {
      tone: 'green',
      title: 'Étape déjà produite',
      body: 'Ce livrable existe déjà. Tu peux le consulter ou repartir depuis ici si tu veux réouvrir le tunnel à partir de cette étape.',
    }
  }

  if (stepStatus === 'running') {
    return {
      tone: 'blue',
      title: 'Étape actuellement en cours',
      body: 'Cette étape tourne en ce moment. Attends sa fin avant toute autre décision.',
    }
  }

  return {
    tone: 'amber',
    title: 'Étape verrouillée',
    body: `Tu ne peux pas lancer cette étape tout de suite. Il faut d’abord terminer et valider : ${previousLabel}. Étape focalisée actuelle : ${currentLabel}.`,
  }
}

export default function RunPage() {
  const { id } = useParams<{ id: string }>()
  const [run, setRun] = useState<RunWithSteps | null>(null)
  const [selectedStep, setSelectedStep] = useState<number>(1)
  const [deliverable, setDeliverable] = useState<Deliverable | null>(null)
  const [draft, setDraft] = useState('')
  const [loadingDeliverable, setLoadingDeliverable] = useState(false)
  const [savingDeliverable, setSavingDeliverable] = useState(false)
  const [deliverableNotice, setDeliverableNotice] = useState('')
  const [runNotice, setRunNotice] = useState('')
  const [actionBusy, setActionBusy] = useState<'launch' | 'validate' | 'rewind' | 'kill' | null>(null)

  useEffect(() => {
    void loadRun()
    const interval = setInterval(() => {
      void loadRun()
    }, 3000)
    return () => clearInterval(interval)
  }, [id])

  useEffect(() => {
    if (!run) return
    setSelectedStep(run.currentStep ?? 1)
  }, [run?.id, run?.currentStep])

  useEffect(() => {
    if (!run) return
    void loadDeliverable(selectedStep)
  }, [run, selectedStep])

  async function loadRun() {
    const res = await fetch(`/api/runs/${id}`)
    const json = await res.json()
    if (json.data) setRun(json.data)
  }

  async function loadDeliverable(stepNumber: number) {
    setLoadingDeliverable(true)
    setDeliverableNotice('')
    try {
      const res = await fetch(`/api/runs/${id}/deliverables/${stepNumber}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.data) {
        setDeliverable(json.data)
        setDraft(json.data.content ?? '')
      }
    } catch (e) {
      setDeliverableNotice((e as Error).message)
    } finally {
      setLoadingDeliverable(false)
    }
  }

  async function saveDeliverable() {
    if (!deliverable?.editable) return
    setSavingDeliverable(true)
    setDeliverableNotice('')
    try {
      const res = await fetch(`/api/runs/${id}/deliverables/${selectedStep}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      })
      const json = await res.json()
      if (!res.ok) {
        setDeliverableNotice(json.error?.message ?? 'Sauvegarde impossible')
        return
      }
      setDeliverableNotice('Livrable sauvegardé')
      await loadDeliverable(selectedStep)
    } catch (e) {
      setDeliverableNotice((e as Error).message)
    } finally {
      setSavingDeliverable(false)
    }
  }

  async function handleLaunchCurrentStep() {
    if (!run) return
    const needsConfirmation = run.status === 'paused' || run.status === 'failed'
    if (needsConfirmation && !confirm(`Relancer l'étape ${selectedStep} ? Les livrables aval seront remis à zéro.`)) return

    setActionBusy('launch')
    setRunNotice('')
    try {
      const res = await fetch(`/api/runs/${id}/execute-step`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setRunNotice(json.error?.message ?? 'Lancement impossible')
        return
      }
      setRunNotice(`Étape ${json.data.stepNumber} lancée.`)
      await loadRun()
      await loadDeliverable(selectedStep)
    } finally {
      setActionBusy(null)
    }
  }

  async function handleValidateCurrentStep() {
    setActionBusy('validate')
    setRunNotice('')
    try {
      const res = await fetch(`/api/runs/${id}/validate-step`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setRunNotice(json.error?.message ?? 'Validation impossible')
        return
      }
      setRunNotice(`Étape ${selectedStep} validée. La suite est débloquée.`)
      await loadRun()
    } finally {
      setActionBusy(null)
    }
  }

  async function handleRewindToSelectedStep() {
    if (!confirm(`Repartir depuis l'étape ${selectedStep} ? Les livrables des étapes suivantes seront remis à zéro.`)) return

    setActionBusy('rewind')
    setRunNotice('')
    try {
      const res = await fetch(`/api/runs/${id}/step-back`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStep: selectedStep }),
      })
      const json = await res.json()
      if (!res.ok) {
        setRunNotice(json.error?.message ?? 'Retour impossible')
        return
      }
      setRunNotice(`Le projet est repositionné sur l'étape ${selectedStep}.`)
      await loadRun()
      await loadDeliverable(selectedStep)
    } finally {
      setActionBusy(null)
    }
  }

  async function handleKill() {
    if (!confirm('Arrêter l’étape en cours ?')) return

    setActionBusy('kill')
    setRunNotice('')
    try {
      const res = await fetch(`/api/runs/${id}/kill`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setRunNotice(json.error?.message ?? 'Arrêt impossible')
        return
      }
      setRunNotice('Projet arrêté.')
      await loadRun()
    } finally {
      setActionBusy(null)
    }
  }

  const deliverablePreview = useMemo(() => {
    if (!deliverable?.content) return ''
    try {
      return JSON.stringify(JSON.parse(deliverable.content), null, 2)
    } catch {
      return deliverable.content
    }
  }, [deliverable?.content])

  if (!run) return <p className="text-sm text-muted-foreground">Chargement...</p>

  const currentStep = run.currentStep ?? 1
  const currentStepInfo = STEP_EXPECTATIONS[selectedStep]
  const selectedRunStep = run.steps.find((step) => step.stepNumber === selectedStep)
  const selectedStatus = selectedRunStep?.status ?? 'pending'
  const selectedGuidance = getStepGuidance({
    stepNumber: selectedStep,
    stepStatus: selectedStatus,
    currentStep,
    runStatus: run.status,
  })
  const guidanceToneClasses = {
    amber: 'border-amber-300 bg-amber-50 text-amber-900',
    blue: 'border-blue-300 bg-blue-50 text-blue-900',
    green: 'border-green-300 bg-green-50 text-green-900',
    red: 'border-destructive bg-destructive/10 text-destructive',
  }[selectedGuidance.tone]
  const isCurrentSelection = selectedStep === currentStep
  const canLaunchCurrentStep = isCurrentSelection && run.status === 'pending'
  const canValidateCurrentStep = isCurrentSelection && run.status === 'paused' && selectedRunStep?.status === 'completed' && currentStep < TOTAL_PIPELINE_STEPS
  const canRelaunchCurrentStep = isCurrentSelection && (run.status === 'paused' || run.status === 'failed')
  const canRewindToSelectedStep = selectedStep < currentStep && selectedRunStep?.status === 'completed' && run.status !== 'running'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold truncate max-w-md">{run.idea}</h1>
        {run.status === 'running' && (
          <Button variant="destructive" size="sm" onClick={handleKill} disabled={actionBusy === 'kill'}>
            {actionBusy === 'kill' ? 'Arrêt...' : 'Arrêter'}
          </Button>
        )}
      </div>

      <div className="mt-4">
        <RunStepper steps={run.steps} currentStep={currentStep} />
      </div>

      {run.status === 'pending' && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-700">
            Projet prêt : l’étape {currentStep} attend ton lancement manuel.
          </p>
        </div>
      )}
      {run.status === 'paused' && (
        <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-700">
            Étape {currentStep} terminée. Valide-la explicitement avant de débloquer l’étape suivante.
          </p>
        </div>
      )}
      {run.status === 'failed' && (
        <div className="mt-6 rounded-md border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Le projet a échoué à l&apos;étape {currentStep}.
            {run.steps.find(s => s.stepNumber === currentStep)?.error && (
              <span className="block mt-1 font-mono text-xs">{run.steps.find(s => s.stepNumber === currentStep)?.error}</span>
            )}
          </p>
        </div>
      )}
      {run.status === 'completed' && (
        <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-700">
            Projet terminé — {run.steps.filter(s => s.status === 'completed').length}/{TOTAL_PIPELINE_STEPS} étapes complétées.
          </p>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span>Coût : {(run.costEur ?? 0).toFixed(2)} €</span>
              <span className={getProjectStatusClass(run.status)}>Statut : {getProjectStatusLabel(run)}</span>
              <span>Étape focale : {getRunStepLabel(run)}</span>
              <span>Action attendue : {getStepActionLabel(currentStep)}</span>
              {run.projectConfig && (
                <span>
                  Réunion LLM : {run.projectConfig.meetingLlmMode} · {run.projectConfig.meetingLlmModel}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <h2 className="text-base font-semibold">Tunnel {TOTAL_PIPELINE_STEPS} étapes</h2>
              <p className="text-sm text-muted-foreground">
                Chaque carte = un livrable attendu. Tu consultes ici, puis tu décides explicitement quand avancer.
              </p>
            </div>

            <div className="space-y-2">
              {run.steps.map((step) => {
                const meta = STEP_EXPECTATIONS[step.stepNumber]
                const isSelected = step.stepNumber === selectedStep
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setSelectedStep(step.stepNumber)}
                    className={`w-full rounded-lg border p-3 text-left transition ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">Étape {step.stepNumber} — {meta?.label ?? step.stepName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{meta?.expected ?? step.stepName}</div>
                        <div className="mt-1 text-[11px] text-foreground/80">
                          Action : {getStepActionLabel(step.stepNumber)}
                        </div>
                      </div>
                      <Badge variant={step.status === 'completed' ? 'default' : step.status === 'running' ? 'secondary' : step.status === 'failed' ? 'destructive' : 'outline'}>
                        {STATUS_LABELS[step.status] ?? step.status}
                      </Badge>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-4 min-h-140">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                Livrable — Étape {selectedStep} · {currentStepInfo?.label ?? selectedRunStep?.stepName}
              </h2>
              <p className="text-sm text-muted-foreground">
                {deliverable?.expected ?? currentStepInfo?.expected}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={selectedRunStep?.status === 'completed' ? 'default' : selectedRunStep?.status === 'running' ? 'secondary' : selectedRunStep?.status === 'failed' ? 'destructive' : 'outline'}>
                {STATUS_LABELS[selectedStatus] ?? selectedStatus}
              </Badge>
              {deliverable?.fileName && (
                <Badge variant="outline">{deliverable.fileName}</Badge>
              )}
            </div>
          </div>

          <div className={`rounded-md border px-3 py-3 text-sm ${guidanceToneClasses}`}>
            <div className="font-semibold">{selectedGuidance.title}</div>
            <div className="mt-1">{selectedGuidance.body}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canLaunchCurrentStep && (
              <Button onClick={handleLaunchCurrentStep} disabled={actionBusy === 'launch'} size="sm">
                {actionBusy === 'launch' ? 'Lancement...' : `Lancer l’étape ${selectedStep}`}
              </Button>
            )}
            {canValidateCurrentStep && (
              <Button onClick={handleValidateCurrentStep} disabled={actionBusy === 'validate'} size="sm">
                {actionBusy === 'validate' ? 'Validation...' : 'Valider et débloquer la suite'}
              </Button>
            )}
            {canRelaunchCurrentStep && (
              <Button variant="outline" onClick={handleLaunchCurrentStep} disabled={actionBusy === 'launch'} size="sm">
                {actionBusy === 'launch' ? 'Relance...' : 'Relancer cette étape'}
              </Button>
            )}
            {canRewindToSelectedStep && (
              <Button variant="outline" onClick={handleRewindToSelectedStep} disabled={actionBusy === 'rewind'} size="sm">
                {actionBusy === 'rewind' ? 'Repositionnement...' : 'Repartir depuis cette étape'}
              </Button>
            )}
            {deliverable?.pageHref && (
              <Link href={deliverable.pageHref} className="inline-flex">
                <Button variant={selectedStatus === 'running' ? 'default' : 'outline'} size="sm">
                  {getStepViewLabel(selectedStep)}
                </Button>
              </Link>
            )}
            <Link href={`/runs/${id}/preview`} className="inline-flex">
              <Button variant="outline" size="sm">Preview</Button>
            </Link>
            <Link href={`/runs/${id}/storyboard`} className="inline-flex">
              <Button variant="outline" size="sm">Storyboard</Button>
            </Link>
            <Link href={`/runs/${id}/studio`} className="inline-flex">
              <Button variant="outline" size="sm">Réunion</Button>
            </Link>
          </div>

          {runNotice && (
            <div className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              {runNotice}
            </div>
          )}

          {deliverableNotice && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {deliverableNotice}
            </div>
          )}

          {loadingDeliverable ? (
            <div className="rounded-md border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
              Chargement du livrable...
            </div>
          ) : deliverable?.editable ? (
            <div className="space-y-3">
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>
                  {selectedStatus === 'running'
                    ? `Cette étape est en cours. Si le contenu est encore vide, c’est normal : ${getStepActionLabel(selectedStep)} remplit ce livrable automatiquement.`
                    : 'Édition clavier active.'}
                </div>
                <div>
                  Raccourci : <span className="font-mono">⌘/Ctrl + S</span> pour sauvegarder.
                </div>
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault()
                    void saveDeliverable()
                  }
                }}
                placeholder={selectedStatus === 'running'
                  ? `Étape en cours : ${getStepActionLabel(selectedStep)}. Le contenu apparaîtra ici dès que le système aura fini. Si tu veux voir le détail maintenant, ouvre la vue dédiée.`
                  : `Contenu éditable de l’étape ${selectedStep}.`}
                className="min-h-108 w-full rounded-md border bg-background p-3 font-mono text-xs"
              />
              <div className="flex justify-end">
                <Button onClick={saveDeliverable} disabled={savingDeliverable}>
                  {savingDeliverable ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                {deliverable?.summary ?? 'Aucun livrable disponible pour cette étape.'}
              </div>
              <pre className="max-h-108 overflow-auto rounded-md border bg-background p-3 text-xs whitespace-pre-wrap wrap-break-word">
                {deliverablePreview || 'Aucun contenu texte à afficher ici. Utilise la vue dédiée pour consulter le livrable.'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
