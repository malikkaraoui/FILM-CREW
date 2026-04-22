import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { ollamaProvider } from '@/lib/providers/llm/ollama'
import {
	composeStoryboardBoard,
	mergeStoryboardPromptWithCloudPlan,
	storyboardLocalProvider,
} from '@/lib/providers/image/storyboard-local'
import { logger } from '@/lib/logger'
import type { StoryboardBlueprintScene } from '@/lib/storyboard/blueprint'

export type CloudPlanStatus = 'queued' | 'ready' | 'failed'

export type StoryboardCloudPlan = {
	sceneIndex: number
	panelTitle: string
	childCaption: string
	primarySubject: string
	action: string
	background: string
	framing: string
	lighting: string
	simpleShapes: string[]
	importantObjects: string[]
	drawingSteps: string[]
	kidNotes: string[]
	model: string
	mode: string
	generatedAt: string
	rawPrompt: string
}

export type QueueStoryboardCloudPlanInput = {
	runId: string
	storagePath: string
	sceneIndex: number
	description: string
	prompt: string
	camera?: string
	lighting?: string
	durationS?: number
	blueprint?: StoryboardBlueprintScene | null
}

export type QueueStoryboardCloudBatchInput = {
	runId: string
	storagePath: string
	scenes: QueueStoryboardCloudPlanInput[]
}

export type StoryboardCloudQueueResult = {
	queued: boolean
	sceneCount: number
	model?: string
	mode?: string
	reason?: string
}

type StoryboardManifest = {
	images: Array<{
		sceneIndex: number
		description: string
		prompt?: string
		filePath: string
		status: string
		providerUsed?: string | null
		failoverOccurred?: boolean
		isPlaceholder?: boolean
		cloudPlanStatus?: CloudPlanStatus | null
		cloudPlanModel?: string | null
		cloudPlanMode?: string | null
		cloudPlanFilePath?: string | null
		cloudPlanRequestedAt?: string | null
		cloudPlanCompletedAt?: string | null
		cloudPlanAppliedAt?: string | null
		cloudPlanError?: string | null
	}>
	boardFilePath?: string | null
	boardLayout?: string | null
}

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on'])
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off'])

function getStoryboardCloudEnabledValue(): string {
	return (process.env.OLLAMA_STORYBOARD_CLOUD_ENABLED ?? '').trim()
}

function getStoryboardCloudApiKey(): string | undefined {
	const explicitApiKey = process.env.OLLAMA_API_KEY?.trim()
	if (explicitApiKey) return explicitApiKey

	const legacyValue = getStoryboardCloudEnabledValue()
	const lowered = legacyValue.toLowerCase()
	if (!legacyValue || ENABLED_VALUES.has(lowered) || DISABLED_VALUES.has(lowered)) {
		return undefined
	}

	return legacyValue
}

function isStoryboardCloudEnabled(): boolean {
	const enabledValue = getStoryboardCloudEnabledValue()
	if (!enabledValue) return Boolean(getStoryboardCloudApiKey())

	const lowered = enabledValue.toLowerCase()
	if (ENABLED_VALUES.has(lowered)) return true
	if (DISABLED_VALUES.has(lowered)) return false
	return true
}

function getStoryboardCloudModel(): string {
	return (process.env.OLLAMA_STORYBOARD_CLOUD_MODEL || 'gemma4:31b-cloud').trim()
}

function resolveStoryboardCloudTarget(): {
	host: string
	headers?: Record<string, string>
	mode: 'direct' | 'local-proxy' | 'local-proxy-cloud'
} {
	const apiKey = getStoryboardCloudApiKey()
	if (apiKey) {
		return {
			host: (process.env.OLLAMA_CLOUD_URL || 'https://ollama.com').trim(),
			headers: { Authorization: `Bearer ${apiKey}` },
			mode: 'direct',
		}
	}

	const model = getStoryboardCloudModel()
	return {
		host: (process.env.OLLAMA_URL || 'http://localhost:11434').trim(),
		mode: model.includes(':cloud') ? 'local-proxy-cloud' : 'local-proxy',
	}
}

export async function queueStoryboardCloudPlanGeneration(
	input: QueueStoryboardCloudPlanInput,
): Promise<StoryboardCloudQueueResult> {
	return queueStoryboardCloudBatchGeneration({
		runId: input.runId,
		storagePath: input.storagePath,
		scenes: [input],
	})
}

export async function queueStoryboardCloudBatchGeneration(
	input: QueueStoryboardCloudBatchInput,
): Promise<StoryboardCloudQueueResult> {
	if (input.scenes.length === 0) {
		return { queued: false, sceneCount: 0, reason: 'empty' }
	}

	if (!isStoryboardCloudEnabled()) {
		return { queued: false, sceneCount: input.scenes.length, reason: 'disabled' }
	}

	const model = getStoryboardCloudModel()
	const target = resolveStoryboardCloudTarget()
	const requestedAt = new Date().toISOString()

	for (const scene of input.scenes) {
		await updateManifestScene(input.storagePath, scene.sceneIndex, (image) => {
			image.cloudPlanStatus = 'queued'
			image.cloudPlanModel = model
			image.cloudPlanMode = target.mode
			image.cloudPlanRequestedAt = requestedAt
			image.cloudPlanCompletedAt = null
			image.cloudPlanAppliedAt = null
			image.cloudPlanError = null
		})
	}

	setTimeout(() => {
		void runStoryboardCloudBatch(input, target, model)
	}, 0)

	return {
		queued: true,
		sceneCount: input.scenes.length,
		model,
		mode: target.mode,
	}
}

async function runStoryboardCloudBatch(
	input: QueueStoryboardCloudBatchInput,
	target: ReturnType<typeof resolveStoryboardCloudTarget>,
	model: string,
): Promise<void> {
	for (const scene of input.scenes) {
		try {
			const plan = await generateStoryboardCloudPlan(scene, target, model)
			const cloudDir = join(input.storagePath, 'storyboard', 'cloud')
			await mkdir(cloudDir, { recursive: true })
			const filePath = join(cloudDir, `scene-${scene.sceneIndex}-plan.json`)
			await writeFile(filePath, JSON.stringify(plan, null, 2))
			const applyResult = await applyCloudPlanToStoryboardScene({
				storagePath: input.storagePath,
				sceneIndex: scene.sceneIndex,
				prompt: scene.prompt,
				plan,
				planFilePath: filePath,
				model,
				mode: target.mode,
			})

			logger.info({
				event: 'storyboard_cloud_plan_ready',
				runId: input.runId,
				sceneIndex: scene.sceneIndex,
				model,
				mode: target.mode,
				filePath,
				appliedFilePath: applyResult.filePath,
			})
		} catch (error) {
			const message = (error as Error).message
			await updateManifestScene(input.storagePath, scene.sceneIndex, (image) => {
				image.cloudPlanStatus = 'failed'
				image.cloudPlanModel = model
				image.cloudPlanMode = target.mode
				image.cloudPlanCompletedAt = new Date().toISOString()
				image.cloudPlanError = message
			})

			logger.warn({
				event: 'storyboard_cloud_plan_failed',
				runId: input.runId,
				sceneIndex: scene.sceneIndex,
				model,
				mode: target.mode,
				error: message,
			})
		}
	}
}

async function applyCloudPlanToStoryboardScene(args: {
	storagePath: string
	sceneIndex: number
	prompt: string
	plan: StoryboardCloudPlan
	planFilePath: string
	model: string
	mode: string
}): Promise<{ filePath: string; appliedAt: string }> {
	const manifestPath = join(args.storagePath, 'storyboard', 'manifest.json')
	const rawManifest = await readFile(manifestPath, 'utf-8')
	const manifest = JSON.parse(rawManifest) as StoryboardManifest
	const image = manifest.images.find((entry) => entry.sceneIndex === args.sceneIndex)
	if (!image) {
		throw new Error(`Scene ${args.sceneIndex} absente du manifest storyboard`)
	}

	const storyboardDir = join(args.storagePath, 'storyboard')
	const renderPrompt = mergeStoryboardPromptWithCloudPlan(image.prompt || args.prompt, args.plan)
	const result = await storyboardLocalProvider.generate(renderPrompt, {
		width: 1280,
		height: 720,
		style: 'storyboard-rough-local',
		outputDir: storyboardDir,
	})

	const appliedAt = new Date().toISOString()
	image.filePath = result.filePath
	image.status = 'generated'
	image.providerUsed = storyboardLocalProvider.name
	image.failoverOccurred = false
	image.isPlaceholder = false
	image.cloudPlanStatus = 'ready'
	image.cloudPlanModel = args.model
	image.cloudPlanMode = args.mode
	image.cloudPlanFilePath = args.planFilePath
	image.cloudPlanCompletedAt = args.plan.generatedAt
	image.cloudPlanAppliedAt = appliedAt
	image.cloudPlanError = null

	const board = await composeStoryboardBoard(manifest.images, storyboardDir)
	manifest.boardFilePath = board.filePath
	manifest.boardLayout = `${board.columns}x${board.rows}`

	await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
	return { filePath: result.filePath, appliedAt }
}

async function generateStoryboardCloudPlan(
	scene: QueueStoryboardCloudPlanInput,
	target: ReturnType<typeof resolveStoryboardCloudTarget>,
	model: string,
): Promise<StoryboardCloudPlan> {
	const result = await ollamaProvider.chat(
		[
			{ role: 'system', content: buildSystemPrompt() },
			{ role: 'user', content: buildUserPrompt(scene) },
		],
		{
			model,
			temperature: 0.2,
			maxTokens: 1200,
			host: target.host,
			headers: target.headers,
			timeoutMs: 90000,
		},
	)

	const payload = parseJsonResponse(result.content)
	return normalizeStoryboardCloudPlan(payload, scene, model, target.mode)
}

function buildSystemPrompt(): string {
	return [
		'Tu aides a fabriquer un storyboard noir et blanc ultra simple.',
		'Tu raisonnes comme si un enfant de 10 ans devait dessiner la scene au feutre noir sur une feuille A4.',
		'Tu ne proposes jamais de rendu photo, jamais de jargon cinema inutile, jamais de detail impossible a dessiner vite.',
		'Tu reponds uniquement avec un objet JSON valide, sans markdown, sans commentaire autour.',
		'Tu privilegies des formes simples, des actions lisibles, un decor minimal, et une phrase courte qui explique ce qu il se passe.',
	].join('\n')
}

function buildUserPrompt(scene: QueueStoryboardCloudPlanInput): string {
	return [
		'Fabrique un drawing plan JSON pour une seule vignette storyboard.',
		'Le schema attendu est :',
		'{',
		'  "panelTitle": "titre tres court",',
		'  "childCaption": "phrase simple qui explique ce qu il se passe",',
		'  "primarySubject": "sujet principal",',
		'  "action": "action principale",',
		'  "background": "decor minimal",',
		'  "framing": "cadrage simple",',
		'  "lighting": "ambiance lumineuse simple",',
		'  "simpleShapes": ["formes tres faciles a dessiner"],',
		'  "importantObjects": ["objets importants"],',
		'  "drawingSteps": ["instructions courtes pour dessiner"],',
		'  "kidNotes": ["indices de lecture tres simples"]',
		'}',
		'',
		`sceneIndex: ${scene.sceneIndex}`,
		`description: ${scene.description}`,
		`camera: ${scene.camera || 'Static camera'}`,
		`lighting: ${scene.lighting || 'Natural light'}`,
		`duration: ${scene.durationS ?? 5}s`,
		...(scene.blueprint ? [
			'',
			'visual_blueprint_json:',
			JSON.stringify({
				panelTitle: scene.blueprint.panelTitle,
				childCaption: scene.blueprint.childCaption,
				primarySubject: scene.blueprint.primarySubject,
				action: scene.blueprint.action,
				background: scene.blueprint.background,
				framing: scene.blueprint.framing,
				lighting: scene.blueprint.lighting,
				simpleShapes: scene.blueprint.simpleShapes,
				importantObjects: scene.blueprint.importantObjects,
				drawingSteps: scene.blueprint.drawingSteps,
				kidNotes: scene.blueprint.kidNotes,
				directorIntent: scene.blueprint.directorIntent,
				emotion: scene.blueprint.emotion,
			}, null, 2),
		] : []),
		'',
		'prompt_source:',
		scene.prompt,
		'',
		'Important : la caption doit etre concrete, lisible, et tenir sous un dessin. Les drawingSteps doivent rester tres simples. Si un blueprint visuel est fourni, il est prioritaire et doit etre affine, pas ignore.',
	].join('\n')
}

function parseJsonResponse(content: string): Record<string, unknown> {
	const trimmed = content.trim()
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
	const source = fenced?.[1]?.trim() || trimmed
	const firstBrace = source.indexOf('{')
	const lastBrace = source.lastIndexOf('}')

	if (firstBrace < 0 || lastBrace <= firstBrace) {
		throw new Error('Plan cloud Ollama non parseable en JSON')
	}

	return JSON.parse(source.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>
}

function normalizeStoryboardCloudPlan(
	payload: Record<string, unknown>,
	scene: QueueStoryboardCloudPlanInput,
	model: string,
	mode: string,
): StoryboardCloudPlan {
	const text = (value: unknown, fallback: string): string => {
		if (typeof value !== 'string') return fallback
		const clean = value.trim()
		return clean || fallback
	}

	const list = (value: unknown, fallback: string[]): string[] => {
		if (!Array.isArray(value)) return fallback
		return value
			.map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
			.filter(Boolean)
			.slice(0, 8)
	}

	return {
		sceneIndex: scene.sceneIndex,
		panelTitle: text(payload.panelTitle, scene.blueprint?.panelTitle || `Scene ${scene.sceneIndex}`),
		childCaption: text(payload.childCaption, scene.blueprint?.childCaption || scene.description),
		primarySubject: text(payload.primarySubject, scene.blueprint?.primarySubject || 'personnage principal'),
		action: text(payload.action, scene.blueprint?.action || 'fait une action simple'),
		background: text(payload.background, scene.blueprint?.background || 'decor minimal'),
		framing: text(payload.framing, scene.blueprint?.framing || scene.camera || 'static camera'),
		lighting: text(payload.lighting, scene.blueprint?.lighting || scene.lighting || 'natural light'),
		simpleShapes: list(payload.simpleShapes, scene.blueprint?.simpleShapes || ['cercles', 'lignes', 'ovales']),
		importantObjects: list(payload.importantObjects, scene.blueprint?.importantObjects || []),
		drawingSteps: list(payload.drawingSteps, scene.blueprint?.drawingSteps || [
			'dessine le sujet principal en grand',
			'ajoute le decor minimum pour comprendre la scene',
			'ecris la phrase simple en dessous',
		]),
		kidNotes: list(payload.kidNotes, scene.blueprint?.kidNotes || []),
		model,
		mode,
		generatedAt: new Date().toISOString(),
		rawPrompt: scene.prompt,
	}
}

async function updateManifestScene(
	storagePath: string,
	sceneIndex: number,
	mutate: (image: StoryboardManifest['images'][number]) => void,
): Promise<void> {
	const manifestPath = join(storagePath, 'storyboard', 'manifest.json')

	let manifest: StoryboardManifest
	try {
		manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as StoryboardManifest
	} catch {
		return
	}

	const image = manifest.images.find((entry) => entry.sceneIndex === sceneIndex)
	if (!image) return

	mutate(image)
	await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
}