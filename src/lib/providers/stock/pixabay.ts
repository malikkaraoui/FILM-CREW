import type { StockProvider, StockOpts, StockResult, ProviderHealth } from '../types'

const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || ''
const BASE_URL = 'https://pixabay.com/api'

export const pixabayProvider: StockProvider = {
  name: 'pixabay',
  type: 'stock',

  async healthCheck(): Promise<ProviderHealth> {
    if (!PIXABAY_API_KEY) {
      return { status: 'down', lastCheck: new Date().toISOString(), details: 'PIXABAY_API_KEY manquante' }
    }
    try {
      const res = await fetch(`${BASE_URL}/?key=${PIXABAY_API_KEY}&q=test&per_page=3`, {
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) return { status: 'free', lastCheck: new Date().toISOString() }
      return { status: 'degraded', lastCheck: new Date().toISOString(), details: `HTTP ${res.status}` }
    } catch {
      return { status: 'down', lastCheck: new Date().toISOString(), details: 'Pixabay non joignable' }
    }
  },

  estimateCost(): number {
    return 0 // Pixabay est gratuit
  },

  async search(query: string, opts: StockOpts = {}): Promise<StockResult[]> {
    if (!PIXABAY_API_KEY) throw new Error('PIXABAY_API_KEY manquante')

    const type = opts.type ?? 'image'
    const limit = opts.limit ?? 10

    let endpoint: string
    if (type === 'video') {
      endpoint = `${BASE_URL}/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&per_page=${limit}&safesearch=true`
    } else {
      endpoint = `${BASE_URL}/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&per_page=${limit}&safesearch=true&image_type=photo`
    }

    const res = await fetch(endpoint)
    if (!res.ok) throw new Error(`Pixabay erreur: ${res.status}`)
    const data = await res.json()

    if (type === 'video') {
      return (data.hits ?? []).map((v: {
        id: number
        pageURL: string
        videos: { medium: { url: string; thumbnail: string } }
        tags: string
      }) => ({
        id: String(v.id),
        source: 'pixabay',
        url: v.videos?.medium?.url ?? v.pageURL,
        thumbnailUrl: v.videos?.medium?.thumbnail ?? '',
        title: v.tags,
        type: 'video' as const,
      }))
    }

    return (data.hits ?? []).map((p: {
      id: number
      pageURL: string
      largeImageURL: string
      webformatURL: string
      tags: string
    }) => ({
      id: String(p.id),
      source: 'pixabay',
      url: p.largeImageURL ?? p.pageURL,
      thumbnailUrl: p.webformatURL,
      title: p.tags,
      type: 'image' as const,
    }))
  },

  async download(id: string): Promise<string> {
    return `https://pixabay.com/photos/${id}/`
  },
}
