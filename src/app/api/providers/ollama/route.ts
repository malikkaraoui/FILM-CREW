import { NextResponse } from 'next/server'
import { bootstrapProviders } from '@/lib/providers/bootstrap'
import { registry } from '@/lib/providers/registry'

bootstrapProviders()

export async function GET() {
  try {
    const provider = registry.getByType('llm').find((entry) => entry.name === 'ollama')
    if (!provider) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Provider ollama introuvable' } },
        { status: 404 },
      )
    }

    const health = await provider.healthCheck()
    return NextResponse.json({
      data: {
        name: provider.name,
        type: provider.type,
        health,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'PROVIDER_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}