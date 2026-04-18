import type { StockProvider, StockOpts, StockResult, ProviderHealth } from '../types'

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || ''

export const pexelsProvider: StockProvider = {
  name: 'pexels',
  type: 'stock',

  async healthCheck(): Promise<ProviderHealth> {
    if (!PEXELS_API_KEY) {
      return { status: 'down', lastCheck: new Date().toISOString(), details: 'Clé API manquante' }
    }
    try {
      const res = await fetch('https://api.pexels.com/v1/search?query=test&per_page=1', {
        headers: { Authorization: PEXELS_API_KEY },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) return { status: 'free', lastCheck: new Date().toISOString() }
      return { status: 'degraded', lastCheck: new Date().toISOString(), details: `HTTP ${res.status}` }
    } catch {
      return { status: 'down', lastCheck: new Date().toISOString(), details: 'Pexels non joignable' }
    }
  },

  estimateCost(): number {
    return 0 // Pexels est gratuit
  },

  async search(query: string, opts: StockOpts = {}): Promise<StockResult[]> {
    if (!PEXELS_API_KEY) throw new Error('Clé API Pexels manquante')

    const type = opts.type ?? 'image'
    const limit = opts.limit ?? 10
    const endpoint = type === 'video'
      ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${limit}`
      : `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${limit}`

    const res = await fetch(endpoint, {
      headers: { Authorization: PEXELS_API_KEY },
    })

    if (!res.ok) throw new Error(`Pexels erreur: ${res.status}`)
    const data = await res.json()

    if (type === 'video') {
      return (data.videos ?? []).map((v: { id: number; url: string; image: string; user: { name: string } }) => ({
        id: String(v.id),
        source: 'pexels',
        url: v.url,
        thumbnailUrl: v.image,
        title: `Pexels video by ${v.user.name}`,
        type: 'video' as const,
      }))
    }

    return (data.photos ?? []).map((p: { id: number; url: string; src: { medium: string; original: string }; photographer: string }) => ({
      id: String(p.id),
      source: 'pexels',
      url: p.src.original,
      thumbnailUrl: p.src.medium,
      title: `Photo by ${p.photographer}`,
      type: 'image' as const,
    }))
  },

  async download(id: string): Promise<string> {
    // Retourne l'URL directe — le téléchargement se fait côté client ou pipeline
    return `https://www.pexels.com/photo/${id}/`
  },
}
