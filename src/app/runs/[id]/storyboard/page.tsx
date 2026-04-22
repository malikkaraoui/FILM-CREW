'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { StoryboardGrid } from '@/components/storyboard/storyboard-grid'

type StoryboardImage = {
  sceneIndex: number
  description: string
  prompt?: string
  filePath: string
  status: 'pending' | 'generated' | 'validated' | 'rejected'
  providerUsed?: string | null
  failoverOccurred?: boolean
  isPlaceholder?: boolean
  cloudPlanStatus?: 'queued' | 'ready' | 'failed' | null
  cloudPlanModel?: string | null
  cloudPlanMode?: string | null
  cloudPlanAppliedAt?: string | null
}

export default function StoryboardPage() {
  const { id } = useParams<{ id: string }>()
  const [images, setImages] = useState<StoryboardImage[]>([])
  const [boardFilePath, setBoardFilePath] = useState<string | null>(null)
  const [boardLayout, setBoardLayout] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [assetVersion, setAssetVersion] = useState('0')

  const loadStoryboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${id}/storyboard`)
      const json = await res.json()
      if (json.data?.images) setImages(json.data.images)
      setBoardFilePath(json.data?.boardFilePath ?? null)
      setBoardLayout(json.data?.boardLayout ?? null)
    } catch { /* silencieux */ }
    setAssetVersion(`${Date.now()}`)
    setLoading(false)
  }, [id])

  useEffect(() => {
    void loadStoryboard()
  }, [loadStoryboard])

  useEffect(() => {
    if (!images.some((image) => image.cloudPlanStatus === 'queued')) return

    const interval = window.setInterval(() => {
      void loadStoryboard()
    }, 4000)

    return () => window.clearInterval(interval)
  }, [images, loadStoryboard])

  async function updateImage(sceneIndex: number, updates: { description?: string; status?: string; prompt?: string }) {
    await fetch(`/api/runs/${id}/storyboard`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneIndex, ...updates }),
    })
    loadStoryboard()
  }

  function handleValidate(sceneIndex: number) {
    updateImage(sceneIndex, { status: 'validated' })
  }

  function handleReject(sceneIndex: number) {
    updateImage(sceneIndex, { status: 'rejected' })
  }

  function handleValidateAll() {
    for (const img of images) {
      if (img.status !== 'validated') {
        updateImage(img.sceneIndex, { status: 'validated' })
      }
    }
  }

  function handleEditDescription(sceneIndex: number, description: string) {
    updateImage(sceneIndex, { description })
  }

  function handleEditPrompt(sceneIndex: number, prompt: string) {
    updateImage(sceneIndex, { prompt })
  }

  async function handleRegenerate(sceneIndex: number, prompt?: string) {
    await fetch(`/api/runs/${id}/regenerate-scene`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'storyboard', sceneIndex, ...(prompt ? { prompt } : {}) }),
    })
    loadStoryboard()
  }

  if (loading) return <p className="text-sm text-muted-foreground">Chargement...</p>

  return (
    <StoryboardGrid
      runId={id}
      images={images}
      boardFilePath={boardFilePath}
      boardLayout={boardLayout}
      assetVersion={assetVersion}
      onValidate={handleValidate}
      onReject={handleReject}
      onValidateAll={handleValidateAll}
      onEditDescription={handleEditDescription}
      onEditPrompt={handleEditPrompt}
      onRegenerate={handleRegenerate}
    />
  )
}
