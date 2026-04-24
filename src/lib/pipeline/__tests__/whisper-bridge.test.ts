import { describe, it, expect } from 'vitest'
import type { WhisperTranscript, WhisperSegment, WhisperWord } from '../whisper-bridge'

/**
 * Lot 1A — Tests du contrat JSON canonique whisper-bridge.
 * Vérifie la structure sans appeler Python (tests unitaires purs).
 */

// Fixture : sortie type du script Python
const SAMPLE_TRANSCRIPT: WhisperTranscript = {
  language: 'fr',
  language_probability: 1.0,
  duration_s: 40.893,
  model_used: 'tiny',
  device: 'cpu',
  compute_type: 'int8',
  load_time_s: 3.23,
  transcribe_time_s: 2.55,
  segment_count: 2,
  word_count: 5,
  segments: [
    {
      start_s: 0.0,
      end_s: 2.5,
      text: 'Bonjour à tous',
      words: [
        { word: 'Bonjour', start_s: 0.0, end_s: 0.8, confidence: 0.97 },
        { word: 'à', start_s: 0.8, end_s: 0.9, confidence: 0.95 },
        { word: 'tous', start_s: 0.9, end_s: 1.3, confidence: 0.98 },
      ],
    },
    {
      start_s: 2.5,
      end_s: 4.0,
      text: 'bienvenue ici',
      words: [
        { word: 'bienvenue', start_s: 2.5, end_s: 3.2, confidence: 0.96 },
        { word: 'ici', start_s: 3.2, end_s: 3.8, confidence: 0.94 },
      ],
    },
  ],
}

describe('Lot 1A — Contrat JSON canonique whisper-bridge', () => {
  it('la structure racine contient les champs obligatoires', () => {
    expect(SAMPLE_TRANSCRIPT).toHaveProperty('language')
    expect(SAMPLE_TRANSCRIPT).toHaveProperty('duration_s')
    expect(SAMPLE_TRANSCRIPT).toHaveProperty('model_used')
    expect(SAMPLE_TRANSCRIPT).toHaveProperty('segments')
    expect(SAMPLE_TRANSCRIPT.segments).toBeInstanceOf(Array)
  })

  it('chaque segment a start_s, end_s, text, words[]', () => {
    for (const seg of SAMPLE_TRANSCRIPT.segments) {
      expect(seg).toHaveProperty('start_s')
      expect(seg).toHaveProperty('end_s')
      expect(seg).toHaveProperty('text')
      expect(seg).toHaveProperty('words')
      expect(seg.words).toBeInstanceOf(Array)
      expect(seg.end_s).toBeGreaterThan(seg.start_s)
    }
  })

  it('chaque mot a word, start_s, end_s, confidence', () => {
    for (const seg of SAMPLE_TRANSCRIPT.segments) {
      for (const w of seg.words) {
        expect(w).toHaveProperty('word')
        expect(w).toHaveProperty('start_s')
        expect(w).toHaveProperty('end_s')
        expect(w).toHaveProperty('confidence')
        expect(typeof w.word).toBe('string')
        expect(w.word.length).toBeGreaterThan(0)
        expect(w.confidence).toBeGreaterThanOrEqual(0)
        expect(w.confidence).toBeLessThanOrEqual(1)
      }
    }
  })

  it('les timestamps sont ordonnés', () => {
    let lastEnd = 0
    for (const seg of SAMPLE_TRANSCRIPT.segments) {
      expect(seg.start_s).toBeGreaterThanOrEqual(lastEnd - 0.01) // tolérance 10ms
      lastEnd = seg.end_s
      let wordLastEnd = seg.start_s
      for (const w of seg.words) {
        expect(w.start_s).toBeGreaterThanOrEqual(wordLastEnd - 0.01)
        wordLastEnd = w.end_s
      }
    }
  })

  it('word_count correspond au nombre total de mots', () => {
    const totalWords = SAMPLE_TRANSCRIPT.segments.reduce((acc, s) => acc + s.words.length, 0)
    expect(SAMPLE_TRANSCRIPT.word_count).toBe(totalWords)
  })

  it('segment_count correspond au nombre de segments', () => {
    expect(SAMPLE_TRANSCRIPT.segment_count).toBe(SAMPLE_TRANSCRIPT.segments.length)
  })
})
