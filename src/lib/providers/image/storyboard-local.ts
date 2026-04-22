import { access, mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { constants } from 'fs'
import { spawn } from 'child_process'
import { join } from 'path'
import { tmpdir } from 'os'
import type { ImageProvider, ImageOpts, ImageResult, ProviderHealth } from '../types'

export type LocalStoryboardSceneInput = {
	sceneIndex?: number
	description: string
	lighting?: string
	camera?: string
	durationS?: number
	dialogue?: string
}

export type StoryboardManifestImage = {
	sceneIndex: number
	description: string
	filePath: string
	status: string
	isPlaceholder?: boolean
}

export type StoryboardBoardResult = {
	filePath: string
	columns: number
	rows: number
}

const FALLBACK_FONT = 'Arial'

export const storyboardLocalProvider: ImageProvider = {
	name: 'storyboard-local',
	type: 'image',

	async healthCheck(): Promise<ProviderHealth> {
		try {
			await access('/usr/bin/sips', constants.X_OK)
			return {
				status: 'free',
				lastCheck: new Date().toISOString(),
				details: 'Rough storyboard local via SVG + sips',
			}
		} catch {
			return {
				status: 'down',
				lastCheck: new Date().toISOString(),
				details: 'sips introuvable — provider local rough indisponible',
			}
		}
	},

	estimateCost(): number {
		return 0
	},

	async generate(prompt: string, opts: ImageOpts): Promise<ImageResult> {
		const outputDir = opts.outputDir ?? tmpdir()
		await mkdir(outputDir, { recursive: true })

		const spec = parseLocalStoryboardPrompt(prompt)
		const width = opts.width ?? 1280
		const height = opts.height ?? 720
		const stamp = Date.now()
		const sceneLabel = spec.sceneIndex ?? 'x'
		const svgPath = join(outputDir, `storyboard-scene-${sceneLabel}-${stamp}.svg`)
		const pngPath = join(outputDir, `storyboard-scene-${sceneLabel}-${stamp}.png`)

		await writeFile(svgPath, buildSceneSvg(spec, width, height), 'utf-8')
		await convertSvgToPng(svgPath, pngPath)
		await unlink(svgPath).catch(() => {})

		return { filePath: pngPath, costEur: 0 }
	},
}

export function buildLocalStoryboardPrompt(scene: LocalStoryboardSceneInput): string {
	return [
		`Scene: ${scene.sceneIndex ?? '?'}`,
		`Description: ${toAscii(scene.description) || 'Scene description unavailable'}`,
		`Lighting: ${toAscii(scene.lighting || 'Natural light')}`,
		`Camera: ${toAscii(scene.camera || 'Static camera')}`,
		`Duration: ${scene.durationS ?? 5}s`,
		...(scene.dialogue ? [`Dialogue: ${toAscii(scene.dialogue)}`] : []),
		'Style: rough storyboard sketch, monochrome ink, hand-drawn, production board, no color.',
	].join('\n')
}

export async function composeStoryboardBoard(
	images: StoryboardManifestImage[],
	outputDir: string,
): Promise<StoryboardBoardResult> {
	await mkdir(outputDir, { recursive: true })

	const count = Math.max(images.length, 1)
	const columns = count <= 4 ? 2 : 3
	const rows = Math.ceil(count / columns)
	const gap = 20
	const margin = 24
	const cellWidth = columns === 3 ? 610 : 920
	const headerHeight = 48
	const imageHeight = columns === 3 ? 300 : 420
	const captionHeight = 92
	const cellHeight = headerHeight + imageHeight + captionHeight
	const boardWidth = margin * 2 + columns * cellWidth + gap * (columns - 1)
	const boardHeight = margin * 2 + rows * cellHeight + gap * (rows - 1)
	const boardPath = join(outputDir, 'storyboard-board.png')
	const svgPath = join(outputDir, 'storyboard-board.svg')

	const cells = await Promise.all(images.map(async (image) => ({
		...image,
		imageDataUri: await readImageAsDataUri(image.filePath),
	})))

	const boardSvg = buildBoardSvg({
		cells,
		columns,
		rows,
		boardWidth,
		boardHeight,
		cellWidth,
		cellHeight,
		headerHeight,
		imageHeight,
		captionHeight,
		gap,
		margin,
	})

	await writeFile(svgPath, boardSvg, 'utf-8')
	await convertSvgToPng(svgPath, boardPath)
	await unlink(svgPath).catch(() => {})

	return { filePath: boardPath, columns, rows }
}

export function parseLocalStoryboardPrompt(prompt: string): Required<LocalStoryboardSceneInput> {
	const raw = prompt.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
	const sceneIndex = readPrefixedValue(raw, 'Scene')
	const description = readPrefixedValue(raw, 'Description') || firstSentence(prompt) || 'Scene description unavailable'
	const lighting = readPrefixedValue(raw, 'Lighting') || sentenceByKeyword(prompt, /light|lighting|soleil|lumiere|ombre|sun/i) || 'Natural light'
	const camera = readPrefixedValue(raw, 'Camera') || sentenceByKeyword(prompt, /camera|angle|plan|zoom|profile|close|macro/i) || 'Static camera'
	const durationRaw = readPrefixedValue(raw, 'Duration')
	const durationS = Number.parseInt((durationRaw || '5').replace(/[^0-9]/g, ''), 10) || 5
	const dialogue = readPrefixedValue(raw, 'Dialogue') || ''

	return {
		sceneIndex: sceneIndex ? Number.parseInt(sceneIndex.replace(/[^0-9]/g, ''), 10) || 0 : 0,
		description: toAscii(description) || 'Scene description unavailable',
		lighting: toAscii(lighting) || 'Natural light',
		camera: toAscii(camera) || 'Static camera',
		durationS,
		dialogue: toAscii(dialogue),
	}
}

async function convertSvgToPng(svgPath: string, pngPath: string): Promise<void> {
	const result = await runCommand('sips', ['-s', 'format', 'png', svgPath, '--out', pngPath])
	if (result.code !== 0) {
		throw new Error(result.stderr.slice(0, 500) || result.stdout.slice(0, 500) || 'sips SVG->PNG failed')
	}
}

async function readImageAsDataUri(filePath: string): Promise<string | null> {
	try {
		const buffer = await readFile(filePath)
		const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png'
		const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
		return `data:${mime};base64,${buffer.toString('base64')}`
	} catch {
		return null
	}
}

function buildSceneSvg(spec: Required<LocalStoryboardSceneInput>, width: number, height: number): string {
	const seed = hashString(`${spec.sceneIndex}-${spec.description}-${spec.camera}-${spec.lighting}`)
	const rng = mulberry32(seed)
	const innerWidth = width - 48
	const innerHeight = height - 220
	const sketch = buildSketchTemplate(spec, innerWidth, innerHeight, rng)
	const captionLines = wrapText(spec.description, 52, 3)
	const metaLeft = `${spec.camera} • ${spec.durationS}s`
	const metaRight = spec.lighting

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
	<style>
		.ink { fill: none; stroke: #111111; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
		.light { fill: none; stroke: #6d6d6d; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
		.thin { fill: none; stroke: #111111; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
		.shade { fill: none; stroke: #9e9e9e; stroke-width: 1.4; stroke-linecap: round; }
		.title { font-family: ${FALLBACK_FONT}; font-size: 36px; font-weight: 700; fill: #111111; }
		.meta { font-family: ${FALLBACK_FONT}; font-size: 18px; fill: #444444; }
		.caption { font-family: ${FALLBACK_FONT}; font-size: 28px; fill: #111111; }
		.small { font-family: ${FALLBACK_FONT}; font-size: 18px; fill: #595959; }
	</style>
	<rect width="${width}" height="${height}" fill="#faf9f5" />
	<rect x="6" y="6" width="${width - 12}" height="${height - 12}" fill="none" stroke="#111111" stroke-width="4" />
	<rect x="12" y="12" width="${width - 24}" height="56" fill="none" stroke="#111111" stroke-width="2" />
	<text x="28" y="50" class="title">Scene: ${spec.sceneIndex || '?'}</text>
	<g transform="translate(24,80)">
		<rect x="0" y="0" width="${innerWidth}" height="${innerHeight}" fill="#fffefa" stroke="#111111" stroke-width="2" />
		${buildHatching(innerWidth, innerHeight, rng)}
		${sketch}
		${buildNotes(spec, innerWidth, innerHeight, rng)}
	</g>
	<rect x="12" y="${height - 128}" width="${width - 24}" height="116" fill="none" stroke="#111111" stroke-width="2" />
	${captionLines.map((line, index) => `<text x="28" y="${height - 86 + index * 30}" class="caption">${escapeXml(line)}</text>`).join('')}
	<text x="28" y="${height - 20}" class="small">${escapeXml(metaLeft)}</text>
	<text x="${width - 28}" y="${height - 20}" class="small" text-anchor="end">${escapeXml(metaRight)}</text>
</svg>`
}

function buildBoardSvg(args: {
	cells: Array<StoryboardManifestImage & { imageDataUri: string | null }>
	columns: number
	rows: number
	boardWidth: number
	boardHeight: number
	cellWidth: number
	cellHeight: number
	headerHeight: number
	imageHeight: number
	captionHeight: number
	gap: number
	margin: number
}): string {
	const {
		cells, columns, rows, boardWidth, boardHeight, cellWidth, cellHeight,
		headerHeight, imageHeight, gap, margin,
	} = args

	const cellMarkup = cells.map((cell, index) => {
		const col = index % columns
		const row = Math.floor(index / columns)
		const x = margin + col * (cellWidth + gap)
		const y = margin + row * (cellHeight + gap)
		const captionLines = wrapText(cell.description, columns === 3 ? 34 : 52, 3)
		const imageX = x + 12
		const imageY = y + headerHeight + 10
		const imageWidth = cellWidth - 24
		const note = cell.status === 'generated' ? 'generated' : 'pending'

		return `
			<g>
				<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="#fffefa" stroke="#111111" stroke-width="2" />
				<rect x="${x}" y="${y}" width="${cellWidth}" height="${headerHeight}" fill="none" stroke="#111111" stroke-width="2" />
				<text x="${x + 14}" y="${y + 32}" class="title">Scene: ${cell.sceneIndex}</text>
				<rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight - 20}" fill="#ffffff" stroke="#111111" stroke-width="1.5" />
				${cell.imageDataUri && !cell.isPlaceholder
					? `<image href="${cell.imageDataUri}" x="${imageX + 2}" y="${imageY + 2}" width="${imageWidth - 4}" height="${imageHeight - 24}" preserveAspectRatio="xMidYMid meet" />`
					: `<text x="${x + cellWidth / 2}" y="${y + headerHeight + imageHeight / 2}" class="meta" text-anchor="middle">rough pending</text>`}
				${captionLines.map((line, lineIndex) => `<text x="${x + 14}" y="${y + headerHeight + imageHeight + 22 + lineIndex * 24}" class="caption">${escapeXml(line)}</text>`).join('')}
				<text x="${x + cellWidth - 14}" y="${y + cellHeight - 14}" class="small" text-anchor="end">${note}</text>
			</g>`
	}).join('')

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${boardWidth}" height="${boardHeight}" viewBox="0 0 ${boardWidth} ${boardHeight}">
	<style>
		.title { font-family: ${FALLBACK_FONT}; font-size: 26px; font-weight: 700; fill: #111111; }
		.caption { font-family: ${FALLBACK_FONT}; font-size: 20px; fill: #111111; }
		.small { font-family: ${FALLBACK_FONT}; font-size: 16px; fill: #666666; }
		.meta { font-family: ${FALLBACK_FONT}; font-size: 22px; fill: #666666; }
	</style>
	<rect width="${boardWidth}" height="${boardHeight}" fill="#f6f3ec" />
	${cellMarkup}
</svg>`
}

function buildSketchTemplate(spec: Required<LocalStoryboardSceneInput>, width: number, height: number, rng: () => number): string {
	const text = `${spec.description} ${spec.camera} ${spec.lighting}`.toLowerCase()
	if (/(oeil|eye|iris|pupil)/i.test(text)) return drawEye(width, height, rng)
	if (/(bouche|levre|mouth|lips)/i.test(text)) return drawMouth(width, height, rng)
	if (/(main|hand|flacon|bottle|produit|product|parfum|perfume)/i.test(text)) return drawHandProduct(width, height, rng)
	if (/(profil|profile|epaule|shoulder|nuque|side)/i.test(text)) return drawProfile(width, height, rng)
	if (/(visage|face|portrait|nez|nose|close up|gros plan)/i.test(text)) return drawFace(width, height, rng)
	if (/(montagne|paysage|landscape|chien|dog|sunrise|soleil|outdoor)/i.test(text)) return drawLandscape(spec, width, height, rng)
	return drawGeneric(width, height, rng)
}

function drawLandscape(spec: Required<LocalStoryboardSceneInput>, width: number, height: number, rng: () => number): string {
	const text = `${spec.description} ${spec.camera} ${spec.lighting}`.toLowerCase()
	const isSleeping = /(endorm|endort|dort|sommeil|sleep|allonge|couche)/.test(text)
	const hasBirds = /(oiseau|bird)/.test(text)
	const isMoving = /(promene|explore|marche|court|rapide|movement|mouvement)/.test(text)
	const isWake = /(reveille|wake)/.test(text)

	const dogX = isMoving ? width * 0.48 : width * 0.42
	const dogY = height - 118

	return [
		roughPath(`M 70 ${height - 150} Q 290 ${height - 280} 520 ${height - 180} T 930 ${height - 210} T ${width - 70} ${height - 165}`, rng, 'ink'),
		roughPath(`M 60 ${height - 70} Q 300 ${height - 120} 560 ${height - 90} T ${width - 60} ${height - 70}`, rng, 'ink'),
		roughCircle(width - 180, isSleeping ? 96 : 120, 48, rng, 'light'),
		drawDog(dogX, dogY, rng, isSleeping ? 'sleeping' : isMoving ? 'moving' : isWake ? 'waking' : 'standing'),
		...(hasBirds
			? [
					roughPath(`M ${width * 0.56} 138 q 18 -18 36 0 q 18 -18 36 0`, rng, 'thin'),
					roughPath(`M ${width * 0.64} 118 q 18 -14 34 0 q 18 -14 34 0`, rng, 'thin'),
					roughPath(`M ${width * 0.73} 150 q 18 -16 34 0 q 18 -16 34 0`, rng, 'thin'),
				]
			: []),
		...(isMoving
			? [
					roughPath(`M ${dogX - 110} ${dogY - 6} l -62 -18`, rng, 'light'),
					roughPath(`M ${dogX - 138} ${dogY + 18} l -74 -12`, rng, 'light'),
				]
			: []),
	].join('')
}

function drawHandProduct(width: number, height: number, rng: () => number): string {
	const cx = width * 0.6
	const cy = height * 0.42
	return [
		roughRect(cx - 70, cy - 110, 140, 220, rng, 'ink', 14),
		roughRect(cx - 34, cy - 38, 68, 92, rng, 'thin', 4),
		roughPath(`M ${cx - 20} ${cy - 110} q 10 -44 42 -44 q 26 2 34 38`, rng, 'ink'),
		roughPath(`M ${cx - 166} ${cy + 96} q 34 -70 92 -86 q 54 -10 112 40`, rng, 'ink'),
		roughPath(`M ${cx - 178} ${cy + 36} q 30 -24 56 -18 q 26 6 30 28`, rng, 'thin'),
		roughPath(`M ${cx - 150} ${cy + 10} q 30 -20 56 -14 q 28 8 28 28`, rng, 'thin'),
		roughPath(`M ${cx - 122} ${cy - 12} q 28 -18 52 -10 q 24 8 24 28`, rng, 'thin'),
	].join('')
}

function drawMouth(width: number, height: number, rng: () => number): string {
	const cx = width * 0.55
	const cy = height * 0.45
	return [
		roughPath(`M ${cx - 140} ${cy - 90} q 26 -66 94 -88 q 66 -18 130 18`, rng, 'ink'),
		roughPath(`M ${cx - 82} ${cy + 16} q 46 -24 92 0 q 40 18 88 2`, rng, 'ink'),
		roughPath(`M ${cx - 72} ${cy + 20} q 50 34 104 4`, rng, 'thin'),
		roughPath(`M ${cx + 90} ${cy - 4} l 180 -18`, rng, 'ink'),
		roughRect(cx + 198, cy - 32, 86, 56, rng, 'ink', 6),
	].join('')
}

function drawFace(width: number, height: number, rng: () => number): string {
	const cx = width * 0.5
	const cy = height * 0.43
	return [
		roughPath(`M ${cx - 180} ${cy - 30} q 20 -176 180 -190 q 160 14 176 188 q 0 160 -164 196 q -152 -16 -192 -144`, rng, 'ink'),
		roughPath(`M ${cx - 82} ${cy - 46} q 30 -18 64 0`, rng, 'thin'),
		roughPath(`M ${cx + 18} ${cy - 46} q 30 -18 64 0`, rng, 'thin'),
		roughPath(`M ${cx - 90} ${cy - 6} q 34 -20 68 0 q -34 20 -68 0`, rng, 'ink'),
		roughPath(`M ${cx + 10} ${cy - 6} q 34 -20 68 0 q -34 20 -68 0`, rng, 'ink'),
		roughPath(`M ${cx + 6} ${cy + 8} q -22 34 -6 84`, rng, 'thin'),
		roughPath(`M ${cx - 40} ${cy + 104} q 44 20 90 0`, rng, 'ink'),
	].join('')
}

function drawEye(width: number, height: number, rng: () => number): string {
	const cx = width * 0.5
	const cy = height * 0.46
	return [
		roughPath(`M ${cx - 220} ${cy} q 100 -104 220 -104 q 120 0 220 104 q -100 104 -220 104 q -120 0 -220 -104`, rng, 'ink'),
		roughCircle(cx, cy, 78, rng, 'ink'),
		roughCircle(cx, cy, 30, rng, 'ink'),
		roughCircle(cx, cy, 10, rng, 'ink'),
		...Array.from({ length: 8 }, (_, index) => roughPath(`M ${cx - 180 + index * 46} ${cy - 92} q 10 -34 24 -44`, rng, 'thin')),
	].join('')
}

function drawProfile(width: number, height: number, rng: () => number): string {
	const x = width * 0.56
	const y = height * 0.18
	return [
		roughPath(`M ${x - 120} ${y + 30} q 18 -50 66 -68 q 72 -30 128 22 q 44 40 34 102 q -12 52 -54 84 q -36 26 -28 78`, rng, 'ink'),
		roughPath(`M ${x + 2} ${y + 110} q 36 10 44 42 q -20 16 -40 0`, rng, 'thin'),
		roughPath(`M ${x + 12} ${y + 152} q 46 20 94 -4`, rng, 'ink'),
		roughPath(`M ${x - 94} ${y + 220} q 44 60 52 156`, rng, 'ink'),
		roughPath(`M ${x - 18} ${y + 228} q 10 76 0 148`, rng, 'ink'),
		roughPath(`M ${x - 130} ${y + 370} q 100 -54 194 0`, rng, 'ink'),
	].join('')
}

function drawGeneric(width: number, height: number, rng: () => number): string {
	return [
		roughRect(180, 120, width - 360, height - 220, rng, 'ink', 18),
		roughCircle(width / 2, height / 2 - 40, 86, rng, 'ink'),
		roughPath(`M ${width / 2} ${height / 2 + 40} q -60 90 -120 160`, rng, 'ink'),
		roughPath(`M ${width / 2} ${height / 2 + 40} q 60 90 120 160`, rng, 'ink'),
		roughPath(`M ${width / 2 - 140} ${height / 2 + 10} q 140 -80 280 0`, rng, 'thin'),
	].join('')
}

function drawDog(x: number, y: number, rng: () => number, pose: 'standing' | 'moving' | 'sleeping' | 'waking'): string {
	if (pose === 'sleeping') {
		return [
			roughPath(`M ${x - 42} ${y + 10} q 34 -44 88 -36 q 34 10 38 42 q -8 42 -44 54 q -46 8 -82 -24 z`, rng, 'ink'),
			roughPath(`M ${x + 18} ${y - 18} q 22 -20 42 -2 q 10 18 -8 34`, rng, 'ink'),
			roughPath(`M ${x - 58} ${y + 38} q -18 24 -20 44`, rng, 'thin'),
		].join('')
	}

	if (pose === 'moving') {
		return [
			roughPath(`M ${x - 58} ${y} q 36 -42 90 -34 q 44 12 52 46 q -6 40 -48 50 q -56 8 -94 -22 z`, rng, 'ink'),
			roughPath(`M ${x + 18} ${y - 26} q 22 -24 44 -10 q 12 18 0 36`, rng, 'ink'),
			roughPath(`M ${x - 34} ${y + 40} q -18 28 -34 46`, rng, 'thin'),
			roughPath(`M ${x + 2} ${y + 36} q 24 18 18 56`, rng, 'thin'),
			roughPath(`M ${x + 52} ${y + 12} q 34 6 60 20`, rng, 'thin'),
		].join('')
	}

	if (pose === 'waking') {
		return [
			roughPath(`M ${x - 56} ${y + 4} q 30 -54 86 -54 q 44 4 58 42 q -4 44 -40 64 q -54 18 -92 -12 z`, rng, 'ink'),
			roughPath(`M ${x + 20} ${y - 34} q 20 -20 40 -12 q 16 16 8 34`, rng, 'ink'),
			roughPath(`M ${x - 34} ${y + 48} q -26 18 -38 46`, rng, 'thin'),
			roughPath(`M ${x + 10} ${y + 46} q 26 20 34 44`, rng, 'thin'),
		].join('')
	}

	return [
		roughPath(`M ${x - 54} ${y} q 32 -48 86 -44 q 44 8 54 44 q -6 42 -44 56 q -54 12 -96 -18 z`, rng, 'ink'),
		roughPath(`M ${x + 18} ${y - 28} q 22 -22 40 -10 q 12 18 4 34`, rng, 'ink'),
		roughPath(`M ${x - 42} ${y + 44} q -16 20 -24 40`, rng, 'thin'),
		roughPath(`M ${x + 4} ${y + 42} q 14 22 20 42`, rng, 'thin'),
	].join('')
}

function buildNotes(spec: Required<LocalStoryboardSceneInput>, width: number, height: number, rng: () => number): string {
	const noteA = truncateText(spec.camera, 18)
	const noteB = truncateText(spec.lighting, 18)
	return [
		roughPath(`M ${width - 260} 68 l 100 -28`, rng, 'light'),
		roughPath(`M 100 ${height - 100} l 130 -38`, rng, 'light'),
		`<text x="${width - 148}" y="54" class="small">${escapeXml(noteA)}</text>`,
		`<text x="110" y="${height - 110}" class="small">${escapeXml(noteB)}</text>`,
	].join('')
}

function buildHatching(width: number, height: number, rng: () => number): string {
	return Array.from({ length: 18 }, (_, index) => {
		const startX = Math.round(20 + rng() * (width - 140))
		const startY = Math.round(18 + index * ((height - 60) / 18))
		const endX = startX + Math.round(40 + rng() * 100)
		const endY = startY + Math.round(-18 + rng() * 36)
		return `<line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" class="shade" />`
	}).join('')
}

function roughRect(x: number, y: number, w: number, h: number, rng: () => number, className: string, radius = 0): string {
	const d = radius > 0
		? `M ${x + radius} ${y} H ${x + w - radius} Q ${x + w} ${y} ${x + w} ${y + radius} V ${y + h - radius} Q ${x + w} ${y + h} ${x + w - radius} ${y + h} H ${x + radius} Q ${x} ${y + h} ${x} ${y + h - radius} V ${y + radius} Q ${x} ${y} ${x + radius} ${y} Z`
		: `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`
	return roughPath(d, rng, className)
}

function roughCircle(cx: number, cy: number, r: number, rng: () => number, className: string): string {
	const j = () => (rng() - 0.5) * 8
	const d = `M ${cx + r + j()} ${cy + j()} A ${r} ${r} 0 1 1 ${cx - r + j()} ${cy + j()} A ${r} ${r} 0 1 1 ${cx + r + j()} ${cy + j()}`
	return roughPath(d, rng, className)
}

function roughPath(d: string, rng: () => number, className: string): string {
	const dx = (rng() - 0.5) * 4
	const dy = (rng() - 0.5) * 4
	return [
		`<path d="${d}" class="${className}" />`,
		`<path d="${d}" class="${className}" transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)})" opacity="0.55" />`,
	].join('')
}

function readPrefixedValue(lines: string[], key: string): string | null {
	const prefix = `${key.toLowerCase()}:`
	const line = lines.find((entry) => entry.toLowerCase().startsWith(prefix))
	return line ? line.slice(prefix.length).trim() : null
}

function firstSentence(text: string): string {
	const parts = toAscii(text).split('.').map((part) => part.trim()).filter(Boolean)
	return parts[0] ?? ''
}

function sentenceByKeyword(text: string, pattern: RegExp): string {
	const parts = toAscii(text).split('.').map((part) => part.trim()).filter(Boolean)
	return parts.find((part) => pattern.test(part)) ?? ''
}

function truncateText(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function wrapText(text: string, maxLineLength: number, maxLines: number): string[] {
	const clean = toAscii(text)
	if (!clean) return ['—']

	const words = clean.split(' ')
	const lines: string[] = []
	let current = ''

	for (const word of words) {
		const next = current ? `${current} ${word}` : word
		if (next.length > maxLineLength && current) {
			lines.push(current)
			current = word
			if (lines.length === maxLines - 1) break
		} else {
			current = next
		}
	}

	if (current && lines.length < maxLines) lines.push(current)
	if (lines.length === maxLines && clean.length > lines.join(' ').length) {
		lines[maxLines - 1] = truncateText(lines[maxLines - 1], Math.max(8, maxLineLength - 1))
	}
	return lines
}

function toAscii(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^\x20-\x7E]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

function hashString(input: string): number {
	let hash = 2166136261
	for (let i = 0; i < input.length; i += 1) {
		hash ^= input.charCodeAt(i)
		hash = Math.imul(hash, 16777619)
	}
	return Math.abs(hash >>> 0)
}

function mulberry32(seed: number): () => number {
	let t = seed >>> 0
	return () => {
		t += 0x6D2B79F5
		let n = Math.imul(t ^ (t >>> 15), 1 | t)
		n ^= n + Math.imul(n ^ (n >>> 7), 61 | n)
		return ((n ^ (n >>> 14)) >>> 0) / 4294967296
	}
}

function runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args)
		let stdout = ''
		let stderr = ''

		proc.stdout.on('data', (chunk) => {
			stdout += chunk.toString()
		})
		proc.stderr.on('data', (chunk) => {
			stderr += chunk.toString()
		})
		proc.on('error', reject)
		proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? 1 }))
	})
}
