import { NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { executeWithFailover } from '@/lib/providers/failover'
import type { LLMProvider, TTSProvider } from '@/lib/providers/types'
import { logger } from '@/lib/logger'
import { SUPPORTED_LANGUAGES } from '@/lib/localization'

export type LocalizeManifestEntry = {
  lang: string
  langLabel: string
  status: 'completed' | 'failed'
  scriptPath: string | null
  ttsPath: string | null
  /** Non-régénération visuelle garantie : les clips et images sources ne sont jamais retouchés */
  visualReused: true
  costEur: number
}

export type LocalizeManifest = {
  runId: string
  version: 1
  /** Langue source du run (langSource de la chaîne) */
  sourceLang: string
  languages: LocalizeManifestEntry[]
  totalCostEur: number
  generatedAt: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { languages } = body as { languages: string[] }

    if (!languages?.length) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Au moins une langue requise' } },
        { status: 400 },
      )
    }

    const storagePath = join(process.cwd(), 'storage', 'runs', id)
    let structure: { scenes: { dialogue: string }[] }
    try {
      const raw = await readFile(join(storagePath, 'structure.json'), 'utf-8')
      structure = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'structure.json introuvable — le run doit être terminé' } },
        { status: 404 },
      )
    }

    const narration = structure.scenes.map((s) => s.dialogue).filter(Boolean).join('\n\n')
    const manifestEntries: LocalizeManifestEntry[] = []
    let totalCost = 0

    // Lire le manifest existant pour ne pas écraser les langs déjà traitées
    const manifestPath = join(storagePath, 'localize-manifest.json')
    let existingManifest: LocalizeManifest | null = null
    try {
      existingManifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
    } catch { /* pas encore de manifest */ }

    for (const langCode of languages) {
      const lang = SUPPORTED_LANGUAGES.find((l) => l.code === langCode)
      if (!lang) continue

      const langDir = join(storagePath, 'final', langCode)
      await mkdir(langDir, { recursive: true })

      const scriptPath = join('storage', 'runs', id, 'final', langCode, 'script.txt')
      let ttsPath: string | null = null
      let entryCost = 0

      try {
        // 1. Traduire via LLM
        const { result: translation } = await executeWithFailover(
          'llm',
          async (p) => {
            const llm = p as LLMProvider
            return llm.chat(
              [
                {
                  role: 'system',
                  content: `Tu es un traducteur professionnel. Traduis le script de narration en ${lang.label}. Garde le ton, le rythme et les inflexions. Retourne UNIQUEMENT le texte traduit.`,
                },
                { role: 'user', content: narration },
              ],
              { temperature: 0.3 },
            )
          },
          id,
        )

        await writeFile(join(langDir, 'script.txt'), translation.content)
        entryCost += translation.costEur
        totalCost += translation.costEur

        // 2. TTS dans la langue cible (best-effort)
        try {
          const { result: audio } = await executeWithFailover(
            'tts',
            async (p) => {
              const tts = p as TTSProvider
              return tts.synthesize(translation.content, 'default', langCode)
            },
            id,
          )
          entryCost += audio.costEur
          totalCost += audio.costEur
          // Chercher le fichier audio produit dans langDir
          const expectedAudio = join(langDir, 'narration.wav')
          if (existsSync(expectedAudio)) {
            ttsPath = join('storage', 'runs', id, 'final', langCode, 'narration.wav')
          }
        } catch (e) {
          logger.warn({ event: 'localize_tts_failed', runId: id, lang: langCode, error: (e as Error).message })
        }

        manifestEntries.push({
          lang: langCode,
          langLabel: lang.label,
          status: 'completed',
          scriptPath,
          ttsPath,
          visualReused: true,
          costEur: entryCost,
        })

        logger.info({ event: 'localize_completed', runId: id, lang: langCode, costEur: entryCost })
      } catch (e) {
        logger.error({ event: 'localize_failed', runId: id, lang: langCode, error: (e as Error).message })
        manifestEntries.push({
          lang: langCode,
          langLabel: lang.label,
          status: 'failed',
          scriptPath: null,
          ttsPath: null,
          visualReused: true,
          costEur: 0,
        })
      }
    }

    // ── 11A — Localize Manifest ─────────────────────────────────────────────
    // Artefact traçable : chaque langue localisée avec chemin script, TTS,
    // et garantie explicite de non-régénération visuelle (visualReused: true).

    // Fusionner avec le manifest existant (langs précédemment traitées conservées)
    const previousEntries = existingManifest?.languages.filter(
      (e) => !languages.includes(e.lang)
    ) ?? []

    const manifest: LocalizeManifest = {
      runId: id,
      version: 1,
      sourceLang: 'fr',
      languages: [...previousEntries, ...manifestEntries],
      totalCostEur: (existingManifest?.totalCostEur ?? 0) + totalCost,
      generatedAt: new Date().toISOString(),
    }

    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))

    logger.info({
      event: 'localize_manifest_written',
      runId: id,
      langCount: manifest.languages.length,
      totalCostEur: manifest.totalCostEur,
    })

    return NextResponse.json({
      data: {
        results: manifestEntries,
        totalCost,
        manifest: {
          langCount: manifest.languages.length,
          completedCount: manifest.languages.filter((l) => l.status === 'completed').length,
        },
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'LOCALIZE_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
