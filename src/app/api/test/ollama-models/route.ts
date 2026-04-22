import { NextResponse } from 'next/server'

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'

export async function GET() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      return NextResponse.json({ models: [], error: `Ollama HTTP ${res.status}` })
    }
    const data = await res.json()
    const models: string[] = (data.models ?? []).map((m: { name: string }) => m.name)
    return NextResponse.json({ models })
  } catch {
    return NextResponse.json({ models: [], error: 'Ollama non joignable' })
  }
}
