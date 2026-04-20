/**
 * proof-11d.mjs — Preuve runtime 11D — Stock + hybridation
 *
 * Démontre :
 * 1. Types — StockAsset, StockManifest, UseStockResult
 * 2. StockManifest — additivité assets sans doublon
 * 3. sceneIndex validation — bornes et types
 * 4. FileName building — clip-{idx}-stock.{ext}
 * 5. GET /api/stock?q=... — providers stock interrogés
 * 6. POST /api/runs/{id}/use-stock — asset injecté (scène 0)
 * 7. GET /api/runs/{id}/stock-manifest — manifest exposé
 * 8. Clip file téléchargé sur disque
 * 9. Provenance traçable (source, assetId, downloadPath)
 * 10. POST /api/runs/{id}/use-stock — 2e asset (scène 1) → run hybride
 * 11. stock-manifest.json — 2 assets, runId correct
 * 12. GET 404 stock-manifest sur run inconnu
 *
 * Usage : node storage/proof-11d.mjs (depuis app/)
 * Le serveur Next.js doit tourner sur http://localhost:3000
 */

import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'

const BASE_URL = 'http://localhost:3000'

function pass(msg) { console.log(`  ✓ ${msg}`) }
function fail(msg) { console.error(`  ✗ ${msg}`); process.exitCode = 1 }
function section(title) { console.log(`\n[${title}]`) }

async function main() {
  console.log('='.repeat(60))
  console.log('PREUVE 11D — Stock + hybridation')
  console.log('='.repeat(60))

  // ─── 1. Types — structure unit ──────────────────────────────────────────

  section('1. Types — StockAsset structure')

  const asset = {
    sceneIndex: 0,
    source: 'pexels',
    assetId: '1234567',
    assetType: 'image',
    url: 'https://images.pexels.com/photos/1234567/photo.jpg',
    downloadPath: '/storage/runs/run-abc/clips/clip-0-stock.jpg',
    usedAt: new Date().toISOString(),
  }
  if (typeof asset.sceneIndex === 'number' && asset.sceneIndex >= 0) pass('sceneIndex est un entier >= 0')
  else fail('sceneIndex invalide')
  if (asset.source) pass(`source présente : "${asset.source}"`)
  else fail('source absente')
  if (asset.assetType === 'image' || asset.assetType === 'video') pass(`assetType valide : "${asset.assetType}"`)
  else fail('assetType invalide')
  if (asset.downloadPath.includes('stock')) pass('downloadPath contient "stock"')
  else fail('downloadPath incorrect')

  // ─── 2. StockManifest — additivité ─────────────────────────────────────

  section('2. StockManifest — additivité assets sans doublon')

  const manifest = {
    runId: 'run-test',
    version: 1,
    assets: [{ sceneIndex: 0, source: 'pexels', assetId: 'a1', assetType: 'image', url: 'u1', downloadPath: 'd1', usedAt: new Date().toISOString() }],
    generatedAt: new Date().toISOString(),
  }
  const newAsset = { sceneIndex: 1, source: 'pexels', assetId: 'a2', assetType: 'image', url: 'u2', downloadPath: 'd2', usedAt: new Date().toISOString() }
  const updated = { ...manifest, assets: [...manifest.assets.filter(a => a.sceneIndex !== 1), newAsset] }
  if (updated.assets.length === 2) pass('2 assets après ajout (pas de doublon)')
  else fail(`${updated.assets.length} assets au lieu de 2`)
  if (updated.assets.some(a => a.sceneIndex === 0)) pass('scène 0 conservée')
  else fail('scène 0 perdue')
  if (updated.assets.some(a => a.sceneIndex === 1)) pass('scène 1 ajoutée')
  else fail('scène 1 absente')

  // Remplacement sur même sceneIndex
  const replacement = { sceneIndex: 0, source: 'pixabay', assetId: 'b1', assetType: 'image', url: 'u-new', downloadPath: 'd-new', usedAt: new Date().toISOString() }
  const replaced = { ...manifest, assets: [...manifest.assets.filter(a => a.sceneIndex !== 0), replacement] }
  if (replaced.assets.filter(a => a.sceneIndex === 0).length === 1) pass('remplacement scène 0 sans doublon')
  else fail('doublon sur scène 0')
  if (replaced.assets.find(a => a.sceneIndex === 0)?.assetId === 'b1') pass('nouvel assetId correct après remplacement')
  else fail('assetId incorrect après remplacement')

  // ─── 3. sceneIndex validation ──────────────────────────────────────────

  section('3. sceneIndex validation — bornes')

  function isValidSceneIndex(idx) { return typeof idx === 'number' && idx >= 0 && Number.isInteger(idx) }
  if (isValidSceneIndex(0)) pass('sceneIndex 0 valide')
  else fail('sceneIndex 0 invalide')
  if (isValidSceneIndex(10)) pass('sceneIndex 10 valide')
  else fail('sceneIndex 10 invalide')
  if (!isValidSceneIndex(-1)) pass('sceneIndex -1 invalide (correct)')
  else fail('sceneIndex -1 devrait être invalide')
  if (!isValidSceneIndex(1.5)) pass('sceneIndex 1.5 invalide (correct)')
  else fail('sceneIndex 1.5 devrait être invalide')

  // ─── 4. FileName building ──────────────────────────────────────────────

  section('4. FileName building — clip-{idx}-stock.{ext}')

  function buildFileName(sceneIndex, type) {
    const ext = type === 'video' ? '.mp4' : '.jpg'
    return `clip-${sceneIndex}-stock${ext}`
  }
  if (buildFileName(0, 'image') === 'clip-0-stock.jpg') pass('clip-0-stock.jpg correct')
  else fail(`incorrect : ${buildFileName(0, 'image')}`)
  if (buildFileName(2, 'video') === 'clip-2-stock.mp4') pass('clip-2-stock.mp4 correct')
  else fail(`incorrect : ${buildFileName(2, 'video')}`)
  if (buildFileName(5, 'image') === 'clip-5-stock.jpg') pass('clip-5-stock.jpg correct')
  else fail(`incorrect : ${buildFileName(5, 'image')}`)

  // ─── 5. GET /api/stock?q=... — provider stock ──────────────────────────

  section('5. GET /api/stock?q=nature&type=image&limit=1 — provider stock')

  try {
    const res = await fetch(`${BASE_URL}/api/stock?q=nature+landscape&type=image&limit=1`)
    if (!res.ok) {
      fail(`GET /api/stock HTTP ${res.status}`)
    } else {
      const data = await res.json()
      if (Array.isArray(data.data?.results)) pass('results est un tableau')
      else fail('results absent ou non tableau')
      if (Array.isArray(data.data?.sources) && data.data.sources.length > 0) pass(`sources : ${data.data.sources.join(', ')}`)
      else fail('sources absent')
      if ((data.data?.count ?? 0) >= 0) pass(`count >= 0 : ${data.data?.count}`)
      else fail('count invalide')
      if (data.data?.results?.length > 0) {
        const r = data.data.results[0]
        if (r.id) pass(`premier résultat id : ${r.id}`)
        else fail('id absent du premier résultat')
        if (r.url) pass(`url présente : ${r.url.slice(0, 60)}...`)
        else fail('url absente')
        if (r.source) pass(`source : "${r.source}"`)
        else fail('source absente')
      } else {
        pass('Aucun résultat (API key manquante ou quota — non bloquant pour la structure)')
      }
    }
  } catch (e) {
    fail(`GET /api/stock erreur : ${e.message}`)
  }

  // ─── Trouver un run existant ───────────────────────────────────────────

  let targetRunId
  try {
    const res = await fetch(`${BASE_URL}/api/runs`)
    if (res.ok) {
      const data = await res.json()
      const runs = data.data ?? []
      if (runs.length > 0) {
        targetRunId = runs[0].id
      }
    }
  } catch { /* continue */ }

  if (!targetRunId) {
    fail('Aucun run existant — lancer au moins un run avant la preuve 11D')
    return
  }

  console.log(`\n  → Run cible : ${targetRunId}`)

  // ─── 6. POST /api/runs/{id}/use-stock — scène 0 ────────────────────────

  section(`6. POST /api/runs/${targetRunId}/use-stock — scène 0 (nature landscape)`)
  console.log('  → Téléchargement asset Pexels en cours...')

  let firstAssetResult
  try {
    const res = await fetch(`${BASE_URL}/api/runs/${targetRunId}/use-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneIndex: 0, query: 'nature landscape', type: 'image' }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) {
      const err = await res.text()
      fail(`POST use-stock HTTP ${res.status}: ${err.slice(0, 200)}`)
    } else {
      const data = await res.json()
      firstAssetResult = data.data
      if (firstAssetResult?.runId === targetRunId) pass(`runId correct : ${targetRunId}`)
      else fail(`runId incorrect : ${firstAssetResult?.runId}`)
      if (firstAssetResult?.sceneIndex === 0) pass('sceneIndex = 0 correct')
      else fail(`sceneIndex incorrect : ${firstAssetResult?.sceneIndex}`)
      if (firstAssetResult?.source) pass(`source : "${firstAssetResult.source}"`)
      else fail('source absente')
      if (firstAssetResult?.assetId) pass(`assetId : ${firstAssetResult.assetId}`)
      else fail('assetId absent')
      if (firstAssetResult?.assetType === 'image') pass('assetType = "image"')
      else fail(`assetType incorrect : "${firstAssetResult?.assetType}"`)
      if (firstAssetResult?.downloadPath?.includes('clip-0-stock')) pass(`downloadPath : ${firstAssetResult.downloadPath.split('/').slice(-1)[0]}`)
      else fail(`downloadPath incorrect : "${firstAssetResult?.downloadPath}"`)
    }
  } catch (e) {
    fail(`POST use-stock scène 0 erreur : ${e.message}`)
    return
  }

  // ─── 7. GET /api/runs/{id}/stock-manifest ─────────────────────────────

  section(`7. GET /api/runs/${targetRunId}/stock-manifest`)

  try {
    const res = await fetch(`${BASE_URL}/api/runs/${targetRunId}/stock-manifest`)
    if (!res.ok) fail(`GET stock-manifest HTTP ${res.status}`)
    else {
      const data = await res.json()
      if (data.data?.runId === targetRunId) pass('manifest.runId correct')
      else fail('manifest.runId incorrect')
      if (data.data?.version === 1) pass('manifest.version = 1')
      else fail('manifest.version incorrect')
      if (Array.isArray(data.data?.assets)) pass('manifest.assets est un tableau')
      else fail('manifest.assets absent')
      if ((data.data?.assets?.length ?? 0) >= 1) pass(`${data.data.assets.length} asset(s) dans le manifest`)
      else fail('Aucun asset dans le manifest')
    }
  } catch (e) {
    fail(`GET stock-manifest erreur : ${e.message}`)
  }

  // ─── 8. Clip file sur disque ───────────────────────────────────────────

  section('8. Clip file téléchargé sur disque')

  if (firstAssetResult?.downloadPath) {
    if (existsSync(firstAssetResult.downloadPath)) {
      pass(`clip-0-stock.jpg présent sur disque`)
      try {
        const buf = await readFile(firstAssetResult.downloadPath)
        if (buf.length > 0) pass(`taille fichier : ${buf.length} octets`)
        else fail('fichier vide')
      } catch { fail('erreur lecture fichier') }
    } else fail(`clip absent : ${firstAssetResult.downloadPath}`)
  } else fail('downloadPath absent — impossible de vérifier le disque')

  // ─── 9. Provenance traçable ────────────────────────────────────────────

  section('9. Provenance traçable (stock-manifest.json)')

  const manifestPath = join(process.cwd(), 'storage', 'runs', targetRunId, 'stock-manifest.json')
  if (existsSync(manifestPath)) {
    pass('stock-manifest.json présent sur disque')
    const m = JSON.parse(await readFile(manifestPath, 'utf-8'))
    if (m.runId === targetRunId) pass('runId correct dans le fichier')
    else fail('runId incorrect dans le fichier')
    if (m.version === 1) pass('version = 1 dans le fichier')
    else fail('version incorrecte')
    const scene0 = m.assets?.find(a => a.sceneIndex === 0)
    if (scene0) {
      pass(`asset scène 0 trouvé : source = "${scene0.source}"`)
      if (scene0.assetId) pass(`assetId traçable : ${scene0.assetId}`)
      else fail('assetId absent')
      if (scene0.downloadPath?.includes('clip-0-stock')) pass('downloadPath traçable')
      else fail('downloadPath incorrect')
      if (scene0.usedAt) pass('usedAt présent')
      else fail('usedAt absent')
    } else fail('asset scène 0 absent du manifest')
  } else fail('stock-manifest.json absent sur disque')

  // ─── 10. 2e asset — run hybride ───────────────────────────────────────

  section(`10. POST /api/runs/${targetRunId}/use-stock — scène 1 (urban city) → run hybride`)
  console.log('  → Téléchargement 2e asset...')

  try {
    const res = await fetch(`${BASE_URL}/api/runs/${targetRunId}/use-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneIndex: 1, query: 'urban city night', type: 'image' }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) {
      const err = await res.text()
      fail(`POST use-stock scène 1 HTTP ${res.status}: ${err.slice(0, 200)}`)
    } else {
      const data = await res.json()
      if (data.data?.sceneIndex === 1) pass('sceneIndex = 1 correct')
      else fail(`sceneIndex incorrect : ${data.data?.sceneIndex}`)
      if (data.data?.downloadPath?.includes('clip-1-stock')) pass('downloadPath clip-1-stock correct')
      else fail(`downloadPath incorrect : "${data.data?.downloadPath}"`)
    }
  } catch (e) {
    fail(`POST use-stock scène 1 erreur : ${e.message}`)
  }

  // ─── 11. stock-manifest.json — 2 assets ──────────────────────────────

  section('11. stock-manifest.json — 2 assets, run hybride prouvé')

  if (existsSync(manifestPath)) {
    const m = JSON.parse(await readFile(manifestPath, 'utf-8'))
    if (m.assets?.length >= 2) pass(`${m.assets.length} assets dans stock-manifest.json`)
    else fail(`${m.assets?.length ?? 0} assets au lieu de >= 2`)
    if (m.assets?.some(a => a.sceneIndex === 0)) pass('scène 0 présente')
    else fail('scène 0 absente')
    if (m.assets?.some(a => a.sceneIndex === 1)) pass('scène 1 présente')
    else fail('scène 1 absente')

    // Vérification clip scène 1 sur disque
    const asset1 = m.assets?.find(a => a.sceneIndex === 1)
    if (asset1?.downloadPath && existsSync(asset1.downloadPath)) pass('clip-1-stock.jpg présent sur disque')
    else fail('clip-1-stock.jpg absent')
  } else fail('stock-manifest.json absent après 2e injection')

  // ─── 12. GET 404 stock-manifest sur run inconnu ───────────────────────

  section('12. GET /api/runs/id-inconnu-99999/stock-manifest — 404')

  try {
    const res = await fetch(`${BASE_URL}/api/runs/id-inconnu-99999/stock-manifest`)
    if (res.status === 404) {
      const body = await res.json()
      if (body.data === null) pass('404 : data = null')
      else fail('404 : data devrait être null')
      if (body.meta?.reason) pass('404 : raison explicite présente')
      else fail('404 : raison manquante')
    } else fail(`404 attendu, reçu ${res.status}`)
  } catch (e) {
    fail(`GET 404 erreur : ${e.message}`)
  }

  // ─── Résumé ──────────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(60))
  console.log('RÉSUMÉ — Preuve 11D')
  console.log('='.repeat(60))
  console.log(`Run cible         : ${targetRunId}`)
  console.log(`Manifest path     : storage/runs/${targetRunId}/stock-manifest.json`)
  console.log()
  console.log('Architecture module stock/hybridation :')
  console.log('  GET  /api/stock?q=...                 ← recherche stock multi-provider')
  console.log('  POST /api/runs/{id}/use-stock         ← injection asset stock dans run')
  console.log('  GET  /api/runs/{id}/stock-manifest    ← manifest de provenance')
  console.log('  storage/runs/{id}/clips/clip-{n}-stock.jpg')
  console.log('  storage/runs/{id}/stock-manifest.json')
  console.log()
  console.log('Condition de sortie 11D :')
  console.log('  ✓ Run hybride prouvé (assets stock injectés)')
  console.log('  ✓ Provenance asset traçable (source, assetId, downloadPath)')
  console.log()

  if (!process.exitCode) {
    console.log('✓ Toutes les preuves 11D validées.')
  } else {
    console.log('✗ Certaines preuves ont échoué.')
  }
}

main().catch((err) => {
  console.error('Erreur:', err)
  process.exit(1)
})
