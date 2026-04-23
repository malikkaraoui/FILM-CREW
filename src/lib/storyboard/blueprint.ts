import { readFile } from 'fs/promises'
import { join } from 'path'
import type { StoryboardCloudPlanLike } from '@/lib/providers/image/storyboard-local'
import type { DirectorPlan } from '@/lib/pipeline/steps/step-3-json'
import type { MeetingSceneOutlineItem } from '@/types/agent'

export type StructuredStoryScene = {
  index: number
  description: string
  dialogue: string
  camera: string
  lighting: string
  duration_s: number
}

export type StructuredStoryDocument = {
  title?: string
  hook?: string
  tone?: string
  style?: string
  target_duration_s?: number
  scenes: StructuredStoryScene[]
}

export type BriefDocument = {
  summary?: string
  sections?: Array<{
    agent: string
    title?: string
    content: string
  }>
  sceneOutline?: MeetingSceneOutlineItem[]
}

export type StoryboardBlueprintScene = StoryboardCloudPlanLike & {
  sceneIndex: number
  sourceDescription: string
  sourceDialogue: string
  sourceCamera: string
  sourceLighting: string
  durationS: number | null
  directorIntent: string
  emotion: string
  influencedBy: string[]
}

export type StoryboardBlueprint = {
  version: 1
  runId: string
  title: string
  tone: string
  style: string
  creativeDirection: string
  source: 'llm' | 'fallback'
  providerUsed: string
  failoverOccurred: boolean
  generatedAt: string
  scenes: StoryboardBlueprintScene[]
}

type NormalizeBlueprintArgs = {
  runId: string
  idea: string
  structure: StructuredStoryDocument
  directorPlan?: DirectorPlan | null
  brief?: BriefDocument | null
  source: 'llm' | 'fallback'
  providerUsed: string
  failoverOccurred: boolean
  generatedAt?: string
}

const SUBJECT_HINTS = [
  { pattern: /voiture|car|auto/i, label: 'voiture' },
  { pattern: /chien|dog/i, label: 'chien' },
  { pattern: /chat|cat/i, label: 'chat' },
  { pattern: /telephone|phone|mobile|smartphone/i, label: 'téléphone' },
  { pattern: /livre|book|cahier/i, label: 'livre' },
  { pattern: /maison|house/i, label: 'maison' },
  { pattern: /arbre|tree/i, label: 'arbre' },
  { pattern: /ballon|ball/i, label: 'ballon' },
  { pattern: /cadeau|gift/i, label: 'cadeau' },
  { pattern: /fusée|fusee|rocket/i, label: 'fusée' },
  { pattern: /bouteille|bottle/i, label: 'bouteille' },
  { pattern: /soleil|sun/i, label: 'soleil' },
  { pattern: /nuage|cloud/i, label: 'nuage' },
  { pattern: /enfant|kid|garçon|garcon|fille|child/i, label: 'enfant' },
  { pattern: /homme|man|femme|woman|personne|person/i, label: 'personne' },
] as const

const OBJECT_HINTS = [
  'voiture',
  'chien',
  'chat',
  'téléphone',
  'livre',
  'maison',
  'arbre',
  'ballon',
  'cadeau',
  'fusée',
  'bouteille',
  'soleil',
  'nuage',
] as const

export async function readStoryboardBlueprint(storagePath: string): Promise<StoryboardBlueprint | null> {
  try {
    const raw = await readFile(join(storagePath, 'storyboard-blueprint.json'), 'utf-8')
    return JSON.parse(raw) as StoryboardBlueprint
  } catch {
    return null
  }
}

export function getBlueprintScene(
  blueprint: StoryboardBlueprint | null | undefined,
  sceneIndex: number,
): StoryboardBlueprintScene | null {
  return blueprint?.scenes.find((scene) => scene.sceneIndex === sceneIndex) ?? null
}

export function parseStoryboardBlueprintJson(content: string): Record<string, unknown> {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fenced?.[1]?.trim() || trimmed
  const firstBrace = source.indexOf('{')
  const lastBrace = source.lastIndexOf('}')

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('Aucun objet JSON valide trouvé pour le blueprint visuel')
  }

  return JSON.parse(source.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>
}

export function buildStoryboardBlueprintFallback(args: Omit<NormalizeBlueprintArgs, 'source' | 'providerUsed' | 'failoverOccurred'>): StoryboardBlueprint {
  return normalizeStoryboardBlueprint({}, {
    ...args,
    source: 'fallback',
    providerUsed: 'heuristic-fallback',
    failoverOccurred: false,
  })
}

export function normalizeStoryboardBlueprint(
  payload: Record<string, unknown>,
  args: NormalizeBlueprintArgs,
): StoryboardBlueprint {
  const payloadScenes = Array.isArray(payload.scenes) ? payload.scenes : []
  const generatedAt = args.generatedAt ?? new Date().toISOString()

  const scenes = args.structure.scenes.map((scene) => {
    const rawScene = asRecord(
      payloadScenes.find((entry) => {
        const candidate = asRecord(entry)
        return asInteger(candidate.sceneIndex ?? candidate.index) === scene.index
      }),
    )
    const shot = args.directorPlan?.shotList.find((entry) => entry.sceneIndex === scene.index)
    const subject = text(rawScene.primarySubject, inferPrimarySubject(scene.description, scene.dialogue))
    const action = text(rawScene.action, inferAction(scene.description, scene.dialogue))
    const childCaption = text(rawScene.childCaption, buildChildCaption(scene.description, scene.dialogue, action))
    const importantObjects = list(rawScene.importantObjects, inferImportantObjects(scene.description, scene.dialogue))

    return {
      sceneIndex: scene.index,
      panelTitle: text(rawScene.panelTitle, buildPanelTitle(scene.index, subject, action)),
      childCaption,
      primarySubject: subject,
      action,
      background: text(rawScene.background, inferBackground(scene.description)),
      framing: text(rawScene.framing, shot?.camera ?? scene.camera ?? 'plan simple'),
      lighting: text(rawScene.lighting, scene.lighting || args.directorPlan?.tone || 'lumière simple'),
      simpleShapes: list(rawScene.simpleShapes, inferSimpleShapes(subject, importantObjects)),
      importantObjects,
      drawingSteps: list(rawScene.drawingSteps, buildDrawingSteps(subject, action, importantObjects, childCaption)),
      kidNotes: list(rawScene.kidNotes, buildKidNotes(action, shot?.emotion ?? args.structure.tone ?? 'neutre')),
      sourceDescription: scene.description,
      sourceDialogue: scene.dialogue,
      sourceCamera: scene.camera,
      sourceLighting: scene.lighting,
      durationS: Number.isFinite(scene.duration_s) ? scene.duration_s : null,
      directorIntent: text(rawScene.directorIntent, shot?.intent ?? ''),
      emotion: text(rawScene.emotion, shot?.emotion ?? args.directorPlan?.tone ?? args.structure.tone ?? 'neutre'),
      influencedBy: list(rawScene.influencedBy, shot?.influencedBy ?? ['structure']),
    }
  })

  return {
    version: 1,
    runId: args.runId,
    title: text(payload.title, args.structure.title ?? args.idea),
    tone: text(payload.tone, args.directorPlan?.tone ?? args.structure.tone ?? 'neutre'),
    style: text(payload.style, args.directorPlan?.style ?? args.structure.style ?? 'storyboard rough'),
    creativeDirection: text(
      payload.creativeDirection,
      args.directorPlan?.creativeDirection ?? args.brief?.summary ?? 'Storyboard simple, lisible et très concret.',
    ),
    source: args.source,
    providerUsed: args.providerUsed,
    failoverOccurred: args.failoverOccurred,
    generatedAt,
    scenes,
  }
}

function buildPanelTitle(sceneIndex: number, subject: string, action: string): string {
  const shortSubject = truncateWords(subject, 2)
  const shortAction = truncateWords(action, 3)
  return truncateWords(`Scène ${sceneIndex} ${shortSubject} ${shortAction}`.trim(), 5)
}

function buildChildCaption(description: string, dialogue: string, action: string): string {
  const source = dialogue.trim() || action.trim() || description.trim()
  return truncateWords(source, 12)
}

function inferPrimarySubject(description: string, dialogue: string): string {
  const haystack = `${description} ${dialogue}`
  for (const hint of SUBJECT_HINTS) {
    if (hint.pattern.test(haystack)) return hint.label
  }
  return 'personnage principal'
}

function inferAction(description: string, dialogue: string): string {
  const sentence = firstSentence(description) || firstSentence(dialogue)
  return truncateWords(sentence || 'fait une action facile à comprendre', 12)
}

function inferBackground(description: string): string {
  const locationMatch = description.match(/\b(dans|devant|sur|au|aux|près de|pres de|face à|face a)\b[^,.!]+/i)
  if (locationMatch?.[0]) return truncateWords(locationMatch[0], 12)
  const sentence = firstSentence(description)
  return truncateWords(sentence || 'décor minimal autour du sujet', 12)
}

function inferImportantObjects(description: string, dialogue: string): string[] {
  const haystack = normalizeWhitespace(`${description} ${dialogue}`).toLowerCase()
  const objects = OBJECT_HINTS.filter((label) => haystack.includes(stripDiacritics(label).toLowerCase()) || haystack.includes(label.toLowerCase()))
  return uniqueStrings(objects.length > 0 ? objects : ['objet simple'])
}

function inferSimpleShapes(subject: string, objects: string[]): string[] {
  const shapes = ['cercles', 'ovales', 'lignes droites']
  const haystack = `${subject} ${objects.join(' ')}`.toLowerCase()
  if (haystack.includes('voiture')) shapes.push('rectangles')
  if (haystack.includes('maison')) shapes.push('triangle pour le toit')
  if (haystack.includes('arbre')) shapes.push('nuage rond pour les feuilles')
  if (haystack.includes('téléphone') || haystack.includes('telephone')) shapes.push('petit rectangle')
  return uniqueStrings(shapes)
}

function buildDrawingSteps(subject: string, action: string, objects: string[], caption: string): string[] {
  const firstObject = objects.find(Boolean)
  return uniqueStrings([
    `dessine ${truncateWords(subject, 4)}`,
    firstObject ? `ajoute ${truncateWords(firstObject, 4)}` : 'ajoute le décor minimum',
    `montre ${truncateWords(action, 6)}`,
    `écris ${truncateWords(caption, 6)}`,
  ])
}

function buildKidNotes(action: string, emotion: string): string[] {
  return uniqueStrings([
    `on doit comprendre ${truncateWords(action, 6)}`,
    `ambiance ${truncateWords(emotion, 3)}`,
  ])
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function text(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const clean = normalizeWhitespace(value)
  return clean || fallback
}

function list(value: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(value)) return uniqueStrings(fallback)
  return uniqueStrings(
    value
      .map((entry) => (typeof entry === 'string' ? normalizeWhitespace(entry) : ''))
      .filter(Boolean),
  )
}

function asInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function firstSentence(textValue: string): string {
  return normalizeWhitespace(textValue).split(/[.!?\n]/).map((part) => part.trim()).find(Boolean) ?? ''
}

function truncateWords(value: string, maxWords: number): string {
  const words = normalizeWhitespace(value).split(' ').filter(Boolean)
  return words.slice(0, maxWords).join(' ').trim() || value.trim()
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean))).slice(0, 8)
}