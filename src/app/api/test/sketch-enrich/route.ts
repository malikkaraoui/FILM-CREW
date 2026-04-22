import { NextResponse } from 'next/server'
import { registry } from '@/lib/providers/registry'
import { bootstrapProviders } from '@/lib/providers/bootstrap'
import type { LLMProvider } from '@/lib/providers/types'

bootstrapProviders()

const SYSTEM_PROMPT = `Tu es un assistant créatif spécialisé dans l'écriture de descriptions visuelles pour des storyboards et sketches animés.

L'utilisateur te donne une idée simple en quelques mots. Tu dois la transformer en une description visuelle riche et structurée, en français, qui servira de base pour générer un sketch animé style crayon à papier.

Ta réponse doit contenir :
- Une description de la scène principale (décor, ambiance, lumière)
- Les personnages ou éléments présents et leur apparence
- Le mouvement ou l'action qui se déroule
- L'émotion ou le ton général

Garde un style concis (max 150 mots). Ne mets pas de titre ni de bullet points, écris un texte fluide et visuel.`

export async function POST(req: Request) {
  try {
    const { idea, model } = await req.json()

    if (!idea || !idea.trim()) {
      return NextResponse.json({ success: false, message: 'Idée manquante' }, { status: 400 })
    }

    const providers = registry.getByType('llm')
    const ollama = providers.find((p) => p.name === 'ollama')

    if (!ollama) {
      return NextResponse.json({ success: false, message: 'Ollama provider non trouvé' }, { status: 404 })
    }

    const result = await (ollama as LLMProvider).chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: idea },
      ],
      { model: model || 'mistral:latest', temperature: 0.8, maxTokens: 512 }
    )

    return NextResponse.json({
      success: true,
      enrichedText: result.content,
      model: result.model,
      latencyMs: result.latencyMs,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, message: (e as Error).message },
      { status: 500 }
    )
  }
}
