import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { executeWithFailover } from '@/lib/providers/failover'
import type { LLMProvider } from '@/lib/providers/types'
import type { PipelineStep, StepContext, StepResult } from '../types'

export const step5Prompts: PipelineStep = {
  name: 'Prompts Seedance',
  stepNumber: 5,

  async execute(ctx: StepContext): Promise<StepResult> {
    // Lire la structure JSON
    let structure: { scenes: { index: number; description: string; dialogue: string; camera: string; lighting: string }[] }
    try {
      const raw = await readFile(join(ctx.storagePath, 'structure.json'), 'utf-8')
      structure = JSON.parse(raw)
    } catch {
      return { success: false, costEur: 0, outputData: null, error: 'structure.json introuvable' }
    }

    // Charger le Brand Kit pour le prompt anchoring
    let brandContext = ''
    if (ctx.brandKitPath) {
      try {
        const raw = await readFile(join(process.cwd(), ctx.brandKitPath, 'brand.json'), 'utf-8')
        const brand = JSON.parse(raw)
        brandContext = `\nBrand Kit — style: ${brand.style || 'N/A'}, palette: ${brand.palette || 'N/A'}, ton: ${brand.tone || 'N/A'}.`
      } catch { /* pas de brand kit */ }
    }

    const { result } = await executeWithFailover(
      'llm',
      async (p) => {
        const llm = p as LLMProvider
        return llm.chat(
          [
            {
              role: 'system',
              content: `Tu es un Prompt Engineer vidéo. Pour chaque scène, génère un prompt Seedance structuré en 4 couches :
1. Sujet + action (ce qui se passe)
2. Dialogue/son (narration ou ambiance sonore)
3. Audio environnemental (bruits d'ambiance)
4. Style + émotion (mood, esthétique)

Chaque prompt doit :
- Faire 60-100 mots
- Inclure 1 seul mouvement caméra
- Inclure le lighting obligatoire
- Être optimisé pour la génération vidéo IA${brandContext}

Retourne un JSON : { "prompts": [{ "sceneIndex": 1, "prompt": "...", "negativePrompt": "..." }] }
Retourne UNIQUEMENT le JSON.`,
            },
            {
              role: 'user',
              content: `Scènes :\n${JSON.stringify(structure.scenes, null, 2)}`,
            },
          ],
          { temperature: 0.7, maxTokens: 3000 },
        )
      },
      ctx.runId,
    )

    let prompts: unknown
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      prompts = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(result.content)
    } catch {
      return {
        success: false,
        costEur: result.costEur,
        outputData: { raw: result.content },
        error: 'Impossible de parser les prompts Seedance',
      }
    }

    await writeFile(
      join(ctx.storagePath, 'prompts.json'),
      JSON.stringify(prompts, null, 2),
    )

    return {
      success: true,
      costEur: result.costEur,
      outputData: prompts,
    }
  },
}
