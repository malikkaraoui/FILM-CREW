'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { INTENTION_BLOCS, getVisibleQuestions } from '@/lib/intention/schema'
import type { Chain } from '@/types/chain'

type CostBreakdown = {
  step: string
  provider: string
  costEur: number
  note: string
}

type CostEstimate = {
  totalEur: number
  breakdown: CostBreakdown[]
  warning: string | null
}

function NewRunForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [chains, setChains] = useState<Chain[]>([])
  const [chainId, setChainId] = useState('')
  const [idea, setIdea] = useState('')
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState('')
  const [estimate, setEstimate] = useState<CostEstimate | null>(null)
  const [loadingEstimate, setLoadingEstimate] = useState(true)
  const [templates, setTemplates] = useState<{ id: string; name: string; description: string }[]>([])
  const [templateId, setTemplateId] = useState('')

  // Questionnaire adaptatif
  const [showQuestionnaire, setShowQuestionnaire] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [openBloc, setOpenBloc] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/chains')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setChains(json.data)
          const preselect = searchParams?.get('chainId')
          const match = preselect ? (json.data as Chain[]).find((c) => c.id === preselect) : null
          if (match) {
            setChainId(match.id)
          } else if ((json.data as Chain[]).length > 0) {
            setChainId((json.data as Chain[])[0].id)
          }
        }
      })

    fetch('/api/runs/estimate')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setEstimate(json.data)
      })
      .finally(() => setLoadingEstimate(false))

    fetch('/api/templates')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setTemplates(json.data)
      })
  }, [searchParams])

  const handleAnswer = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }, [])

  const answeredCount = Object.keys(answers).length
  const visibleQuestions = getVisibleQuestions(answers)

  async function handleLaunch() {
    if (!chainId || !idea.trim()) return
    setLaunching(true)
    setError('')

    const body: Record<string, unknown> = {
      chainId,
      idea: idea.trim(),
      template: templateId || undefined,
    }

    if (showQuestionnaire && answeredCount > 0) {
      body.intention = answers
    }

    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()

    if (json.error) {
      setError(json.error.message)
      setLaunching(false)
      return
    }

    router.push(`/runs/${json.data.id}`)
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold">Nouveau run</h1>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <Label htmlFor="chain">Chaîne</Label>
          <select
            id="chain"
            value={chainId}
            onChange={(e) => setChainId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            {chains.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="idea">Idée</Label>
          <Input
            id="idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="La polémique Mbappé expliquée en 90 secondes"
          />
        </div>

        {/* Template de style */}
        {templates.length > 0 && (
          <div>
            <Label htmlFor="template">Style</Label>
            <select
              id="template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">Aucun template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} — {t.description}</option>
              ))}
            </select>
          </div>
        )}

        {/* Questionnaire adaptatif */}
        <div>
          <button
            type="button"
            onClick={() => setShowQuestionnaire((v) => !v)}
            className="flex w-full items-center justify-between rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
          >
            <span className="flex items-center gap-2">
              <span>Affiner avec le questionnaire</span>
              {answeredCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {answeredCount}/{visibleQuestions.length}
                </Badge>
              )}
            </span>
            <span className="text-muted-foreground">{showQuestionnaire ? '▲' : '▼'}</span>
          </button>

          {showQuestionnaire && (
            <div className="mt-2 space-y-2">
              {INTENTION_BLOCS.map((bloc) => {
                const blocVisible = bloc.questions.filter((q) => {
                  if (!q.showIf) return true
                  return answers[q.showIf.questionId] === q.showIf.value
                })
                const blocAnswered = blocVisible.filter((q) => answers[q.id]).length
                const isOpen = openBloc === bloc.id

                return (
                  <div key={bloc.id} className="rounded-md border border-input overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenBloc(isOpen ? null : bloc.id)}
                      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{bloc.label}</span>
                        <span className="text-xs text-muted-foreground">{bloc.description}</span>
                        {blocAnswered > 0 && (
                          <Badge variant="default" className="text-[9px]">
                            {blocAnswered}/{blocVisible.length}
                          </Badge>
                        )}
                      </span>
                      <span className="text-muted-foreground text-xs">{isOpen ? '▲' : '▼'}</span>
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 space-y-3 bg-muted/20">
                        {blocVisible.map((question) => (
                          <div key={question.id}>
                            <p className="text-xs font-medium mb-1.5 text-muted-foreground">
                              {question.label}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {question.options.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => handleAnswer(question.id, opt.value)}
                                  className={[
                                    'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                                    answers[question.id] === opt.value
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'border-input hover:bg-accent',
                                  ].join(' ')}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Estimation de coût */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Coût estimé</CardTitle>
            {loadingEstimate ? (
              <p className="text-xs text-muted-foreground">Calcul en cours...</p>
            ) : estimate ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">{estimate.totalEur.toFixed(2)} €</span>
                  <span className="text-xs text-muted-foreground">estimation moyenne</span>
                </div>

                <div className="space-y-1">
                  {estimate.breakdown
                    .filter((b) => b.costEur > 0)
                    .map((b) => (
                      <div key={b.step} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{b.step}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground">{b.provider}</span>
                          <span className="font-mono">{b.costEur.toFixed(2)} €</span>
                        </span>
                      </div>
                    ))}
                </div>

                {estimate.warning && (
                  <div className="rounded-md border border-amber-400 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    {estimate.warning}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Estimation indisponible</p>
            )}
          </CardHeader>
        </Card>

        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button onClick={handleLaunch} disabled={launching || !chainId || !idea.trim()}>
          {launching ? 'Lancement...' : 'Lancer'}
        </Button>
      </div>
    </div>
  )
}

export default function NewRunPage() {
  return (
    <Suspense>
      <NewRunForm />
    </Suspense>
  )
}
