import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { VideoProvider, VideoOpts, VideoResult, ProviderHealth } from '../types'

// LTX Video — API cloud Lightricks (console.ltx.video)
// macOS Apple Silicon → API mode obligatoire (pas de génération locale)
const API_KEY = process.env.LTX_API_KEY || ''
const BASE_URL = 'https://api.ltx.video'
const POLL_INTERVAL_MS = 5000
const MAX_POLLS = 72 // 6 minutes max

export const ltxProvider: VideoProvider = {
  name: 'ltx',
  type: 'video',

  async healthCheck(): Promise<ProviderHealth> {
    if (!API_KEY) {
      return { status: 'down', lastCheck: new Date().toISOString(), details: 'LTX_API_KEY manquante — voir console.ltx.video' }
    }
    try {
      const res = await fetch(`${BASE_URL}/v1/models`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
        signal: AbortSignal.timeout(5000),
      })
      if (res.status < 500) return { status: 'free', lastCheck: new Date().toISOString() }
      return { status: 'degraded', lastCheck: new Date().toISOString(), details: `HTTP ${res.status}` }
    } catch {
      return { status: 'down', lastCheck: new Date().toISOString(), details: 'LTX API non joignable' }
    }
  },

  estimateCost(opts: unknown): number {
    const o = opts as VideoOpts
    const duration = o?.duration ?? 5
    // LTX Cloud ≈ 0.40€ / 5s (estimation)
    return (duration / 5) * 0.40
  },

  async generate(prompt: string, opts: VideoOpts): Promise<VideoResult> {
    if (!API_KEY) throw new Error('LTX_API_KEY manquante — voir console.ltx.video')

    const duration = opts.duration ?? 5
    const aspectRatio = opts.aspectRatio ?? '9:16'
    const [w, h] = aspectRatio === '9:16'
      ? [512, 896]
      : aspectRatio === '16:9'
        ? [896, 512]
        : [512, 512]

    // Créer la tâche de génération
    const genRes = await fetch(`${BASE_URL}/v1/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'ltxv-2.3',
        prompt,
        width: w,
        height: h,
        num_frames: Math.round(duration * 25), // 25 fps
        ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
      }),
    })

    if (!genRes.ok) {
      const err = await genRes.json().catch(() => ({}))
      throw new Error(`LTX generate erreur ${genRes.status}: ${JSON.stringify(err)}`)
    }

    const genData = await genRes.json()
    const taskId: string = genData.id ?? genData.task_id
    if (!taskId) throw new Error('LTX: task_id manquant')

    // Polling
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

      const statusRes = await fetch(`${BASE_URL}/v1/generations/${taskId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      })

      if (!statusRes.ok) continue

      const statusData = await statusRes.json()
      const status: string = statusData.status

      if (status === 'completed' || status === 'succeeded' || status === 'SUCCESS') {
        const videoUrl: string =
          statusData.output?.url ??
          statusData.video_url ??
          statusData.url

        if (!videoUrl) throw new Error('LTX: URL vidéo manquante')

        const costEur = (duration / 5) * 0.40

        const outputDir = opts.outputDir ?? tmpdir()
        await mkdir(outputDir, { recursive: true })
        const filePath = join(outputDir, `ltx-${taskId}.mp4`)

        const dlRes = await fetch(videoUrl)
        if (!dlRes.ok) throw new Error(`Échec téléchargement vidéo LTX: ${dlRes.status}`)
        const buffer = await dlRes.arrayBuffer()
        await writeFile(filePath, Buffer.from(buffer))

        return { filePath, duration, costEur, seed: opts.seed }
      }

      if (status === 'failed' || status === 'error') {
        const msg = statusData.error?.message ?? statusData.message ?? 'Génération échouée'
        throw new Error(`LTX tâche échouée: ${msg}`)
      }
    }

    throw new Error(`LTX: timeout après ${MAX_POLLS * POLL_INTERVAL_MS / 1000}s`)
  },

  async cancel(_jobId: string): Promise<void> {
    // LTX API ne supporte pas l'annulation
  },
}
