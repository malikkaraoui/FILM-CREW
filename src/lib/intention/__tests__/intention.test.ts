import { describe, it, expect, afterAll } from 'vitest'
import { rmSync, mkdirSync } from 'fs'
import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import {
  INTENTION_BLOCS,
  getVisibleQuestions,
  buildIntentionPrefix,
  countVisibleQuestions,
} from '../schema'

const FIXTURE_DIR = join(__dirname, '__fixtures__', 'intention-test')

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true })
})

describe('10B — Questionnaire adaptatif', () => {

  // ─── Schéma — structure ─────────────────────────────────────────────────

  describe('INTENTION_BLOCS — structure', () => {
    it('6 blocs exacts', () => {
      expect(INTENTION_BLOCS).toHaveLength(6)
    })

    it('ids des blocs corrects', () => {
      const ids = INTENTION_BLOCS.map((b) => b.id)
      expect(ids).toEqual(['production', 'narration', 'mise_en_scene', 'image', 'son', 'montage'])
    })

    it('chaque bloc a label + description + questions non vides', () => {
      for (const bloc of INTENTION_BLOCS) {
        expect(bloc.label).toBeTruthy()
        expect(bloc.description).toBeTruthy()
        expect(bloc.questions.length).toBeGreaterThan(0)
      }
    })

    it('chaque question a id + label + options (≥ 2)', () => {
      for (const bloc of INTENTION_BLOCS) {
        for (const q of bloc.questions) {
          expect(q.id).toBeTruthy()
          expect(q.label).toBeTruthy()
          expect(q.options.length).toBeGreaterThanOrEqual(2)
        }
      }
    })

    it('max 15 questions visibles sans réponses (base)', () => {
      const count = countVisibleQuestions({})
      expect(count).toBeLessThanOrEqual(15)
    })

    it('toutes les questions ont des ids uniques', () => {
      const ids = INTENTION_BLOCS.flatMap((b) => b.questions.map((q) => q.id))
      const uniq = new Set(ids)
      expect(uniq.size).toBe(ids.length)
    })
  })

  // ─── Logique conditionnelle ──────────────────────────────────────────────

  describe('getVisibleQuestions — logique conditionnelle', () => {
    it('sans réponses : questions showIf masquées', () => {
      const visible = getVisibleQuestions({})
      const conditionalIds = INTENTION_BLOCS
        .flatMap((b) => b.questions)
        .filter((q) => q.showIf)
        .map((q) => q.id)

      for (const id of conditionalIds) {
        expect(visible.some((q) => q.id === id)).toBe(false)
      }
    })

    it('voixoff=oui → style_voix apparaît', () => {
      const visible = getVisibleQuestions({ voixoff: 'oui' })
      expect(visible.some((q) => q.id === 'style_voix')).toBe(true)
    })

    it('voixoff=non → style_voix reste masqué', () => {
      const visible = getVisibleQuestions({ voixoff: 'non' })
      expect(visible.some((q) => q.id === 'style_voix')).toBe(false)
    })

    it('avec voixoff=oui : count > count sans réponses', () => {
      const base = countVisibleQuestions({})
      const withVoix = countVisibleQuestions({ voixoff: 'oui' })
      expect(withVoix).toBeGreaterThan(base)
    })
  })

  // ─── buildIntentionPrefix ────────────────────────────────────────────────

  describe('buildIntentionPrefix — contenu', () => {
    it('réponses vides → chaîne vide', () => {
      expect(buildIntentionPrefix({})).toBe('')
    })

    it('réponse genre=educatif → contient "Éducatif"', () => {
      const prefix = buildIntentionPrefix({ genre: 'educatif' })
      expect(prefix).toContain('Éducatif')
      expect(prefix).toContain('[Production]')
    })

    it('réponses multiples → plusieurs blocs dans le prefix', () => {
      const prefix = buildIntentionPrefix({
        genre: 'educatif',
        ton: 'humoristique',
        style_visuel: 'cinematographique',
        palette: 'froide',
        musique: 'presente',
        vitesse_coupe: 'rapide',
      })
      expect(prefix).toContain('[Production]')
      expect(prefix).toContain('[Narration]')
      expect(prefix).toContain('[Mise en scène]')
      expect(prefix).toContain('[Image]')
      expect(prefix).toContain('[Son]')
      expect(prefix).toContain('[Montage]')
    })

    it('deux jeux de réponses différents → deux préfixes différents', () => {
      const prefix1 = buildIntentionPrefix({ genre: 'educatif', ton: 'serieux' })
      const prefix2 = buildIntentionPrefix({ genre: 'fiction', ton: 'humoristique' })
      expect(prefix1).not.toBe(prefix2)
    })

    it('ne contient pas les valeurs de réponses masquées par showIf', () => {
      // style_voix ne doit pas apparaître si voixoff n'est pas 'oui'
      const prefix = buildIntentionPrefix({ genre: 'educatif', style_voix: 'chaleureuse' })
      // style_voix est conditionnel (showIf voixoff=oui) — sans voixoff=oui, ne doit pas apparaître
      expect(prefix).not.toContain('Chaleureuse')
    })
  })

  // ─── Persistence intention.json ──────────────────────────────────────────

  describe('intention.json — I/O disque réel', () => {
    it('écrit et relit intention.json', async () => {
      mkdirSync(FIXTURE_DIR, { recursive: true })

      const answers = { genre: 'educatif', ton: 'humoristique', palette: 'froide' }
      const prefix = buildIntentionPrefix(answers)

      const intentionData = {
        answers,
        prefix,
        createdAt: new Date().toISOString(),
      }

      const path = join(FIXTURE_DIR, 'intention.json')
      await writeFile(path, JSON.stringify(intentionData, null, 2))

      const raw = JSON.parse(await readFile(path, 'utf-8'))

      expect(raw.answers).toEqual(answers)
      expect(raw.prefix).toBe(prefix)
      expect(raw.prefix).toContain('[Production]')
      expect(raw.createdAt).toBeTruthy()
      expect(() => new Date(raw.createdAt)).not.toThrow()
    })

    it('deux runs différents produisent des intention.json différents', async () => {
      mkdirSync(FIXTURE_DIR, { recursive: true })

      const answers1 = { genre: 'educatif', ton: 'serieux' }
      const answers2 = { genre: 'fiction', ton: 'dramatique' }

      const data1 = { answers: answers1, prefix: buildIntentionPrefix(answers1), createdAt: new Date().toISOString() }
      const data2 = { answers: answers2, prefix: buildIntentionPrefix(answers2), createdAt: new Date().toISOString() }

      const path1 = join(FIXTURE_DIR, 'intention-run1.json')
      const path2 = join(FIXTURE_DIR, 'intention-run2.json')
      await writeFile(path1, JSON.stringify(data1, null, 2))
      await writeFile(path2, JSON.stringify(data2, null, 2))

      const raw1 = JSON.parse(await readFile(path1, 'utf-8'))
      const raw2 = JSON.parse(await readFile(path2, 'utf-8'))

      expect(raw1.prefix).not.toBe(raw2.prefix)
      expect(raw1.answers.genre).toBe('educatif')
      expect(raw2.answers.genre).toBe('fiction')
    })
  })

  // ─── Enrichissement de l'idée ────────────────────────────────────────────

  describe('enrichissement idea → différences de suites', () => {
    it('prefix + idée identique → deux enrichissements différents si prefix diffèrent', () => {
      const idea = 'La polémique Mbappé expliquée en 90 secondes'

      const prefix1 = buildIntentionPrefix({ genre: 'educatif', ton: 'serieux' })
      const prefix2 = buildIntentionPrefix({ genre: 'fiction', ton: 'humoristique' })

      const enriched1 = prefix1 ? `${prefix1}\n\nIdée : ${idea}` : idea
      const enriched2 = prefix2 ? `${prefix2}\n\nIdée : ${idea}` : idea

      expect(enriched1).not.toBe(enriched2)
      expect(enriched1).toContain(idea)
      expect(enriched2).toContain(idea)
      expect(enriched1).toContain('[Production]')
      expect(enriched2).toContain('[Production]')
    })

    it('sans questionnaire : idée inchangée', () => {
      const idea = 'Sujet sans questionnaire'
      const prefix = buildIntentionPrefix({})
      const enriched = prefix ? `${prefix}\n\nIdée : ${idea}` : idea
      expect(enriched).toBe(idea)
    })
  })
})
