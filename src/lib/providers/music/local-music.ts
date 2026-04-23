import { readdir } from 'fs/promises'
import { join, extname } from 'path'
import { existsSync } from 'fs'
import { createHash } from 'crypto'

const MUSIC_LIBRARY_PATH = process.env.MUSIC_LIBRARY_PATH
  || join(process.cwd(), 'storage', 'music')

const MOOD_MAP: Record<string, string[]> = {
  upbeat: ['upbeat', 'energetic', 'fun', 'exciting', 'dynamic'],
  calm: ['calm', 'relaxed', 'peaceful', 'serene', 'gentle'],
  dramatic: ['dramatic', 'epic', 'intense', 'cinematic', 'suspense'],
  neutral: ['neutral', 'background', 'ambient'],
}

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg'])

/**
 * Sélection DÉTERMINISTE d'un fichier musique par hash du runId.
 * Retourne null si la bibliothèque est absente ou vide — jamais d'erreur pipeline.
 */
export async function pickBackgroundMusic(tone: string | undefined, runId: string): Promise<string | null> {
  if (!existsSync(MUSIC_LIBRARY_PATH)) return null

  // Trouver le dossier mood correspondant au tone
  const toneLower = (tone ?? '').toLowerCase()
  let moodDir: string | null = null

  for (const [mood, keywords] of Object.entries(MOOD_MAP)) {
    if (keywords.some((kw) => toneLower.includes(kw))) {
      moodDir = join(MUSIC_LIBRARY_PATH, mood)
      break
    }
  }

  // Fallback : neutral → racine
  const searchDir = moodDir && existsSync(moodDir)
    ? moodDir
    : join(MUSIC_LIBRARY_PATH, 'neutral')
  const finalDir = existsSync(searchDir) ? searchDir : MUSIC_LIBRARY_PATH

  try {
    const files = await readdir(finalDir)
    const audioFiles = files.filter((f) => AUDIO_EXTENSIONS.has(extname(f).toLowerCase()))
    if (audioFiles.length === 0) return null

    // Sélection déterministe par hash runId
    const hash = createHash('sha256').update(runId).digest()
    const idx = hash.readUInt32BE(0) % audioFiles.length
    return join(finalDir, audioFiles[idx])
  } catch {
    return null
  }
}
