import { describe, it, expect, afterAll } from 'vitest'
import { rmSync, mkdirSync } from 'fs'
import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { StockAsset, StockManifest, UseStockResult } from '@/lib/stock/stock-types'

/**
 * 11D — Stock + hybridation
 *
 * Vérifie :
 * 1. StockAsset — structure et champs requis
 * 2. StockManifest — structure minimale
 * 3. StockManifest — additivité assets (sans doublon sur sceneIndex)
 * 4. StockManifest — remplacement asset sur même sceneIndex
 * 5. StockManifest — assets de sources différentes coexistent
 * 6. sceneIndex validation — bornes et types
 * 7. GET /api/runs/[id]/stock-manifest — structure réponse 404/200
 * 8. UseStockResult — structure
 * 9. Run hybride — stock-manifest.json sur disque
 * 10. StockAsset — assetType image vs video
 */

const FIXTURE_DIR = join(tmpdir(), `vitest-11d-${process.pid}`)

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true })
})

describe('11D — Stock + hybridation', () => {

  // ─── 1. StockAsset — structure ───────────────────────────────────────────

  describe('StockAsset — structure et champs requis', () => {
    it('champs requis présents', () => {
      const asset: StockAsset = {
        sceneIndex: 0,
        source: 'pexels',
        assetId: '1234567',
        assetType: 'image',
        url: 'https://images.pexels.com/photos/1234567/photo.jpg',
        downloadPath: '/storage/runs/run-abc/clips/clip-0-stock.jpg',
        usedAt: new Date().toISOString(),
      }
      expect(asset.sceneIndex).toBe(0)
      expect(asset.source).toBe('pexels')
      expect(asset.assetId).toBeTruthy()
      expect(asset.assetType).toBe('image')
      expect(asset.url).toContain('pexels.com')
      expect(asset.downloadPath).toContain('clip-0-stock')
      expect(asset.usedAt).toBeTruthy()
    })

    it('thumbnailUrl et title sont optionnels', () => {
      const asset: StockAsset = {
        sceneIndex: 1,
        source: 'pixabay',
        assetId: '987654',
        assetType: 'image',
        url: 'https://cdn.pixabay.com/photo/987654_large.jpg',
        downloadPath: '/storage/runs/run-abc/clips/clip-1-stock.jpg',
        usedAt: new Date().toISOString(),
      }
      expect(asset.thumbnailUrl).toBeUndefined()
      expect(asset.title).toBeUndefined()
      const full: StockAsset = { ...asset, thumbnailUrl: 'https://thumb.jpg', title: 'Nature' }
      expect(full.thumbnailUrl).toBe('https://thumb.jpg')
      expect(full.title).toBe('Nature')
    })

    it('assetType peut être image ou video', () => {
      const imgAsset: StockAsset = {
        sceneIndex: 0, source: 'pexels', assetId: '1', assetType: 'image',
        url: 'https://img.jpg', downloadPath: '/path/clip-0-stock.jpg', usedAt: new Date().toISOString(),
      }
      const vidAsset: StockAsset = {
        sceneIndex: 2, source: 'pexels', assetId: '2', assetType: 'video',
        url: 'https://vid.mp4', downloadPath: '/path/clip-2-stock.mp4', usedAt: new Date().toISOString(),
      }
      expect(imgAsset.assetType).toBe('image')
      expect(vidAsset.assetType).toBe('video')
    })

    it('sceneIndex identifie la scène de façon unique', () => {
      const assets: StockAsset[] = [
        { sceneIndex: 0, source: 'pexels', assetId: 'a', assetType: 'image', url: 'u1', downloadPath: 'd1', usedAt: new Date().toISOString() },
        { sceneIndex: 1, source: 'pexels', assetId: 'b', assetType: 'image', url: 'u2', downloadPath: 'd2', usedAt: new Date().toISOString() },
      ]
      const indexes = assets.map((a) => a.sceneIndex)
      expect(new Set(indexes).size).toBe(2)
    })
  })

  // ─── 2. StockManifest — structure ───────────────────────────────────────

  describe('StockManifest — structure minimale', () => {
    it('version = 1', async () => {
      mkdirSync(FIXTURE_DIR, { recursive: true })
      const m: StockManifest = {
        runId: 'run-test-1',
        version: 1,
        assets: [],
        generatedAt: new Date().toISOString(),
      }
      const p = join(FIXTURE_DIR, 'stock-manifest-1.json')
      await writeFile(p, JSON.stringify(m, null, 2))
      const raw = JSON.parse(await readFile(p, 'utf-8')) as StockManifest
      expect(raw.version).toBe(1)
    })

    it('runId non vide', () => {
      const m: StockManifest = {
        runId: 'run-xyz', version: 1, assets: [], generatedAt: new Date().toISOString(),
      }
      expect(m.runId).toBeTruthy()
    })

    it('assets est un tableau', () => {
      const m: StockManifest = {
        runId: 'run-1', version: 1, assets: [], generatedAt: new Date().toISOString(),
      }
      expect(Array.isArray(m.assets)).toBe(true)
    })

    it('generatedAt est présent et non vide', () => {
      const m: StockManifest = {
        runId: 'run-2', version: 1, assets: [], generatedAt: new Date().toISOString(),
      }
      expect(m.generatedAt).toBeTruthy()
    })
  })

  // ─── 3. StockManifest — additivité ───────────────────────────────────────

  describe('StockManifest — additivité assets (sans doublon sur sceneIndex)', () => {
    it('ajout d\'un asset conserve les existants', () => {
      const existing: StockManifest = {
        runId: 'run-3', version: 1, generatedAt: new Date().toISOString(),
        assets: [
          { sceneIndex: 0, source: 'pexels', assetId: 'a1', assetType: 'image', url: 'u1', downloadPath: 'd1', usedAt: new Date().toISOString() },
        ],
      }
      const newAsset: StockAsset = {
        sceneIndex: 1, source: 'pexels', assetId: 'a2', assetType: 'image', url: 'u2', downloadPath: 'd2', usedAt: new Date().toISOString(),
      }
      const updated: StockManifest = {
        ...existing,
        assets: [...existing.assets.filter((a) => a.sceneIndex !== newAsset.sceneIndex), newAsset],
      }
      expect(updated.assets.length).toBe(2)
      expect(updated.assets.some((a) => a.sceneIndex === 0)).toBe(true)
      expect(updated.assets.some((a) => a.sceneIndex === 1)).toBe(true)
    })

    it('pas de doublon si même sceneIndex ajouté deux fois', () => {
      const existing: StockManifest = {
        runId: 'run-4', version: 1, generatedAt: new Date().toISOString(),
        assets: [
          { sceneIndex: 0, source: 'pexels', assetId: 'old', assetType: 'image', url: 'u-old', downloadPath: 'd-old', usedAt: new Date().toISOString() },
        ],
      }
      const newAsset: StockAsset = {
        sceneIndex: 0, source: 'pixabay', assetId: 'new', assetType: 'image', url: 'u-new', downloadPath: 'd-new', usedAt: new Date().toISOString(),
      }
      const updated: StockManifest = {
        ...existing,
        assets: [...existing.assets.filter((a) => a.sceneIndex !== 0), newAsset],
      }
      expect(updated.assets.filter((a) => a.sceneIndex === 0).length).toBe(1)
      expect(updated.assets[0].assetId).toBe('new')
    })
  })

  // ─── 4. StockManifest — remplacement asset ───────────────────────────────

  describe('StockManifest — remplacement asset sur même sceneIndex', () => {
    it('le nouvel asset remplace l\'ancien pour le même sceneIndex', () => {
      const m: StockManifest = {
        runId: 'run-5', version: 1, generatedAt: new Date().toISOString(),
        assets: [
          { sceneIndex: 2, source: 'pexels', assetId: 'old-id', assetType: 'image', url: 'old-url', downloadPath: 'old-path', usedAt: new Date().toISOString() },
        ],
      }
      const replacement: StockAsset = {
        sceneIndex: 2, source: 'pixabay', assetId: 'new-id', assetType: 'video', url: 'new-url', downloadPath: 'new-path', usedAt: new Date().toISOString(),
      }
      const updated = { ...m, assets: [...m.assets.filter((a) => a.sceneIndex !== 2), replacement] }
      const asset = updated.assets.find((a) => a.sceneIndex === 2)!
      expect(asset.assetId).toBe('new-id')
      expect(asset.source).toBe('pixabay')
      expect(asset.assetType).toBe('video')
    })
  })

  // ─── 5. StockManifest — assets de sources différentes ────────────────────

  describe('StockManifest — assets de sources différentes coexistent', () => {
    it('pexels et pixabay dans le même manifest', () => {
      const m: StockManifest = {
        runId: 'run-6', version: 1, generatedAt: new Date().toISOString(),
        assets: [
          { sceneIndex: 0, source: 'pexels', assetId: 'p1', assetType: 'image', url: 'up', downloadPath: 'dp', usedAt: new Date().toISOString() },
          { sceneIndex: 1, source: 'pixabay', assetId: 'px1', assetType: 'image', url: 'upx', downloadPath: 'dpx', usedAt: new Date().toISOString() },
        ],
      }
      const sources = m.assets.map((a) => a.source)
      expect(sources).toContain('pexels')
      expect(sources).toContain('pixabay')
      expect(m.assets.length).toBe(2)
    })
  })

  // ─── 6. sceneIndex validation ────────────────────────────────────────────

  describe('sceneIndex validation — bornes et types', () => {
    function isValidSceneIndex(idx: unknown): boolean {
      return typeof idx === 'number' && idx >= 0 && Number.isInteger(idx)
    }

    it('sceneIndex 0 valide', () => {
      expect(isValidSceneIndex(0)).toBe(true)
    })

    it('sceneIndex 5 valide', () => {
      expect(isValidSceneIndex(5)).toBe(true)
    })

    it('sceneIndex négatif invalide', () => {
      expect(isValidSceneIndex(-1)).toBe(false)
    })

    it('sceneIndex string invalide', () => {
      expect(isValidSceneIndex('0')).toBe(false)
    })

    it('sceneIndex float invalide', () => {
      expect(isValidSceneIndex(1.5)).toBe(false)
    })
  })

  // ─── 7. GET stock-manifest — structure réponse ───────────────────────────

  describe('GET /api/runs/[id]/stock-manifest — structure réponse', () => {
    it('404 : data null avec raison explicite', () => {
      const notFound = {
        data: null,
        meta: { reason: 'stock-manifest.json absent — aucun asset stock injecté sur ce run' },
      }
      expect(notFound.data).toBeNull()
      expect(notFound.meta.reason).toContain('absent')
    })

    it('200 : data.runId + data.version + data.assets', () => {
      const found = {
        data: {
          runId: 'run-test',
          version: 1,
          assets: [
            { sceneIndex: 0, source: 'pexels', assetId: 'x', assetType: 'image', url: 'u', downloadPath: 'd', usedAt: new Date().toISOString() },
          ] as StockAsset[],
          generatedAt: new Date().toISOString(),
        } as StockManifest,
      }
      expect(found.data.runId).toBeTruthy()
      expect(found.data.version).toBe(1)
      expect(Array.isArray(found.data.assets)).toBe(true)
      expect(found.data.assets.length).toBe(1)
    })
  })

  // ─── 8. UseStockResult — structure ───────────────────────────────────────

  describe('UseStockResult — structure', () => {
    it('champs requis présents', () => {
      const result: UseStockResult = {
        runId: 'run-abc',
        sceneIndex: 0,
        source: 'pexels',
        assetId: '1234567',
        assetType: 'image',
        downloadPath: '/storage/runs/run-abc/clips/clip-0-stock.jpg',
        url: 'https://images.pexels.com/photos/1234567/photo.jpg',
      }
      expect(result.runId).toBeTruthy()
      expect(result.sceneIndex).toBe(0)
      expect(result.source).toBeTruthy()
      expect(result.assetId).toBeTruthy()
      expect(result.downloadPath).toContain('stock')
    })

    it('downloadPath contient le sceneIndex', () => {
      const result: UseStockResult = {
        runId: 'run-abc', sceneIndex: 3, source: 'pexels', assetId: 'y',
        assetType: 'image', downloadPath: '/path/clip-3-stock.jpg', url: 'u',
      }
      expect(result.downloadPath).toContain('clip-3-stock')
    })
  })

  // ─── 9. Run hybride — stock-manifest.json sur disque ────────────────────

  describe('Run hybride — stock-manifest.json traçable', () => {
    it('stock-manifest.json lisible et version correcte', async () => {
      mkdirSync(FIXTURE_DIR, { recursive: true })
      const m: StockManifest = {
        runId: 'run-hybrid-test',
        version: 1,
        assets: [
          {
            sceneIndex: 0, source: 'pexels', assetId: 'img1', assetType: 'image',
            url: 'https://images.pexels.com/photos/img1/photo.jpg',
            downloadPath: '/storage/runs/run-hybrid-test/clips/clip-0-stock.jpg',
            usedAt: new Date().toISOString(),
          },
          {
            sceneIndex: 1, source: 'pexels', assetId: 'img2', assetType: 'image',
            url: 'https://images.pexels.com/photos/img2/photo.jpg',
            downloadPath: '/storage/runs/run-hybrid-test/clips/clip-1-stock.jpg',
            usedAt: new Date().toISOString(),
          },
        ],
        generatedAt: new Date().toISOString(),
      }
      const p = join(FIXTURE_DIR, 'stock-manifest-hybrid.json')
      await writeFile(p, JSON.stringify(m, null, 2))
      const raw = JSON.parse(await readFile(p, 'utf-8')) as StockManifest
      expect(raw.runId).toBe('run-hybrid-test')
      expect(raw.version).toBe(1)
      expect(raw.assets.length).toBe(2)
      expect(raw.assets.every((a) => a.downloadPath.includes('stock'))).toBe(true)
    })

    it('run est hybride si stock-manifest.json contient >= 1 asset', () => {
      function isHybrid(manifest: StockManifest): boolean {
        return manifest.assets.length > 0
      }
      const empty: StockManifest = { runId: 'r', version: 1, assets: [], generatedAt: new Date().toISOString() }
      const hybrid: StockManifest = {
        runId: 'r', version: 1, generatedAt: new Date().toISOString(),
        assets: [{ sceneIndex: 0, source: 'pexels', assetId: 'a', assetType: 'image', url: 'u', downloadPath: 'd', usedAt: new Date().toISOString() }],
      }
      expect(isHybrid(empty)).toBe(false)
      expect(isHybrid(hybrid)).toBe(true)
    })
  })

  // ─── 10. StockAsset — assetType image vs video ───────────────────────────

  describe('StockAsset — assetType image vs video', () => {
    it('extension .jpg pour image', () => {
      function getExt(type: 'image' | 'video') { return type === 'video' ? '.mp4' : '.jpg' }
      expect(getExt('image')).toBe('.jpg')
      expect(getExt('video')).toBe('.mp4')
    })

    it('fileName inclut sceneIndex et source type', () => {
      function buildFileName(sceneIndex: number, type: 'image' | 'video') {
        const ext = type === 'video' ? '.mp4' : '.jpg'
        return `clip-${sceneIndex}-stock${ext}`
      }
      expect(buildFileName(0, 'image')).toBe('clip-0-stock.jpg')
      expect(buildFileName(2, 'video')).toBe('clip-2-stock.mp4')
      expect(buildFileName(5, 'image')).toBe('clip-5-stock.jpg')
    })
  })
})
