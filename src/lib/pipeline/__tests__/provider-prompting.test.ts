import { describe, expect, it } from 'vitest'
import {
  VIDEO_PROVIDER_PROMPT_MATRIX,
  buildManualOverrideProviderPrompts,
  buildProviderPromptVariants,
  buildVideoPromptSystemRules,
  resolveProviderPrompt,
} from '../provider-prompting'

describe('provider-prompting', () => {
  it('expose une matrice pour les providers vidéo connus', () => {
    expect(VIDEO_PROVIDER_PROMPT_MATRIX.happyhorse.promptStyle).toBe('conservative_short_form')
    expect(VIDEO_PROVIDER_PROMPT_MATRIX.kling.promptStyle).toBe('natural_language_cinematic')
    expect(VIDEO_PROVIDER_PROMPT_MATRIX.seedance.promptStyle).toBe('layered_cinematic_precision')
    expect(VIDEO_PROVIDER_PROMPT_MATRIX.ltx.promptStyle).toBe('structured_motion_first')
  })

  it('génère des variantes de prompt par provider', () => {
    const variants = buildProviderPromptVariants({
      subject: 'battle robot',
      action: 'crosses a ruined street',
      environment: 'rainy urban war zone',
      foreground: 'wet broken asphalt and sparks',
      midground: 'the robot moving through smoke',
      background: 'collapsed buildings and distant fire',
      camera: 'low angle tracking shot',
      lighting: 'cold storm light with orange fire reflections',
      motion: 'slow controlled forward movement',
      framing: 'portrait cinematic framing',
      mood: 'tense and grounded',
      style: 'photorealistic live action',
      mustKeep: ['vertical 9:16', 'real environment'],
    }, { hasReferenceImage: true })

    expect(variants.happyhorse?.prompt).toContain('vertical 9:16 TikTok shot')
    expect(variants.kling?.prompt).toContain('real layered environment')
    expect(variants.seedance?.prompt).toContain('real environment with readable depth')
    expect(variants.ltx?.prompt).toContain('vertical 9:16')
  })

  it('résout le prompt du provider ciblé et fallback sinon', () => {
    const providerPrompts = buildManualOverrideProviderPrompts('manual override prompt')
    expect(resolveProviderPrompt(providerPrompts, 'kling', 'fallback')).toBe('manual override prompt')
    expect(resolveProviderPrompt(undefined, 'kling', 'fallback')).toBe('fallback')
  })

  it('injecte les règles système globales et la matrice provider', () => {
    const rules = buildVideoPromptSystemRules()
    expect(rules).toContain('TikTok vertical 9:16')
    expect(rules).toContain('HappyHorse (happyhorse)')
    expect(rules).toContain('Kling (kling)')
    expect(rules).toContain('Seedance (seedance)')
  })
})
