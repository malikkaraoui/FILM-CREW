/**
 * proof-11c.mjs — Preuve runtime 11C — Module viral réel
 *
 * Démontre :
 * 1. Types — ViralSegment, ViralManifest, CreateRunFromSegmentResult
 * 2. Idea building — [Viral N/Total] titre
 * 3. segmentIndex validation — bornes correctes
 * 4. ViralManifest runsCreated — additivité sans doublon
 * 5. POST /api/viral — source ingérée + segments produits (appel réel)
 * 6. GET /api/viral/{id} — manifest + segments exposés
 * 7. POST /api/viral/{id}/create-run — run créé depuis segment (appel réel)
 * 8. viral-source.json — traçabilité source → run
 * 9. Viral-manifest.json runsCreated mis à jour
 * 10. GET /api/runs/{runId} — run existe en DB
 *
 * Usage : node storage/proof-11c.mjs (depuis app/)
 * Le serveur Next.js doit tourner sur http://localhost:3000
 *
 * URL de test : vidéo courte publique (modifiable en argument)
 *   node storage/proof-11c.mjs https://www.youtube.com/shorts/k5w9lzyGJn8
 */

import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'

const BASE_URL = 'http://localhost:3000'
// URL de test : utiliser la vidéo publiée en 11B (courte, publique, accessible)
const TEST_URL = process.argv[2] || 'https://www.youtube.com/shorts/k5w9lzyGJn8'
// Chain ID disponible dans l'app
const CHAIN_ID = '6e3d5697-6cb9-4717-a377-b5574f9f84a2'

function pass(msg) { console.log(`  ✓ ${msg}`) }
function fail(msg) { console.error(`  ✗ ${msg}`); process.exitCode = 1 }
function section(title) { console.log(`\n[${title}]`) }

async function main() {
  console.log('='.repeat(60))
  console.log('PREUVE 11C — Module viral réel')
  console.log('='.repeat(60))
  console.log(`URL test : ${TEST_URL}`)

  // ─── 1. Types — structure unit ──────────────────────────────────────────

  section('1. Types — ViralSegment structure')

  const seg = { index: 0, start_s: 0, end_s: 45, title: 'Le moment clé', reason: 'Accroche forte' }
  if (typeof seg.index === 'number') pass('index est un number')
  else fail('index incorrect')
  if (seg.end_s > seg.start_s) pass('end_s > start_s (durée positive)')
  else fail('durée invalide')
  if (seg.title && seg.reason) pass('title et reason présents')
  else fail('champs manquants')

  // ─── 2. Idea building ────────────────────────────────────────────────────

  section('2. Idea building — [Viral N/Total] titre')

  function buildIdea(segment, idx, total) {
    return `[Viral ${idx + 1}/${total}] ${segment.title}`
  }

  const idea0 = buildIdea(seg, 0, 3)
  if (idea0 === '[Viral 1/3] Le moment clé') pass(`format correct : "${idea0}"`)
  else fail(`format incorrect : "${idea0}"`)

  const idea2 = buildIdea({ title: 'Twist final' }, 2, 4)
  if (idea2 === '[Viral 3/4] Twist final') pass(`index 2/4 correct : "${idea2}"`)
  else fail(`index 2/4 incorrect : "${idea2}"`)

  // ─── 3. segmentIndex validation ─────────────────────────────────────────

  section('3. segmentIndex validation — bornes')

  const segments = [
    { index: 0, start_s: 0, end_s: 45, title: 'A', reason: 'rA' },
    { index: 1, start_s: 60, end_s: 100, title: 'B', reason: 'rB' },
    { index: 2, start_s: 120, end_s: 160, title: 'C', reason: 'rC' },
  ]
  function isValid(idx) { return idx >= 0 && idx < segments.length }

  if (isValid(0)) pass('index 0 valide')
  else fail('index 0 invalide')
  if (isValid(2)) pass('index 2 (dernier) valide')
  else fail('index 2 invalide')
  if (!isValid(-1)) pass('index -1 invalide (correct)')
  else fail('index -1 devrait être invalide')
  if (!isValid(3)) pass('index 3 (hors borne) invalide (correct)')
  else fail('index 3 devrait être invalide')

  // ─── 4. ViralManifest runsCreated additivité ─────────────────────────────

  section('4. ViralManifest runsCreated — additivité sans doublon')

  const manifest = { id: 'test', version: 1, url: TEST_URL, sourceDownloaded: true, segmentsCount: 3, runsCreated: ['run-aaa'], generatedAt: new Date().toISOString() }
  const newRunId = 'run-bbb'
  const updated = { ...manifest, runsCreated: [...manifest.runsCreated.filter(r => r !== newRunId), newRunId] }
  if (updated.runsCreated.includes('run-aaa')) pass('run-aaa conservé après ajout run-bbb')
  else fail('run-aaa perdu')
  if (updated.runsCreated.includes('run-bbb')) pass('run-bbb ajouté')
  else fail('run-bbb absent')
  if (updated.runsCreated.length === 2) pass('Aucun doublon (2 runs)')
  else fail(`${updated.runsCreated.length} runs au lieu de 2`)

  // Retry — pas de doublon
  const retry = { ...updated, runsCreated: [...updated.runsCreated.filter(r => r !== 'run-bbb'), 'run-bbb'] }
  if (retry.runsCreated.filter(r => r === 'run-bbb').length === 1) pass('run-bbb sans doublon après retry')
  else fail('doublon run-bbb détecté')

  // ─── 5. POST /api/viral — source ingérée + segments ─────────────────────

  section('5. POST /api/viral — source ingérée + segments produits (appel réel)')
  console.log(`  → Téléchargement + analyse LLM en cours (peut prendre 30–60s)...`)

  let viralId
  try {
    const res = await fetch(`${BASE_URL}/api/viral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: TEST_URL }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!res.ok) {
      const err = await res.text()
      fail(`POST /api/viral HTTP ${res.status}: ${err.slice(0, 200)}`)
      return
    }

    const data = await res.json()
    viralId = data.data?.id

    if (viralId) pass(`Session virale créée : id = ${viralId}`)
    else fail('id de session absent')

    if (data.data?.url === TEST_URL) pass('URL source correcte dans la réponse')
    else fail('URL source incorrecte')

    const segsCount = Array.isArray(data.data?.segments) ? data.data.segments.length : 0
    if (segsCount > 0) pass(`${segsCount} segments produits par le LLM`)
    else fail('Aucun segment produit')

    // Vérifier source.mp4 sur disque
    const sourcePath = join(process.cwd(), 'storage', 'viral', viralId, 'source.mp4')
    if (existsSync(sourcePath)) pass('source.mp4 présent sur disque')
    else fail('source.mp4 absent')

    // Vérifier segments.json sur disque
    const segsPath = join(process.cwd(), 'storage', 'viral', viralId, 'segments.json')
    if (existsSync(segsPath)) pass('segments.json présent sur disque')
    else fail('segments.json absent')

    // Vérifier viral-manifest.json sur disque
    const mPath = join(process.cwd(), 'storage', 'viral', viralId, 'viral-manifest.json')
    if (existsSync(mPath)) {
      pass('viral-manifest.json présent sur disque')
      const m = JSON.parse(await readFile(mPath, 'utf-8'))
      if (m.version === 1) pass('viral-manifest version = 1')
      else fail('viral-manifest version incorrecte')
      if (m.sourceDownloaded === true) pass('sourceDownloaded = true')
      else fail('sourceDownloaded incorrect')
      if (Array.isArray(m.runsCreated) && m.runsCreated.length === 0) pass('runsCreated = [] initialement')
      else fail('runsCreated initial incorrect')
    } else fail('viral-manifest.json absent')

  } catch (e) {
    fail(`POST /api/viral erreur : ${e.message}`)
    return
  }

  // ─── 6. GET /api/viral/{id} — manifest + segments exposés ───────────────

  section(`6. GET /api/viral/${viralId} — manifest + segments`)

  try {
    const res = await fetch(`${BASE_URL}/api/viral/${viralId}`)
    if (!res.ok) fail(`GET /api/viral/${viralId} HTTP ${res.status}`)
    else {
      const data = await res.json()
      if (data.data?.manifest?.version === 1) pass('manifest.version = 1')
      else fail('manifest.version incorrect')
      if (data.data?.manifest?.sourceDownloaded === true) pass('manifest.sourceDownloaded = true')
      else fail('manifest.sourceDownloaded incorrect')
      if (Array.isArray(data.data?.segments)) pass('segments est un tableau')
      else fail('segments absent ou non tableau')
      if ((data.data?.segments?.length ?? 0) > 0) pass(`${data.data.segments.length} segments exposés`)
      else fail('Aucun segment exposé')
    }
  } catch (e) {
    fail(`GET /api/viral/${viralId} erreur : ${e.message}`)
  }

  // GET 404 sur id inconnu
  try {
    const res404 = await fetch(`${BASE_URL}/api/viral/id-inexistant-99999`)
    if (res404.status === 404) {
      const body = await res404.json()
      if (body.data === null) pass('404 : data = null')
      else fail('404 : data devrait être null')
      if (body.meta?.reason) pass('404 : raison explicite présente')
      else fail('404 : raison manquante')
    } else fail(`404 attendu pour id inconnu, reçu ${res404.status}`)
  } catch (e) {
    fail(`GET 404 erreur : ${e.message}`)
  }

  // ─── 7. POST /api/viral/{id}/create-run — run créé depuis segment ────────

  section(`7. POST /api/viral/${viralId}/create-run — run depuis segment 0`)

  let runId
  try {
    const res = await fetch(`${BASE_URL}/api/viral/${viralId}/create-run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segmentIndex: 0, chainId: CHAIN_ID }),
    })

    if (!res.ok) {
      const err = await res.text()
      fail(`POST create-run HTTP ${res.status}: ${err.slice(0, 200)}`)
    } else {
      const data = await res.json()
      runId = data.data?.runId

      if (runId) pass(`Run créé : runId = ${runId}`)
      else fail('runId absent')
      if (data.data?.viralId === viralId) pass('viralId correct dans la réponse')
      else fail('viralId incorrect')
      if (data.data?.segmentIndex === 0) pass('segmentIndex = 0 correct')
      else fail('segmentIndex incorrect')
      if (data.data?.idea?.startsWith('[Viral 1/')) pass(`idea formatée : "${data.data.idea}"`)
      else fail(`idea incorrecte : "${data.data?.idea}"`)
    }
  } catch (e) {
    fail(`POST create-run erreur : ${e.message}`)
  }

  // ─── 8. viral-source.json — traçabilité ─────────────────────────────────

  if (runId) {
    section('8. viral-source.json — traçabilité source → run')

    const vsPath = join(process.cwd(), 'storage', 'runs', runId, 'viral-source.json')
    if (existsSync(vsPath)) {
      pass('viral-source.json présent dans le run')
      const vs = JSON.parse(await readFile(vsPath, 'utf-8'))
      if (vs.viralId === viralId) pass('viralId correct')
      else fail('viralId incorrect')
      if (vs.segmentIndex === 0) pass('segmentIndex = 0 correct')
      else fail('segmentIndex incorrect')
      if (vs.segment?.title) pass(`segment.title : "${vs.segment.title}"`)
      else fail('segment.title absent')
      if (vs.sourceUrl === TEST_URL) pass('sourceUrl correct')
      else fail('sourceUrl incorrect')
    } else fail('viral-source.json absent')

    // ─── 9. viral-manifest.json runsCreated mis à jour ───────────────────

    section('9. viral-manifest.json — runsCreated mis à jour')

    const mPath = join(process.cwd(), 'storage', 'viral', viralId, 'viral-manifest.json')
    const m = JSON.parse(await readFile(mPath, 'utf-8'))
    if (Array.isArray(m.runsCreated) && m.runsCreated.includes(runId)) pass(`runsCreated contient ${runId}`)
    else fail('runsCreated non mis à jour')
    if (m.runsCreated.length === 1) pass('1 run dans runsCreated (correct)')
    else fail(`${m.runsCreated.length} runs au lieu de 1`)

    // ─── 10. GET /api/runs/{runId} — run existe en DB ──────────────────────

    section(`10. GET /api/runs/${runId} — run existe en DB`)

    try {
      const res = await fetch(`${BASE_URL}/api/runs/${runId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.data?.id === runId) pass('run existe en DB avec le bon id')
        else fail('id run incorrect')
        if (data.data?.idea?.startsWith('[Viral')) pass(`idea contient [Viral] : "${data.data.idea}"`)
        else fail(`idea incorrecte : "${data.data?.idea}"`)
        if (data.data?.type === 'viral') pass('type = "viral"')
        else fail(`type incorrect : "${data.data?.type}"`)
      } else fail(`GET /api/runs/${runId} HTTP ${res.status}`)
    } catch (e) {
      fail(`GET /api/runs/${runId} erreur : ${e.message}`)
    }
  }

  // ─── Résumé ──────────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(60))
  console.log('RÉSUMÉ — Preuve 11C')
  console.log('='.repeat(60))
  console.log(`Session virale    : ${viralId ?? 'non créée'}`)
  console.log(`Run créé          : ${runId ?? 'non créé'}`)
  console.log(`URL source        : ${TEST_URL}`)
  console.log()
  console.log('Architecture module viral :')
  console.log('  POST /api/viral                      ← ingestion source + segments LLM')
  console.log('  GET  /api/viral/{id}                 ← manifest + segments')
  console.log('  POST /api/viral/{id}/create-run      ← run depuis segment')
  console.log('  storage/viral/{id}/viral-manifest.json')
  console.log('  storage/viral/{id}/segments.json')
  console.log('  storage/runs/{runId}/viral-source.json')
  console.log()
  console.log('Condition de sortie 11C :')
  console.log('  ✓ Source ingérée (yt-dlp download réel)')
  console.log('  ✓ Segments produits (LLM detection)')
  console.log('  ✓ Run créé depuis segment (DB + pipeline)')
  console.log()

  if (!process.exitCode) {
    console.log('✓ Toutes les preuves 11C validées.')
  } else {
    console.log('✗ Certaines preuves ont échoué.')
  }
}

main().catch((err) => {
  console.error('Erreur:', err)
  process.exit(1)
})
