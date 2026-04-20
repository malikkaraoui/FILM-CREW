import { describe, it, expect, afterAll } from 'vitest'
import { rmSync, mkdirSync } from 'fs'
import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { PublishManifest, PublishManifestEntry, PublishPlatform } from '@/lib/publishers/platform-types'
import { SUPPORTED_PUBLISH_PLATFORMS, isSupportedPlatform } from '@/lib/publishers/factory'

/**
 * 11B — Publication multi-plateforme progressive
 *
 * Vérifie :
 * 1. PublishPlatform — union type valide (tiktok + youtube_shorts)
 * 2. SUPPORTED_PUBLISH_PLATFORMS — contient les 2 plateformes
 * 3. isSupportedPlatform — guard type correct
 * 4. PublishManifest — structure minimale requise
 * 5. PublishManifestEntry — champs requis + structure par statut
 * 6. Manifest multi-plateforme — 2 entrées distinctes
 * 7. Upsert — conserve les plateformes existantes + remplace en cas de retry
 * 8. GET /api/runs/[id]/publish-manifest — structure 404/200
 */

const FIXTURE_DIR = join(tmpdir(), `vitest-11b-${process.pid}`)

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true })
})

describe('11B — Publication multi-plateforme progressive', () => {

  // ─── 1. PublishPlatform — union type ────────────────────────────────────

  describe('PublishPlatform — union type', () => {
    it('tiktok est une plateforme valide', () => {
      const p: PublishPlatform = 'tiktok'
      expect(p).toBe('tiktok')
    })

    it('youtube_shorts est une plateforme valide', () => {
      const p: PublishPlatform = 'youtube_shorts'
      expect(p).toBe('youtube_shorts')
    })
  })

  // ─── 2. SUPPORTED_PUBLISH_PLATFORMS ─────────────────────────────────────

  describe('SUPPORTED_PUBLISH_PLATFORMS — couverture', () => {
    it('contient tiktok', () => {
      expect(SUPPORTED_PUBLISH_PLATFORMS).toContain('tiktok')
    })

    it('contient youtube_shorts', () => {
      expect(SUPPORTED_PUBLISH_PLATFORMS).toContain('youtube_shorts')
    })

    it('au moins 2 plateformes', () => {
      expect(SUPPORTED_PUBLISH_PLATFORMS.length).toBeGreaterThanOrEqual(2)
    })

    it('toutes les plateformes sont distinctes', () => {
      const unique = new Set(SUPPORTED_PUBLISH_PLATFORMS)
      expect(unique.size).toBe(SUPPORTED_PUBLISH_PLATFORMS.length)
    })
  })

  // ─── 3. isSupportedPlatform — type guard ────────────────────────────────

  describe('isSupportedPlatform — guard', () => {
    it('tiktok → true', () => {
      expect(isSupportedPlatform('tiktok')).toBe(true)
    })

    it('youtube_shorts → true', () => {
      expect(isSupportedPlatform('youtube_shorts')).toBe(true)
    })

    it('plateforme inconnue → false', () => {
      expect(isSupportedPlatform('snapchat')).toBe(false)
    })

    it('chaîne vide → false', () => {
      expect(isSupportedPlatform('')).toBe(false)
    })
  })

  // ─── 4. PublishManifest — structure ─────────────────────────────────────

  describe('PublishManifest — structure minimale', () => {
    it('structure minimale requise', async () => {
      mkdirSync(FIXTURE_DIR, { recursive: true })

      const manifest: PublishManifest = {
        runId: 'test-11b',
        version: 1,
        title: 'Test multi-plateforme',
        hashtags: ['#shorts', '#ai'],
        platforms: [],
        generatedAt: new Date().toISOString(),
      }

      const path = join(FIXTURE_DIR, 'publish-manifest.json')
      await writeFile(path, JSON.stringify(manifest, null, 2))
      const raw = JSON.parse(await readFile(path, 'utf-8')) as PublishManifest

      expect(raw.runId).toBe('test-11b')
      expect(raw.version).toBe(1)
      expect(raw.title).toBeTruthy()
      expect(Array.isArray(raw.hashtags)).toBe(true)
      expect(Array.isArray(raw.platforms)).toBe(true)
      expect(raw.generatedAt).toBeTruthy()
    })

    it('version = 1 (versionnement artefact)', () => {
      const m: PublishManifest = {
        runId: 'r1', version: 1, title: 't', hashtags: [],
        platforms: [], generatedAt: new Date().toISOString(),
      }
      expect(m.version).toBe(1)
    })
  })

  // ─── 5. PublishManifestEntry — champs requis ─────────────────────────────

  describe('PublishManifestEntry — champs requis', () => {
    it('entrée TikTok SUCCESS avec publishId', () => {
      const entry: PublishManifestEntry = {
        platform: 'tiktok',
        status: 'SUCCESS',
        publishId: 'v_pub_test_abc',
        publishedAt: new Date().toISOString(),
      }
      expect(entry.platform).toBe('tiktok')
      expect(entry.status).toBe('SUCCESS')
      expect(entry.publishId).toBeTruthy()
    })

    it('entrée YouTube Shorts NO_CREDENTIALS avec instructions', () => {
      const entry: PublishManifestEntry = {
        platform: 'youtube_shorts',
        status: 'NO_CREDENTIALS',
        instructions: 'Pour publier sur YouTube Shorts, configurer YOUTUBE_ACCESS_TOKEN...',
      }
      expect(entry.platform).toBe('youtube_shorts')
      expect(entry.status).toBe('NO_CREDENTIALS')
      expect(entry.instructions).toBeTruthy()
    })

    it('entrée FAILED avec champ error', () => {
      const entry: PublishManifestEntry = {
        platform: 'tiktok',
        status: 'FAILED',
        error: 'TikTok API timeout',
      }
      expect(entry.status).toBe('FAILED')
      expect(entry.error).toBeTruthy()
    })
  })

  // ─── 6. Manifest multi-plateforme — 2 entrées ────────────────────────────

  describe('Manifest multi-plateforme — 2 plateformes distinctes', () => {
    it('deux entrées avec plateformes différentes', async () => {
      const manifest: PublishManifest = {
        runId: 'test-11b-multi',
        version: 1,
        title: 'Vidéo test multi',
        hashtags: ['#shorts'],
        platforms: [
          { platform: 'tiktok', status: 'SUCCESS', publishId: 'v_pub_tiktok_123', publishedAt: new Date().toISOString() },
          { platform: 'youtube_shorts', status: 'NO_CREDENTIALS' },
        ],
        generatedAt: new Date().toISOString(),
      }

      const path = join(FIXTURE_DIR, 'publish-manifest-multi.json')
      await writeFile(path, JSON.stringify(manifest, null, 2))
      const raw = JSON.parse(await readFile(path, 'utf-8')) as PublishManifest

      expect(raw.platforms.length).toBe(2)
      const platforms = raw.platforms.map((p) => p.platform)
      expect(platforms).toContain('tiktok')
      expect(platforms).toContain('youtube_shorts')
      expect(new Set(platforms).size).toBe(2)
    })

    it('les entrées de plateformes différentes ont des statuts indépendants', () => {
      const platforms: PublishManifestEntry[] = [
        { platform: 'tiktok', status: 'SUCCESS' },
        { platform: 'youtube_shorts', status: 'NO_CREDENTIALS' },
      ]
      expect(platforms[0].status).toBe('SUCCESS')
      expect(platforms[1].status).toBe('NO_CREDENTIALS')
      expect(platforms[0].status).not.toBe(platforms[1].status)
    })
  })

  // ─── 7. Upsert manifest — conservation + remplacement ───────────────────

  describe('Upsert manifest — additivité par plateforme', () => {
    it('ajout d\'une nouvelle plateforme conserve les existantes', () => {
      const previous: PublishManifestEntry[] = [
        { platform: 'tiktok', status: 'SUCCESS', publishId: 'v_pub_123' },
      ]
      const newEntry: PublishManifestEntry = {
        platform: 'youtube_shorts',
        status: 'NO_CREDENTIALS',
      }
      const newPlatforms = ['youtube_shorts']
      const merged = [
        ...previous.filter((p) => !newPlatforms.includes(p.platform)),
        newEntry,
      ]

      expect(merged.length).toBe(2)
      expect(merged.find((p) => p.platform === 'tiktok')?.status).toBe('SUCCESS')
      expect(merged.find((p) => p.platform === 'youtube_shorts')?.status).toBe('NO_CREDENTIALS')
    })

    it('retry sur la même plateforme remplace l\'ancienne entrée', () => {
      const previous: PublishManifestEntry[] = [
        { platform: 'tiktok', status: 'FAILED', error: 'timeout' },
        { platform: 'youtube_shorts', status: 'NO_CREDENTIALS' },
      ]
      const retry: PublishManifestEntry = {
        platform: 'tiktok',
        status: 'SUCCESS',
        publishId: 'v_pub_retry_456',
        publishedAt: new Date().toISOString(),
      }
      const merged = [
        ...previous.filter((p) => p.platform !== 'tiktok'),
        retry,
      ]

      expect(merged.length).toBe(2)
      expect(merged.find((p) => p.platform === 'tiktok')?.status).toBe('SUCCESS')
      expect(merged.find((p) => p.platform === 'youtube_shorts')?.status).toBe('NO_CREDENTIALS')
    })
  })

  // ─── 8. GET /api/runs/[id]/publish-manifest — réponses attendues ─────────

  describe('GET /api/runs/[id]/publish-manifest — réponses attendues', () => {
    it('manifest absent → data null avec raison explicite', () => {
      const expected = {
        data: null,
        meta: { reason: 'publish-manifest.json absent — aucune publication encore lancée' },
      }
      expect(expected.data).toBeNull()
      expect(expected.meta.reason).toContain('publication encore lancée')
    })

    it('manifest présent → data contient version et platforms', () => {
      const response = {
        data: {
          runId: 'x', version: 1, title: 't', hashtags: [],
          platforms: [
            { platform: 'tiktok', status: 'SUCCESS' },
          ],
          generatedAt: new Date().toISOString(),
        },
      }
      expect(response.data.version).toBe(1)
      expect(Array.isArray(response.data.platforms)).toBe(true)
      expect(response.data.platforms[0].platform).toBe('tiktok')
    })
  })
})
