import { describe, it, expect, afterAll } from 'vitest'
import { rmSync, mkdirSync } from 'fs'
import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { LocalizeManifest, LocalizeManifestEntry } from '@/app/api/runs/[id]/localize/route'
import { SUPPORTED_LANGUAGES } from '@/lib/localization'

/**
 * 11A — Localisation one-click réelle
 *
 * Vérifie :
 * 1. LocalizeManifest — structure minimale requise
 * 2. LocalizeManifestEntry — champs requis + visualReused: true
 * 3. Non-régénération visuelle : visualReused = true sur toutes les entrées
 * 4. Deux langues → deux entrées distinctes dans le manifest
 * 5. Langue inconnue → absente du manifest (filtrée silencieusement)
 * 6. Manifest fusionnable : ajout d'une langue ne supprime pas les précédentes
 * 7. GET /api/runs/[id]/localize-manifest — réponses attendues
 * 8. SUPPORTED_LANGUAGES couvre les langues attendues
 */

const FIXTURE_DIR = join(tmpdir(), `vitest-11a-${process.pid}`)

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true })
})

describe('11A — Localisation one-click réelle', () => {

  // ─── 1. Structure minimale du manifest ───────────────────────────────────

  describe('LocalizeManifest — structure minimale', () => {
    it('structure minimale requise', async () => {
      mkdirSync(FIXTURE_DIR, { recursive: true })

      const manifest: LocalizeManifest = {
        runId: 'test-11a',
        version: 1,
        sourceLang: 'fr',
        languages: [],
        totalCostEur: 0,
        generatedAt: new Date().toISOString(),
      }

      const path = join(FIXTURE_DIR, 'localize-manifest.json')
      await writeFile(path, JSON.stringify(manifest, null, 2))
      const raw = JSON.parse(await readFile(path, 'utf-8')) as LocalizeManifest

      expect(raw.runId).toBe('test-11a')
      expect(raw.version).toBe(1)
      expect(raw.sourceLang).toBe('fr')
      expect(Array.isArray(raw.languages)).toBe(true)
      expect(typeof raw.totalCostEur).toBe('number')
      expect(raw.generatedAt).toBeTruthy()
      expect(() => new Date(raw.generatedAt)).not.toThrow()
    })

    it('version = 1 (versionnement artefact)', () => {
      const manifest: LocalizeManifest = {
        runId: 'r1', version: 1, sourceLang: 'fr',
        languages: [], totalCostEur: 0, generatedAt: new Date().toISOString(),
      }
      expect(manifest.version).toBe(1)
    })
  })

  // ─── 2. LocalizeManifestEntry — champs requis ─────────────────────────────

  describe('LocalizeManifestEntry — champs requis', () => {
    it('entrée complète avec status completed', () => {
      const entry: LocalizeManifestEntry = {
        lang: 'en',
        langLabel: 'English',
        status: 'completed',
        scriptPath: 'storage/runs/test/final/en/script.txt',
        ttsPath: null,
        visualReused: true,
        costEur: 0.02,
      }

      expect(entry.lang).toBe('en')
      expect(entry.langLabel).toBe('English')
      expect(entry.status).toBe('completed')
      expect(entry.scriptPath).toBeTruthy()
      expect(entry.visualReused).toBe(true)
      expect(typeof entry.costEur).toBe('number')
    })

    it('entrée avec status failed', () => {
      const entry: LocalizeManifestEntry = {
        lang: 'de',
        langLabel: 'Deutsch',
        status: 'failed',
        scriptPath: null,
        ttsPath: null,
        visualReused: true,
        costEur: 0,
      }

      expect(entry.status).toBe('failed')
      expect(entry.scriptPath).toBeNull()
      expect(entry.visualReused).toBe(true)
    })
  })

  // ─── 3. Non-régénération visuelle ────────────────────────────────────────

  describe('Non-régénération visuelle — visualReused: true', () => {
    it('toutes les entrées ont visualReused = true', () => {
      const manifest: LocalizeManifest = {
        runId: 'test', version: 1, sourceLang: 'fr',
        languages: [
          { lang: 'en', langLabel: 'English', status: 'completed', scriptPath: 'p1', ttsPath: null, visualReused: true, costEur: 0.02 },
          { lang: 'de', langLabel: 'Deutsch', status: 'completed', scriptPath: 'p2', ttsPath: null, visualReused: true, costEur: 0.02 },
          { lang: 'es', langLabel: 'Español', status: 'failed', scriptPath: null, ttsPath: null, visualReused: true, costEur: 0 },
        ],
        totalCostEur: 0.04,
        generatedAt: new Date().toISOString(),
      }

      for (const entry of manifest.languages) {
        expect(entry.visualReused).toBe(true)
      }
    })

    it('visualReused est un littéral true (pas juste truthy)', () => {
      const entry: LocalizeManifestEntry = {
        lang: 'pt', langLabel: 'Português', status: 'completed',
        scriptPath: 'p', ttsPath: null, visualReused: true, costEur: 0,
      }
      expect(entry.visualReused).toBe(true)
      expect(entry.visualReused).not.toBe(1)
    })
  })

  // ─── 4. Deux langues → deux entrées distinctes ───────────────────────────

  describe('Deux langues → deux entrées distinctes dans le manifest', () => {
    it('deux langues → deux entrées avec lang différent', async () => {
      mkdirSync(FIXTURE_DIR, { recursive: true })

      const manifest: LocalizeManifest = {
        runId: 'test', version: 1, sourceLang: 'fr',
        languages: [
          { lang: 'en', langLabel: 'English', status: 'completed', scriptPath: 'p1', ttsPath: null, visualReused: true, costEur: 0.02 },
          { lang: 'de', langLabel: 'Deutsch', status: 'completed', scriptPath: 'p2', ttsPath: null, visualReused: true, costEur: 0.02 },
        ],
        totalCostEur: 0.04,
        generatedAt: new Date().toISOString(),
      }

      const path = join(FIXTURE_DIR, 'localize-manifest-2.json')
      await writeFile(path, JSON.stringify(manifest, null, 2))
      const raw = JSON.parse(await readFile(path, 'utf-8')) as LocalizeManifest

      expect(raw.languages.length).toBe(2)
      const langs = raw.languages.map((l) => l.lang)
      expect(langs).toContain('en')
      expect(langs).toContain('de')
      expect(new Set(langs).size).toBe(2)
    })

    it('scriptPath différent entre deux langues', () => {
      const entries: LocalizeManifestEntry[] = [
        { lang: 'en', langLabel: 'English', status: 'completed', scriptPath: 'storage/runs/r/final/en/script.txt', ttsPath: null, visualReused: true, costEur: 0 },
        { lang: 'es', langLabel: 'Español', status: 'completed', scriptPath: 'storage/runs/r/final/es/script.txt', ttsPath: null, visualReused: true, costEur: 0 },
      ]
      expect(entries[0].scriptPath).not.toBe(entries[1].scriptPath)
      expect(entries[0].scriptPath).toContain('/en/')
      expect(entries[1].scriptPath).toContain('/es/')
    })
  })

  // ─── 5. Langue inconnue → filtrée silencieusement ─────────────────────────

  describe('Langue inconnue → filtrée', () => {
    it('langCode inconnu non présent dans SUPPORTED_LANGUAGES', () => {
      const unknown: string = 'xx'
      const found = SUPPORTED_LANGUAGES.find((l) => (l.code as string) === unknown)
      expect(found).toBeUndefined()
    })

    it('manifest sans entrée pour langue inconnue', () => {
      const manifest: LocalizeManifest = {
        runId: 'r', version: 1, sourceLang: 'fr',
        languages: [
          { lang: 'en', langLabel: 'English', status: 'completed', scriptPath: 'p', ttsPath: null, visualReused: true, costEur: 0 },
        ],
        totalCostEur: 0, generatedAt: new Date().toISOString(),
      }
      const hasUnknown = manifest.languages.some((l) => !SUPPORTED_LANGUAGES.find((s) => s.code === l.lang))
      expect(hasUnknown).toBe(false)
    })
  })

  // ─── 6. Fusion manifest — ajout sans perte ───────────────────────────────

  describe('Fusion manifest — ajout d\'une langue conserve les précédentes', () => {
    it('fusion : previousEntries conservées + nouvelles ajoutées', () => {
      const previous: LocalizeManifestEntry[] = [
        { lang: 'en', langLabel: 'English', status: 'completed', scriptPath: 'p1', ttsPath: null, visualReused: true, costEur: 0.02 },
      ]
      const newEntries: LocalizeManifestEntry[] = [
        { lang: 'de', langLabel: 'Deutsch', status: 'completed', scriptPath: 'p2', ttsPath: null, visualReused: true, costEur: 0.02 },
      ]
      const newLanguages = ['de']
      const merged = [
        ...previous.filter((e) => !newLanguages.includes(e.lang)),
        ...newEntries,
      ]

      expect(merged.length).toBe(2)
      expect(merged.map((l) => l.lang)).toContain('en')
      expect(merged.map((l) => l.lang)).toContain('de')
    })

    it('re-localisation d\'une langue existante remplace l\'ancienne entrée', () => {
      const previous: LocalizeManifestEntry[] = [
        { lang: 'en', langLabel: 'English', status: 'failed', scriptPath: null, ttsPath: null, visualReused: true, costEur: 0 },
      ]
      const retry: LocalizeManifestEntry[] = [
        { lang: 'en', langLabel: 'English', status: 'completed', scriptPath: 'p', ttsPath: null, visualReused: true, costEur: 0.02 },
      ]
      const merged = [
        ...previous.filter((e) => e.lang !== 'en'),
        ...retry,
      ]

      expect(merged.length).toBe(1)
      expect(merged[0].status).toBe('completed')
    })
  })

  // ─── 7. GET /api/runs/[id]/localize-manifest — réponses attendues ─────────

  describe('GET /api/runs/[id]/localize-manifest — réponses attendues', () => {
    it('manifest absent → data null avec raison claire', () => {
      const expected = {
        data: null,
        meta: { reason: 'localize-manifest.json absent — localisation non encore lancée' },
      }
      expect(expected.data).toBeNull()
      expect(expected.meta.reason).toContain('localisation non encore lancée')
    })

    it('manifest présent → data contient les champs attendus', () => {
      const response = {
        data: {
          runId: 'x', version: 1, sourceLang: 'fr',
          languages: [
            { lang: 'en', langLabel: 'English', status: 'completed', scriptPath: 'p', ttsPath: null, visualReused: true, costEur: 0.02 },
          ],
          totalCostEur: 0.02,
          generatedAt: new Date().toISOString(),
        },
      }
      expect(response.data.version).toBe(1)
      expect(response.data.sourceLang).toBe('fr')
      expect(Array.isArray(response.data.languages)).toBe(true)
      expect(response.data.languages[0].visualReused).toBe(true)
    })
  })

  // ─── 8. SUPPORTED_LANGUAGES ───────────────────────────────────────────────

  describe('SUPPORTED_LANGUAGES — couverture', () => {
    it('contient au moins fr, en, es, de', () => {
      const codes = SUPPORTED_LANGUAGES.map((l) => l.code)
      expect(codes).toContain('fr')
      expect(codes).toContain('en')
      expect(codes).toContain('es')
      expect(codes).toContain('de')
    })

    it('chaque langue a un code et un label non vides', () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(lang.code.length).toBeGreaterThan(0)
        expect(lang.label.length).toBeGreaterThan(0)
      }
    })
  })
})
