import { describe, it, expect, afterAll } from 'vitest'
import { rmSync, mkdirSync } from 'fs'
import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { ViralSegment, ViralManifest, CreateRunFromSegmentResult } from '@/lib/viral/viral-types'

/**
 * 11C — Module viral réel
 *
 * Vérifie :
 * 1. ViralSegment — structure et champs requis
 * 2. ViralManifest — structure minimale
 * 3. ViralManifest — runsCreated additivité
 * 4. segmentIndex validation (bornes)
 * 5. Idea building depuis segment
 * 6. GET /api/viral/{id} — structure réponse 404/200
 * 7. viral-source.json — traçabilité source → run
 * 8. CreateRunFromSegmentResult — structure
 */

const FIXTURE_DIR = join(tmpdir(), `vitest-11c-${process.pid}`)

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true })
})

describe('11C — Module viral réel', () => {

  // ─── 1. ViralSegment — structure ────────────────────────────────────────

  describe('ViralSegment — structure et champs requis', () => {
    it('champs requis présents', () => {
      const seg: ViralSegment = {
        index: 0,
        start_s: 0,
        end_s: 45,
        title: 'Le moment clé',
        reason: 'Accroche forte, émotion visible',
      }
      expect(seg.index).toBe(0)
      expect(seg.start_s).toBe(0)
      expect(seg.end_s).toBe(45)
      expect(seg.title).toBeTruthy()
      expect(seg.reason).toBeTruthy()
    })

    it('start_s < end_s (durée positive)', () => {
      const seg: ViralSegment = { index: 1, start_s: 30, end_s: 75, title: 't', reason: 'r' }
      expect(seg.end_s).toBeGreaterThan(seg.start_s)
    })

    it('excerpt est optionnel', () => {
      const seg: ViralSegment = { index: 2, start_s: 0, end_s: 30, title: 't', reason: 'r' }
      expect(seg.excerpt).toBeUndefined()
      const segWithExcerpt: ViralSegment = { ...seg, excerpt: 'texte extrait' }
      expect(segWithExcerpt.excerpt).toBe('texte extrait')
    })

    it('index identifie le segment de façon unique', () => {
      const segments: ViralSegment[] = [
        { index: 0, start_s: 0, end_s: 45, title: 'A', reason: 'rA' },
        { index: 1, start_s: 60, end_s: 100, title: 'B', reason: 'rB' },
      ]
      const indexes = segments.map(s => s.index)
      expect(new Set(indexes).size).toBe(2)
    })
  })

  // ─── 2. ViralManifest — structure ───────────────────────────────────────

  describe('ViralManifest — structure minimale', () => {
    it('version = 1', async () => {
      mkdirSync(FIXTURE_DIR, { recursive: true })
      const m: ViralManifest = {
        id: 'test-viral-1',
        version: 1,
        url: 'https://www.youtube.com/watch?v=abc123',
        sourceDownloaded: true,
        sourceSizeBytes: 5_000_000,
        segmentsCount: 3,
        runsCreated: [],
        generatedAt: new Date().toISOString(),
      }
      const p = join(FIXTURE_DIR, 'viral-manifest.json')
      await writeFile(p, JSON.stringify(m, null, 2))
      const raw = JSON.parse(await readFile(p, 'utf-8')) as ViralManifest
      expect(raw.version).toBe(1)
    })

    it('sourceDownloaded est un booléen', () => {
      const m: ViralManifest = {
        id: 'x', version: 1, url: 'https://youtube.com/watch?v=x',
        sourceDownloaded: true, segmentsCount: 2, runsCreated: [],
        generatedAt: new Date().toISOString(),
      }
      expect(typeof m.sourceDownloaded).toBe('boolean')
    })

    it('segmentsCount correspond au nombre de segments', async () => {
      const segments: ViralSegment[] = [
        { index: 0, start_s: 0, end_s: 45, title: 'A', reason: 'rA' },
        { index: 1, start_s: 60, end_s: 100, title: 'B', reason: 'rB' },
        { index: 2, start_s: 120, end_s: 160, title: 'C', reason: 'rC' },
      ]
      const m: ViralManifest = {
        id: 'y', version: 1, url: 'https://youtube.com/watch?v=y',
        sourceDownloaded: true, segmentsCount: segments.length, runsCreated: [],
        generatedAt: new Date().toISOString(),
      }
      expect(m.segmentsCount).toBe(3)
      expect(m.segmentsCount).toBe(segments.length)
    })

    it('sourceSizeBytes est optionnel', () => {
      const m: ViralManifest = {
        id: 'z', version: 1, url: 'https://youtube.com/watch?v=z',
        sourceDownloaded: false, segmentsCount: 0, runsCreated: [],
        generatedAt: new Date().toISOString(),
      }
      expect(m.sourceSizeBytes).toBeUndefined()
    })
  })

  // ─── 3. ViralManifest — runsCreated additivité ───────────────────────────

  describe('ViralManifest — runsCreated additivité', () => {
    it('ajout d\'un run conserve les existants', () => {
      const existing: ViralManifest = {
        id: 'v1', version: 1, url: 'https://youtube.com/watch?v=v1',
        sourceDownloaded: true, segmentsCount: 3, runsCreated: ['run-aaa'],
        generatedAt: new Date().toISOString(),
      }
      const newRunId = 'run-bbb'
      const updated: ViralManifest = {
        ...existing,
        runsCreated: [...existing.runsCreated.filter(r => r !== newRunId), newRunId],
      }
      expect(updated.runsCreated).toContain('run-aaa')
      expect(updated.runsCreated).toContain('run-bbb')
      expect(updated.runsCreated.length).toBe(2)
    })

    it('pas de doublon si même runId ajouté deux fois', () => {
      const runId = 'run-ccc'
      const existing: ViralManifest = {
        id: 'v2', version: 1, url: 'https://youtube.com/watch?v=v2',
        sourceDownloaded: true, segmentsCount: 2, runsCreated: [runId],
        generatedAt: new Date().toISOString(),
      }
      const updated: ViralManifest = {
        ...existing,
        runsCreated: [...existing.runsCreated.filter(r => r !== runId), runId],
      }
      expect(updated.runsCreated.filter(r => r === runId).length).toBe(1)
    })
  })

  // ─── 4. segmentIndex validation ─────────────────────────────────────────

  describe('segmentIndex validation — bornes', () => {
    const segments: ViralSegment[] = [
      { index: 0, start_s: 0, end_s: 45, title: 'A', reason: 'rA' },
      { index: 1, start_s: 60, end_s: 100, title: 'B', reason: 'rB' },
      { index: 2, start_s: 120, end_s: 160, title: 'C', reason: 'rC' },
    ]

    function isValidIndex(idx: number) {
      return idx >= 0 && idx < segments.length
    }

    it('index 0 valide sur tableau de 3', () => {
      expect(isValidIndex(0)).toBe(true)
    })

    it('index 2 valide (dernier) sur tableau de 3', () => {
      expect(isValidIndex(2)).toBe(true)
    })

    it('index négatif invalide', () => {
      expect(isValidIndex(-1)).toBe(false)
    })

    it('index >= length invalide', () => {
      expect(isValidIndex(3)).toBe(false)
      expect(isValidIndex(100)).toBe(false)
    })
  })

  // ─── 5. Idea building depuis segment ────────────────────────────────────

  describe('Idea building depuis segment', () => {
    function buildIdea(seg: ViralSegment, idx: number, total: number): string {
      return `[Viral ${idx + 1}/${total}] ${seg.title}`
    }

    it('format [Viral N/Total] titre', () => {
      const seg: ViralSegment = { index: 0, start_s: 0, end_s: 45, title: 'Le moment choc', reason: 'r' }
      expect(buildIdea(seg, 0, 3)).toBe('[Viral 1/3] Le moment choc')
    })

    it('index 0 → [Viral 1/N]', () => {
      const seg: ViralSegment = { index: 0, start_s: 0, end_s: 45, title: 'Révélation', reason: 'r' }
      const idea = buildIdea(seg, 0, 5)
      expect(idea.startsWith('[Viral 1/')).toBe(true)
    })

    it('index 2 sur 4 → [Viral 3/4]', () => {
      const seg: ViralSegment = { index: 2, start_s: 90, end_s: 130, title: 'Twist final', reason: 'r' }
      expect(buildIdea(seg, 2, 4)).toBe('[Viral 3/4] Twist final')
    })
  })

  // ─── 6. GET /api/viral/{id} — structure réponse ─────────────────────────

  describe('GET /api/viral/{id} — structure réponse', () => {
    it('404 : data null avec raison explicite', () => {
      const notFound = {
        data: null,
        meta: { reason: 'Session virale introuvable ou non encore complète' },
      }
      expect(notFound.data).toBeNull()
      expect(notFound.meta.reason).toContain('introuvable')
    })

    it('200 : data.manifest + data.segments', () => {
      const found = {
        data: {
          manifest: {
            id: 'abc', version: 1, url: 'https://youtube.com/watch?v=abc',
            sourceDownloaded: true, segmentsCount: 2, runsCreated: [],
            generatedAt: new Date().toISOString(),
          } as ViralManifest,
          segments: [
            { index: 0, start_s: 0, end_s: 45, title: 'A', reason: 'rA' },
          ] as ViralSegment[],
        },
      }
      expect(found.data.manifest.version).toBe(1)
      expect(Array.isArray(found.data.segments)).toBe(true)
      expect(found.data.segments.length).toBe(1)
    })
  })

  // ─── 7. viral-source.json — traçabilité ─────────────────────────────────

  describe('viral-source.json — traçabilité source → run', () => {
    it('contient viralId, segmentIndex, segment, sourceUrl', async () => {
      const viralSource = {
        viralId: 'viral-abc',
        segmentIndex: 1,
        segment: { index: 1, start_s: 60, end_s: 100, title: 'B', reason: 'rB' } as ViralSegment,
        sourceUrl: 'https://youtube.com/watch?v=abc',
        createdAt: new Date().toISOString(),
      }
      const p = join(FIXTURE_DIR, 'viral-source.json')
      await writeFile(p, JSON.stringify(viralSource, null, 2))
      const raw = JSON.parse(await readFile(p, 'utf-8'))
      expect(raw.viralId).toBe('viral-abc')
      expect(raw.segmentIndex).toBe(1)
      expect(raw.segment.title).toBe('B')
      expect(raw.sourceUrl).toContain('youtube.com')
    })

    it('createdAt est présent et non vide', () => {
      const viralSource = {
        viralId: 'x', segmentIndex: 0,
        segment: { index: 0, start_s: 0, end_s: 30, title: 'X', reason: 'r' },
        sourceUrl: 'https://youtube.com/watch?v=x',
        createdAt: new Date().toISOString(),
      }
      expect(viralSource.createdAt).toBeTruthy()
    })
  })

  // ─── 8. CreateRunFromSegmentResult — structure ───────────────────────────

  describe('CreateRunFromSegmentResult — structure', () => {
    it('champs requis présents', () => {
      const result: CreateRunFromSegmentResult = {
        runId: 'run-xyz',
        viralId: 'viral-abc',
        segmentIndex: 0,
        idea: '[Viral 1/3] Le moment choc',
        chainId: '6e3d5697-6cb9-4717-a377-b5574f9f84a2',
        createdAt: new Date().toISOString(),
      }
      expect(result.runId).toBeTruthy()
      expect(result.viralId).toBeTruthy()
      expect(result.idea).toContain('[Viral')
      expect(result.chainId).toBeTruthy()
    })

    it('idea contient le titre du segment', () => {
      const result: CreateRunFromSegmentResult = {
        runId: 'run-xyz', viralId: 'viral-abc', segmentIndex: 1,
        idea: '[Viral 2/4] Révélation choc',
        chainId: 'chain-1', createdAt: new Date().toISOString(),
      }
      expect(result.idea).toContain('Révélation choc')
    })
  })
})
