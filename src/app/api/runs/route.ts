import { NextResponse } from 'next/server'
import { getRuns, createRun, getActiveRun } from '@/lib/db/queries/runs'
import { executePipeline } from '@/lib/pipeline/engine'
import { logger } from '@/lib/logger'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { buildIntentionPrefix } from '@/lib/intention/schema'

export async function GET() {
  try {
    const runs = await getRuns()
    return NextResponse.json({ data: runs })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Vérifier qu'aucun run n'est en cours (sériel V1)
    const active = await getActiveRun()
    if (active) {
      return NextResponse.json(
        { error: { code: 'RUN_ACTIVE', message: 'Un run est déjà en cours — attendez qu\'il se termine ou arrêtez-le' } },
        { status: 409 }
      )
    }

    const body = await request.json()
    const { chainId, idea, template, type, intention } = body

    if (!chainId || !idea) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Chaîne et idée requises' } },
        { status: 400 }
      )
    }

    const id = crypto.randomUUID()
    const newRun = await createRun({ id, chainId, idea, template, type })

    // Créer le dossier storage pour ce run
    const runPath = join(process.cwd(), 'storage', 'runs', id)
    await mkdir(join(runPath, 'clips'), { recursive: true })
    await mkdir(join(runPath, 'audio'), { recursive: true })
    await mkdir(join(runPath, 'subtitles'), { recursive: true })
    await mkdir(join(runPath, 'storyboard'), { recursive: true })
    await mkdir(join(runPath, 'final'), { recursive: true })

    // Persister intention.json si le questionnaire a été rempli
    if (intention && typeof intention === 'object' && Object.keys(intention).length > 0) {
      const intentionData = {
        answers: intention,
        prefix: buildIntentionPrefix(intention as Record<string, string>),
        createdAt: new Date().toISOString(),
      }
      await writeFile(
        join(runPath, 'intention.json'),
        JSON.stringify(intentionData, null, 2),
      )
      logger.info({ event: 'intention_saved', runId: id, answeredCount: Object.keys(intention).length })
    }

    // Fire-and-forget : le pipeline tourne en arrière-plan dans le process Node.js
    executePipeline(id).catch((e) => {
      logger.error({ event: 'pipeline_crash', runId: id, error: (e as Error).message })
    })

    return NextResponse.json({ data: newRun }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}
