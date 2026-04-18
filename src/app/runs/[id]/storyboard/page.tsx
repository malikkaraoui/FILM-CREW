'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { StoryboardGrid } from '@/components/storyboard/storyboard-grid'

type StoryboardImage = {
  sceneIndex: number
  description: string
  filePath: string
  status: 'pending' | 'generated' | 'validated' | 'rejected'
}

export default function StoryboardPage() {
  const { id } = useParams<{ id: string }>()
  const [images, setImages] = useState<StoryboardImage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStoryboard()
  }, [id])

  async function loadStoryboard() {
    try {
      const res = await fetch(`/api/runs/${id}/storyboard`)
      const json = await res.json()
      if (json.data?.images) setImages(json.data.images)
    } catch { /* silencieux */ }
    setLoading(false)
  }

  async function updateImage(sceneIndex: number, updates: { description?: string; status?: string }) {
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

  if (loading) return <p className="text-sm text-muted-foreground">Chargement...</p>

  return (
    <StoryboardGrid
      images={images}
      onValidate={handleValidate}
      onReject={handleReject}
      onValidateAll={handleValidateAll}
      onEditDescription={handleEditDescription}
    />
  )
}
