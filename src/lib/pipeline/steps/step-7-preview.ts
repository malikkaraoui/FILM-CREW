import { readFile, writeFile, access, mkdir, unlink } from 'fs/promises'
import { join, extname } from 'path'
import { spawn } from 'child_process'
import { logger } from '@/lib/logger'
import type { PipelineStep, StepContext, StepResult } from '../types'

// Taxonomie fixe (registre risques R6) :
//   video_finale  = clips vidéo réels assemblés
//   animatic      = slideshow storyboard + audio
//   storyboard_only = storyboard sans audio
//   none          = aucun artefact visuel
export type MediaMode = 'video_finale' | 'animatic' | 'storyboard_only' | 'none'

const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg'
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const SECONDS_PER_IMAGE = 3 // durée par image en animatic

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args)
    let stderr = ''
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-300)}`))
    })
    proc.on('error', (err) => reject(new Error(`ffmpeg spawn: ${err.message}`)))
  })
}

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true } catch { return false }
}

/**
 * Assemble les clips vidéo en video_finale.mp4 via concat.
 * Si audio fourni, le mixe avec -shortest.
 */
async function assembleVideoFinale(
  concatPath: string,
  audioPath: string | null,
  outputPath: string,
): Promise<void> {
  const args = ['-f', 'concat', '-safe', '0', '-i', concatPath]
  if (audioPath) {
    args.push('-i', audioPath, '-c:v', 'copy', '-c:a', 'aac', '-shortest')
  } else {
    args.push('-c', 'copy')
  }
  args.push('-y', outputPath)
  await runFFmpeg(args)
}

/**
 * Assemble un animatic à partir d'images storyboard + audio optionnel.
 * Chaque image est affichée SECONDS_PER_IMAGE secondes.
 */
async function assembleAnimatic(
  images: string[],
  audioPath: string | null,
  outputDir: string,
  outputPath: string,
): Promise<void> {
  // Créer le fichier concat pour les images (format FFmpeg avec durée)
  const lines: string[] = []
  for (const img of images) {
    lines.push(`file '${img}'`)
    lines.push(`duration ${SECONDS_PER_IMAGE}`)
  }
  // Dernière image répétée (quirk FFmpeg concat)
  if (images.length > 0) lines.push(`file '${images[images.length - 1]}'`)
  const imageConcatPath = join(outputDir, '_image_concat.txt')
  await writeFile(imageConcatPath, lines.join('\n'))

  const tempSlide = join(outputDir, '_slide_temp.mp4')

  try {
    // Étape 1 : slideshow images → MP4 (scale + pad pour 1080x1920)
    // -r 24 : forcer 24fps pour éviter un slideshow à 1 frame par image
    await runFFmpeg([
      '-f', 'concat', '-safe', '0', '-i', imageConcatPath,
      '-r', '24',
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-y', tempSlide,
    ])

    // Étape 2 : merge audio ou copier direct
    if (audioPath && await fileExists(audioPath)) {
      await runFFmpeg([
        '-i', tempSlide, '-i', audioPath,
        '-c:v', 'copy', '-c:a', 'aac', '-shortest',
        '-y', outputPath,
      ])
    } else {
      await runFFmpeg(['-i', tempSlide, '-c', 'copy', '-y', outputPath])
    }
  } finally {
    await unlink(tempSlide).catch(() => {})
    await unlink(imageConcatPath).catch(() => {})
  }
}

export const step7Preview: PipelineStep = {
  name: 'Preview',
  stepNumber: 7,

  async execute(ctx: StepContext): Promise<StepResult> {
    // ─── Lecture des manifests ────────────────────────────────────────────────
    let genManifest: { clips: { sceneIndex: number; filePath: string }[]; audioPath: string | null }
    try {
      const raw = await readFile(join(ctx.storagePath, 'generation-manifest.json'), 'utf-8')
      genManifest = JSON.parse(raw)
    } catch {
      return { success: false, costEur: 0, outputData: null, error: 'generation-manifest.json introuvable' }
    }

    let storyboardImages: { sceneIndex: number; filePath: string; status: string }[] = []
    try {
      const raw = await readFile(join(ctx.storagePath, 'storyboard', 'manifest.json'), 'utf-8')
      storyboardImages = JSON.parse(raw).images ?? []
    } catch { /* pas de storyboard */ }

    // ─── Validation des clips ─────────────────────────────────────────────────
    const validClips: string[] = []
    for (const clip of genManifest.clips) {
      if (await fileExists(clip.filePath)) validClips.push(clip.filePath)
      else logger.warn({ event: 'clip_missing', runId: ctx.runId, path: clip.filePath })
    }

    // ─── Validation des images storyboard ────────────────────────────────────
    const validImages = storyboardImages
      .filter(i => i.status === 'generated' && IMAGE_EXTENSIONS.has(extname(i.filePath).toLowerCase()))
      .map(i => i.filePath)
      .filter(async () => true) // sera filtré plus bas

    const realImages: string[] = []
    for (const p of validImages) {
      if (await fileExists(p)) realImages.push(p)
    }

    const audioPath = genManifest.audioPath
    const hasAudio = !!(audioPath && await fileExists(audioPath))

    // ─── Dossier final/ ───────────────────────────────────────────────────────
    const finalDir = join(ctx.storagePath, 'final')
    await mkdir(finalDir, { recursive: true })

    // ─── Concat.txt pour clips ────────────────────────────────────────────────
    const concatPath = join(finalDir, 'concat.txt')
    if (validClips.length > 0) {
      await writeFile(concatPath, validClips.map(p => `file '${p}'`).join('\n'))
    }

    // ─── Assemblage FFmpeg ────────────────────────────────────────────────────
    let mode: MediaMode = 'none'
    let playableFilePath: string | null = null
    let assemblyError: string | null = null

    if (validClips.length > 0) {
      // Chemin 1 : video finale
      const outputPath = join(finalDir, 'video.mp4')
      try {
        await assembleVideoFinale(concatPath, hasAudio ? audioPath! : null, outputPath)
        if (await fileExists(outputPath)) {
          mode = 'video_finale'
          playableFilePath = outputPath
          logger.info({ event: 'video_finale_assembled', runId: ctx.runId, path: outputPath })
        }
      } catch (e) {
        assemblyError = (e as Error).message
        logger.warn({ event: 'video_finale_failed', runId: ctx.runId, error: assemblyError })
      }
    } else if (realImages.length > 0) {
      // Chemin 2 : animatic (storyboard + audio optionnel)
      const outputPath = join(finalDir, 'animatic.mp4')
      try {
        await assembleAnimatic(realImages, hasAudio ? audioPath! : null, finalDir, outputPath)
        if (await fileExists(outputPath)) {
          mode = 'animatic'
          playableFilePath = outputPath
          logger.info({ event: 'animatic_assembled', runId: ctx.runId, path: outputPath })
        }
      } catch (e) {
        assemblyError = (e as Error).message
        logger.warn({ event: 'animatic_failed', runId: ctx.runId, error: assemblyError })
        // Fallback : storyboard_only si animatic échoue
        if (realImages.length > 0) mode = 'storyboard_only'
      }
    } else if (storyboardImages.some(i => i.status === 'generated')) {
      mode = 'storyboard_only'
    }

    // ─── Preview manifest enrichi ─────────────────────────────────────────────
    const previewManifest = {
      mode,
      mediaType: mode === 'video_finale' ? 'video/mp4' : mode === 'animatic' ? 'video/mp4' : null,
      playableFilePath,
      clips: validClips,
      storyboardImages: storyboardImages
        .filter(i => i.status === 'generated')
        .map(i => i.filePath),
      audioPath: genManifest.audioPath,
      concatPath: validClips.length > 0 ? concatPath : null,
      readyForAssembly: validClips.length > 0,
      hasStoryboard: realImages.length > 0,
      hasAudio,
      assemblyError,
      createdAt: new Date().toISOString(),
    }

    await writeFile(
      join(ctx.storagePath, 'preview-manifest.json'),
      JSON.stringify(previewManifest, null, 2),
    )

    return {
      success: true,
      costEur: 0,
      outputData: {
        mode,
        playable: !!playableFilePath,
        validClipCount: validClips.length,
        totalClips: genManifest.clips.length,
        imageCount: realImages.length,
        hasStoryboard: realImages.length > 0,
        readyForAssembly: validClips.length > 0,
        hasAudio,
        assemblyError,
      },
    }
  },
}
