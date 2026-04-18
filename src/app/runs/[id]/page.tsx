'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { RunStepper } from '@/components/stepper/run-stepper'
import { Button } from '@/components/ui/button'
import type { Run, RunStep } from '@/types/run'

type RunWithSteps = Run & { steps: RunStep[] }

export default function RunPage() {
  const { id } = useParams<{ id: string }>()
  const [run, setRun] = useState<RunWithSteps | null>(null)

  useEffect(() => {
    loadRun()
    const interval = setInterval(loadRun, 3000) // polling 2-3s
    return () => clearInterval(interval)
  }, [id])

  async function loadRun() {
    const res = await fetch(`/api/runs/${id}`)
    const json = await res.json()
    if (json.data) setRun(json.data)
  }

  if (!run) return <p className="text-sm text-muted-foreground">Chargement...</p>

  const currentStep = run.currentStep ?? 1

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold truncate max-w-md">{run.idea}</h1>
        {run.status === 'running' && (
          <Button variant="destructive" size="sm">
            Arrêter
          </Button>
        )}
      </div>

      <div className="mt-4">
        <RunStepper steps={run.steps} currentStep={currentStep} />
      </div>

      <div className="mt-6 rounded-md border p-4">
        <h2 className="text-lg font-semibold">
          Étape {currentStep} — {run.steps.find((s) => s.stepNumber === currentStep)?.stepName}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Contenu de l'étape — à implémenter dans les Epics 4-7
        </p>
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span>Coût : {(run.costEur ?? 0).toFixed(2)} €</span>
        <span>Statut : {run.status}</span>
      </div>
    </div>
  )
}
