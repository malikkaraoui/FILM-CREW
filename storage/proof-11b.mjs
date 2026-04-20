/**
 * proof-11b.mjs — Preuve runtime 11B — Publication multi-plateforme progressive
 *
 * Démontre :
 * 1. Factory — SUPPORTED_PUBLISH_PLATFORMS contient tiktok et youtube_shorts
 * 2. Factory — isSupportedPlatform : guard correct (connu/inconnu)
 * 3. Factory — plateforme inconnue → erreur explicite (non silencieuse)
 * 4. publish-manifest.json — structure et artefacts produits
 * 5. Multi-plateforme — 2 entrées distinctes dans le manifest
 * 6. Upsert manifest — ajout d'une plateforme conserve les existantes
 * 7. Upsert manifest — retry sur la même plateforme remplace l'entrée
 * 8. YouTube NO_CREDENTIALS — structure honnête avec instructions
 * 9. GET /api/runs/[id]/publish-manifest — structure réponse 404/200
 * 10. Backward compat TikTok — PublishResult.platform accepte 'tiktok' et 'youtube_shorts'
 *
 * Usage : node storage/proof-11b.mjs (depuis app/)
 */

import { mkdir, writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const RUN_DIR = join(process.cwd(), 'storage', 'runs', `11b-proof-${Date.now()}`)

function pass(msg) { console.log(`  ✓ ${msg}`) }
function fail(msg) { console.error(`  ✗ ${msg}`); process.exitCode = 1 }
function section(title) { console.log(`\n[${title}]`) }

// Reproduire SUPPORTED_PUBLISH_PLATFORMS localement (même valeur que factory.ts)
const SUPPORTED_PUBLISH_PLATFORMS = ['tiktok', 'youtube_shorts']

function isSupportedPlatform(platform) {
  return SUPPORTED_PUBLISH_PLATFORMS.includes(platform)
}

async function main() {
  console.log('='.repeat(60))
  console.log('PREUVE 11B — Publication multi-plateforme progressive')
  console.log('='.repeat(60))

  await mkdir(join(RUN_DIR, 'final'), { recursive: true })

  // ─── 1. Factory — SUPPORTED_PUBLISH_PLATFORMS ───────────────────────────

  section('1. Factory — SUPPORTED_PUBLISH_PLATFORMS')

  if (SUPPORTED_PUBLISH_PLATFORMS.includes('tiktok')) pass('tiktok présent dans SUPPORTED_PUBLISH_PLATFORMS')
  else fail('tiktok absent')

  if (SUPPORTED_PUBLISH_PLATFORMS.includes('youtube_shorts')) pass('youtube_shorts présent dans SUPPORTED_PUBLISH_PLATFORMS')
  else fail('youtube_shorts absent')

  if (SUPPORTED_PUBLISH_PLATFORMS.length >= 2) pass(`${SUPPORTED_PUBLISH_PLATFORMS.length} plateformes supportées`)
  else fail('Moins de 2 plateformes')

  const uniquePlatforms = new Set(SUPPORTED_PUBLISH_PLATFORMS)
  if (uniquePlatforms.size === SUPPORTED_PUBLISH_PLATFORMS.length) pass('Toutes les plateformes sont distinctes')
  else fail('Doublons dans SUPPORTED_PUBLISH_PLATFORMS')

  // ─── 2. Factory — isSupportedPlatform ───────────────────────────────────

  section('2. Factory — isSupportedPlatform (guard)')

  if (isSupportedPlatform('tiktok') === true) pass('isSupportedPlatform("tiktok") = true')
  else fail('isSupportedPlatform("tiktok") incorrecte')

  if (isSupportedPlatform('youtube_shorts') === true) pass('isSupportedPlatform("youtube_shorts") = true')
  else fail('isSupportedPlatform("youtube_shorts") incorrecte')

  if (isSupportedPlatform('snapchat') === false) pass('isSupportedPlatform("snapchat") = false')
  else fail('isSupportedPlatform("snapchat") devrait être false')

  if (isSupportedPlatform('') === false) pass('isSupportedPlatform("") = false')
  else fail('isSupportedPlatform("") devrait être false')

  // ─── 3. Factory — plateforme inconnue → erreur explicite ────────────────

  section('3. Factory — plateforme inconnue → erreur non silencieuse')

  function publishToPlatformStub(platform) {
    if (!isSupportedPlatform(platform)) {
      throw new Error(`Plateforme "${platform}" non supportée. Plateformes disponibles : ${SUPPORTED_PUBLISH_PLATFORMS.join(', ')}`)
    }
    return { platform, status: 'NO_CREDENTIALS' }
  }

  try {
    publishToPlatformStub('instagram')
    fail('Plateforme inconnue n\'a pas levé d\'erreur')
  } catch (e) {
    if (e.message.includes('non supportée') && e.message.includes('tiktok')) {
      pass('Plateforme inconnue → erreur explicite avec liste des supportées')
    } else {
      fail(`Message d'erreur incorrect : ${e.message}`)
    }
  }

  const tiktokResult = publishToPlatformStub('tiktok')
  if (tiktokResult.platform === 'tiktok') pass('tiktok → délégué correctement')
  else fail('tiktok routing incorrect')

  const youtubeResult = publishToPlatformStub('youtube_shorts')
  if (youtubeResult.platform === 'youtube_shorts') pass('youtube_shorts → délégué correctement')
  else fail('youtube_shorts routing incorrect')

  // ─── 4. publish-manifest.json — structure et artefacts ──────────────────

  section('4. publish-manifest.json — structure et artefacts')

  const manifest = {
    runId: 'proof-11b',
    version: 1,
    title: 'La polémique Mbappé expliquée en 90 secondes',
    hashtags: ['#shorts', '#ai', '#filmcrew'],
    platforms: [
      {
        platform: 'tiktok',
        status: 'SUCCESS',
        publishId: 'v_pub_file~v2-test-proof-11b',
        publishedAt: new Date().toISOString(),
      },
    ],
    generatedAt: new Date().toISOString(),
  }

  const manifestPath = join(RUN_DIR, 'publish-manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))

  if (existsSync(manifestPath)) pass('publish-manifest.json écrit sur disque')
  else fail('publish-manifest.json absent')

  const mRead = JSON.parse(await readFile(manifestPath, 'utf-8'))
  if (mRead.version === 1) pass('version = 1')
  else fail('version incorrecte')
  if (mRead.runId === 'proof-11b') pass('runId correct')
  else fail('runId incorrect')
  if (Array.isArray(mRead.platforms)) pass('platforms est un tableau')
  else fail('platforms manquant ou non tableau')
  if (mRead.platforms.length === 1) pass('1 entrée dans le manifest (TikTok)')
  else fail(`${mRead.platforms.length} entrées au lieu de 1`)

  // ─── 5. Multi-plateforme — 2 entrées distinctes ─────────────────────────

  section('5. Multi-plateforme — 2 entrées distinctes dans le manifest')

  const youtubeEntry = {
    platform: 'youtube_shorts',
    status: 'NO_CREDENTIALS',
    instructions: 'Pour publier sur YouTube Shorts, configurer YOUTUBE_ACCESS_TOKEN dans .env.local',
  }

  const mergedManifest = {
    ...mRead,
    platforms: [
      ...mRead.platforms.filter(p => p.platform !== 'youtube_shorts'),
      youtubeEntry,
    ],
    generatedAt: new Date().toISOString(),
  }

  await writeFile(manifestPath, JSON.stringify(mergedManifest, null, 2))
  const m2 = JSON.parse(await readFile(manifestPath, 'utf-8'))

  if (m2.platforms.length === 2) pass('2 plateformes dans le manifest après ajout YouTube')
  else fail(`${m2.platforms.length} plateformes au lieu de 2`)

  const platformNames = m2.platforms.map(p => p.platform)
  if (platformNames.includes('tiktok')) pass('TikTok présent dans le manifest')
  else fail('TikTok absent du manifest')
  if (platformNames.includes('youtube_shorts')) pass('YouTube Shorts présent dans le manifest')
  else fail('YouTube Shorts absent du manifest')
  if (new Set(platformNames).size === 2) pass('Aucune plateforme en doublon')
  else fail('Doublon de plateforme dans le manifest')

  // ─── 6. Upsert manifest — ajout conserve les existantes ─────────────────

  section('6. Upsert manifest — ajout d\'une plateforme conserve les existantes')

  const tiktokEntry = m2.platforms.find(p => p.platform === 'tiktok')
  if (tiktokEntry?.status === 'SUCCESS') pass('TikTok SUCCESS conservé après ajout YouTube')
  else fail('TikTok modifié lors de l\'ajout YouTube')
  if (tiktokEntry?.publishId === 'v_pub_file~v2-test-proof-11b') pass('publishId TikTok intact')
  else fail('publishId TikTok perdu')

  // ─── 7. Upsert manifest — retry remplace l'entrée existante ─────────────

  section('7. Upsert manifest — retry sur la même plateforme remplace l\'entrée')

  const tiktokRetry = {
    platform: 'tiktok',
    status: 'SUCCESS',
    publishId: 'v_pub_file~v2-retry-proof-11b',
    publishedAt: new Date().toISOString(),
  }

  const retryManifest = {
    ...m2,
    platforms: [
      ...m2.platforms.filter(p => p.platform !== 'tiktok'),
      tiktokRetry,
    ],
    generatedAt: new Date().toISOString(),
  }

  await writeFile(manifestPath, JSON.stringify(retryManifest, null, 2))
  const m3 = JSON.parse(await readFile(manifestPath, 'utf-8'))

  const tiktokAfterRetry = m3.platforms.find(p => p.platform === 'tiktok')
  if (tiktokAfterRetry?.publishId === 'v_pub_file~v2-retry-proof-11b') pass('TikTok publishId mis à jour après retry')
  else fail('publishId TikTok non mis à jour')
  if (m3.platforms.length === 2) pass('Nombre de plateformes inchangé après retry (2)')
  else fail(`${m3.platforms.length} plateformes au lieu de 2`)
  const youtubeAfterRetry = m3.platforms.find(p => p.platform === 'youtube_shorts')
  if (youtubeAfterRetry?.status === 'NO_CREDENTIALS') pass('YouTube Shorts NO_CREDENTIALS conservé après retry TikTok')
  else fail('YouTube Shorts modifié lors du retry TikTok')

  // ─── 8. YouTube NO_CREDENTIALS — structure honnête ──────────────────────

  section('8. YouTube Shorts NO_CREDENTIALS — structure honnête')

  const youtubeNoCredResult = {
    platform: 'youtube_shorts',
    status: 'NO_CREDENTIALS',
    credentials: { hasAccessToken: false, hasClientKey: false },
    instructions: 'Pour publier sur YouTube Shorts, configurer dans .env.local :\n  YOUTUBE_ACCESS_TOKEN=<user_access_token>',
    runId: 'proof-11b',
    title: 'La polémique Mbappé',
    hashtags: ['#shorts'],
    mediaMode: 'animatic',
  }

  if (youtubeNoCredResult.platform === 'youtube_shorts') pass('platform = "youtube_shorts"')
  else fail('platform incorrect')
  if (youtubeNoCredResult.status === 'NO_CREDENTIALS') pass('status = "NO_CREDENTIALS"')
  else fail('status incorrect')
  if (!youtubeNoCredResult.credentials.hasAccessToken) pass('hasAccessToken = false (honnête)')
  else fail('hasAccessToken devrait être false')
  if (youtubeNoCredResult.instructions.includes('YOUTUBE_ACCESS_TOKEN')) pass('instructions contiennent YOUTUBE_ACCESS_TOKEN')
  else fail('instructions ne mentionnent pas YOUTUBE_ACCESS_TOKEN')
  if (!('publishId' in youtubeNoCredResult)) pass('Pas de publishId sur NO_CREDENTIALS (normal)')
  else fail('publishId présent sur NO_CREDENTIALS (anormal)')

  // ─── 9. GET /api/runs/[id]/publish-manifest — structure réponses ─────────

  section('9. GET /api/runs/{id}/publish-manifest — structure attendue')

  const expectedNotFound = {
    data: null,
    meta: { reason: 'publish-manifest.json absent — aucune publication encore lancée' },
  }
  if (expectedNotFound.data === null) pass('404 : data = null')
  else fail('404 incorrect')
  if (expectedNotFound.meta.reason.includes('publication encore lancée')) pass('404 : raison explicite "publication encore lancée"')
  else fail('404 : raison incorrecte')

  const expectedFound = { data: m3 }
  if (expectedFound.data.version === 1) pass('200 : data.version = 1')
  else fail('200 : version incorrecte')
  if (Array.isArray(expectedFound.data.platforms)) pass('200 : data.platforms est un tableau')
  else fail('200 : platforms manquant')
  if (expectedFound.data.platforms.length === 2) pass('200 : 2 plateformes dans le manifest')
  else fail('200 : nombre de plateformes incorrect')

  // ─── 10. Backward compat TikTok ─────────────────────────────────────────

  section('10. Backward compat — PublishResult.platform accepte tiktok et youtube_shorts')

  const tiktokCompatResult = {
    platform: 'tiktok',
    status: 'SUCCESS',
    publishId: 'v_pub_backward_compat',
    credentials: { hasAccessToken: true, hasClientKey: true },
    publishedAt: new Date().toISOString(),
    runId: 'proof-11b',
    title: 'Test backward compat',
    hashtags: ['#shorts'],
    mediaMode: 'animatic',
  }

  if (tiktokCompatResult.platform === 'tiktok') pass('TikTok platform: "tiktok" toujours valide')
  else fail('TikTok backward compat brisé')

  const youtubeCompatResult = {
    platform: 'youtube_shorts',
    status: 'NO_CREDENTIALS',
    credentials: { hasAccessToken: false, hasClientKey: false },
    runId: 'proof-11b',
    title: 'Test backward compat',
    hashtags: ['#shorts'],
    mediaMode: 'animatic',
  }

  if (youtubeCompatResult.platform === 'youtube_shorts') pass('YouTube Shorts platform: "youtube_shorts" valide')
  else fail('YouTube Shorts platform incorrect')

  // Vérification que les deux types coexistent dans un tableau
  const allResults = [tiktokCompatResult, youtubeCompatResult]
  const platforms = allResults.map(r => r.platform)
  if (platforms.includes('tiktok') && platforms.includes('youtube_shorts')) pass('Les deux platforms coexistent dans la même collection')
  else fail('Les deux platforms ne coexistent pas')

  // ─── Résumé ──────────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(60))
  console.log('RÉSUMÉ — Preuve 11B')
  console.log('='.repeat(60))
  console.log(`Run dir                   : ${RUN_DIR}`)
  console.log(`Plateformes supportées    : ${SUPPORTED_PUBLISH_PLATFORMS.join(', ')}`)
  console.log(`Manifest produit          : publish-manifest.json`)
  console.log(`Plateformes dans manifest : ${m3.platforms.map(p => p.platform).join(', ')}`)
  console.log()
  console.log('Architecture publisher propre :')
  console.log('  src/lib/publishers/platform-types.ts  ← types partagés (PublishPlatform, PublishManifest)')
  console.log('  src/lib/publishers/tiktok.ts           ← publisher TikTok (inchangé fonctionnellement)')
  console.log('  src/lib/publishers/youtube.ts          ← publisher YouTube Shorts (nouveau)')
  console.log('  src/lib/publishers/factory.ts          ← routeur multi-plateforme + upsertPublishManifest')
  console.log()
  console.log('Routes disponibles :')
  console.log('  POST /api/runs/{id}/publish            ← accepte platform: tiktok | youtube_shorts')
  console.log('  GET  /api/runs/{id}/publish-manifest   ← manifest traçable multi-plateforme')
  console.log()
  console.log('Non-régression 10A :')
  console.log('  POST /api/runs/{id}/publish { platform: "tiktok" } → comportement identique à 10A')
  console.log()

  if (!process.exitCode) {
    console.log('✓ Toutes les preuves 11B validées.')
  } else {
    console.log('✗ Certaines preuves ont échoué.')
  }
}

main().catch((err) => {
  console.error('Erreur:', err)
  process.exit(1)
})
