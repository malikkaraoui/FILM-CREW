import { NextResponse } from 'next/server'
import { duplicateChain } from '@/lib/db/queries/chains'
import { cp, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const newId = crypto.randomUUID()
    const chain = await duplicateChain(id, newId, '')

    if (!chain) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Chaîne source introuvable' } },
        { status: 404 }
      )
    }

    // Copier le dossier Brand Kit
    const sourcePath = join(process.cwd(), 'storage', 'brands', id)
    const destPath = join(process.cwd(), 'storage', 'brands', newId)

    if (existsSync(sourcePath)) {
      await cp(sourcePath, destPath, { recursive: true })
    } else {
      await mkdir(join(destPath, 'images'), { recursive: true })
    }

    return NextResponse.json({ data: chain }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: (e as Error).message } },
      { status: 500 }
    )
  }
}
