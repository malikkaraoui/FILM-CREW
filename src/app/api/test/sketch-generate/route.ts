import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { registry } from '@/lib/providers/registry'
import { bootstrapProviders } from '@/lib/providers/bootstrap'
import type { VideoProvider } from '@/lib/providers/types'
import { createSketchStatus, updateSketchStatus } from '@/lib/sketch/status'

bootstrapProviders()

async function processSketchSession(id: string, prompt: string, duration: number): Promise<void> {
  const sketchDir = join(process.cwd(), 'storage', 'test-sketch', id)

  try {
    await updateSketchStatus(id, {
      state: 'running',
      currentStep: 'validating',
      scope: 'local',
      message: 'Validation du provider sketch local',
      details: 'Vérification du provider vidéo et de ffmpeg avant rendu',
      providerUsed: 'sketch-local',
      providerMode: 'local',
    })

    const providers = registry.getByType('video')
    const sketchLocal = providers.find((p) => p.name === 'sketch-local') as VideoProvider | undefined

    if (!sketchLocal) {
      await updateSketchStatus(id, {
        state: 'error',
        currentStep: 'error',
        scope: 'local',
        message: 'Provider sketch-local introuvable',
        details: 'Aucun provider vidéo local nommé sketch-local n’a été enregistré',
        error: 'Sketch Local provider non trouvé',
        completedAt: new Date().toISOString(),
      })
      return
    }

    const health = await sketchLocal.healthCheck()
    if (health.status === 'down') {
      await updateSketchStatus(id, {
        state: 'error',
        currentStep: 'error',
        scope: 'local',
        message: 'Provider sketch-local indisponible',
        details: health.details ?? 'ffmpeg indisponible',
        providerUsed: sketchLocal.name,
        providerMode: 'local',
        error: health.details ?? 'Provider indisponible',
        completedAt: new Date().toISOString(),
      })
      return
    }

    const result = await sketchLocal.generate(prompt, {
      duration,
      outputDir: sketchDir,
      onProgress: async (event) => {
        if (event.step === 'completed') return

        await updateSketchStatus(id, {
          state: 'running',
          currentStep: event.step === 'rendering' ? 'rendering' : 'preparing',
          scope: 'local',
          message: event.message,
          details: event.details,
          providerUsed: sketchLocal.name,
          providerMode: 'local',
        })
      },
    })

    await writeFile(
      join(sketchDir, 'manifest.json'),
      JSON.stringify({
        id,
        provider: sketchLocal.name,
        durationSeconds: result.duration,
        filePath: result.filePath,
        generatedAt: new Date().toISOString(),
      }, null, 2),
    )

    await updateSketchStatus(id, {
      state: 'completed',
      currentStep: 'completed',
      scope: 'local',
      message: 'Sketch généré avec succès',
      details: `Vidéo locale prête (${result.duration}s) — consultation possible immédiatement`,
      providerUsed: sketchLocal.name,
      providerMode: 'local',
      outputFilePath: result.filePath,
      completedAt: new Date().toISOString(),
    })
  } catch (e) {
    const message = (e as Error).message
    await updateSketchStatus(id, {
      state: 'error',
      currentStep: 'error',
      scope: 'local',
      message: 'Génération du sketch interrompue',
      details: message,
      providerUsed: 'sketch-local',
      providerMode: 'local',
      error: message,
      completedAt: new Date().toISOString(),
    })
  }
}

export async function POST(req: Request) {
  try {
    const { prompt, duration } = await req.json()
    const normalizedDuration = Number(duration) > 0 ? Number(duration) : 5

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ success: false, message: 'Prompt manquant' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const sketchDir = join(process.cwd(), 'storage', 'test-sketch', id)
    await mkdir(sketchDir, { recursive: true })
    await createSketchStatus(id, prompt, normalizedDuration)

    void processSketchSession(id, prompt, normalizedDuration)

    return NextResponse.json({
      data: {
        id,
        status: 'queued',
        provider: 'sketch-local',
        storagePath: sketchDir,
        message: 'Session sketch créée — suivi disponible immédiatement',
      },
    }, { status: 202 })
  } catch (e) {
    return NextResponse.json(
      { success: false, message: (e as Error).message },
      { status: 500 }
    )
  }
}
