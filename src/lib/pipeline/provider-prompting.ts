export const VIDEO_PROMPT_PROVIDERS = ['happyhorse', 'kling', 'seedance', 'ltx', 'sketch-local'] as const

export type VideoPromptProvider = (typeof VIDEO_PROMPT_PROVIDERS)[number]

export type CanonicalVideoPrompt = {
  subject: string
  action: string
  environment: string
  foreground: string
  midground: string
  background: string
  camera: string
  lighting: string
  motion: string
  framing: string
  mood: string
  style: string
  audio?: string
  dialogue?: string
  mustKeep?: string[]
}

export type ProviderPromptVariant = {
  provider: VideoPromptProvider
  promptStyle: string
  prompt: string
  rationale: string
}

export type ProviderPromptMap = Partial<Record<VideoPromptProvider, ProviderPromptVariant>>

export type ProviderPromptProfile = {
  displayName: string
  promptStyle: string
  bestFor: string
  systemRules: string[]
}

export const VIDEO_PROVIDER_PROMPT_MATRIX: Record<VideoPromptProvider, ProviderPromptProfile> = {
  happyhorse: {
    displayName: 'HappyHorse',
    promptStyle: 'conservative_short_form',
    bestFor: 'prompts courts, directs, verticaux et très concrets',
    systemRules: [
      'reste court, concret et sans prose décorative',
      'un seul sujet héro, une seule action principale, un seul mouvement caméra',
      'impose un décor réel avec foreground, midground et background lisibles',
      'pense le plan nativement en TikTok 9:16 vertical, pas en paysage recadré',
      'si une image de référence existe, préserve l identité sans la recopier ni l utiliser comme ouverture obligatoire',
    ],
  },
  kling: {
    displayName: 'Kling',
    promptStyle: 'natural_language_cinematic',
    bestFor: 'mouvement clair, narration courte, langage naturel cinématique',
    systemRules: [
      'décris le mouvement de façon claire et crédible dans une durée courte',
      'utilise un langage naturel plutôt qu une liste de tags rigides',
      'garde une portée réaliste pour 5 à 10 secondes',
      'la caméra et l action doivent rester lisibles dès la première lecture',
    ],
  },
  seedance: {
    displayName: 'Seedance',
    promptStyle: 'layered_cinematic_precision',
    bestFor: 'prompts structurés, cadrés, avec continuité de décor et d intention',
    systemRules: [
      'structure le plan comme une direction de mise en scène précise',
      'priorise la hiérarchie visuelle, la continuité et la cohérence matière/lumière',
      'garde la profondeur de décor explicite pour éviter l effet studio générique',
      'si une référence existe, fais-en un rappel subtil et narratif, jamais une copie servile',
    ],
  },
  ltx: {
    displayName: 'LTX',
    promptStyle: 'structured_motion_first',
    bestFor: 'prompts simples, techniques et motion-first',
    systemRules: [
      'va droit au but avec sujet, action, caméra, mouvement et format',
      'évite les descriptions trop artistiques ou trop longues',
      'garde un rendu réaliste, stable, lisible et vertical 9:16',
      'réduis toute ambiguïté sur le mouvement attendu',
    ],
  },
  'sketch-local': {
    displayName: 'Sketch Local',
    promptStyle: 'descriptive_debug',
    bestFor: 'debug visuel et brouillon texte local',
    systemRules: [
      'produis une description lisible pour debug, sans chercher un rendu premium',
      'le but est la compréhension rapide de la scène',
      'garde le sujet, l action et le décor immédiatement identifiables',
    ],
  },
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ')
}

function compactParts(parts: Array<string | null | undefined>): string {
  return parts.map((part) => normalizeText(part)).filter(Boolean).join(', ')
}

function withReferenceClause(hasReferenceImage: boolean): string {
  return hasReferenceImage
    ? 'preserve identity cues from the reference image without recreating it shot-for-shot or using it as the mandatory opening frame'
    : ''
}

function withMustKeep(mustKeep?: string[]): string {
  return mustKeep?.length ? `must keep: ${mustKeep.join(', ')}` : ''
}

function buildHappyHorsePrompt(input: CanonicalVideoPrompt, hasReferenceImage: boolean): string {
  return [
    'vertical 9:16 TikTok shot',
    `${input.subject}, ${input.action}`,
    `foreground: ${input.foreground}`,
    `midground: ${input.midground}`,
    `background: ${input.background}`,
    input.environment,
    compactParts([input.camera, input.motion]),
    input.lighting,
    compactParts([input.mood, input.style]),
    withReferenceClause(hasReferenceImage),
    withMustKeep(input.mustKeep),
  ].filter(Boolean).join('. ').trim()
}

function buildKlingPrompt(input: CanonicalVideoPrompt, hasReferenceImage: boolean): string {
  return [
    `${input.subject} ${input.action} in a real layered environment designed for a vertical 9:16 TikTok frame`,
    `foreground: ${input.foreground}`,
    `midground: ${input.midground}`,
    `background: ${input.background}`,
    input.environment,
    `${input.camera}, ${input.motion}`,
    input.lighting,
    compactParts([input.mood, input.style]),
    withReferenceClause(hasReferenceImage),
    withMustKeep(input.mustKeep),
  ].filter(Boolean).join('. ').trim()
}

function buildSeedancePrompt(input: CanonicalVideoPrompt, hasReferenceImage: boolean): string {
  return [
    compactParts([input.style, input.framing]),
    `${input.subject}, ${input.action}`,
    `real environment with readable depth: foreground ${input.foreground}; midground ${input.midground}; background ${input.background}`,
    input.environment,
    compactParts([input.camera, input.motion]),
    input.lighting,
    input.dialogue ? `dialogue cue: ${input.dialogue}` : '',
    input.audio ? `audio cue: ${input.audio}` : '',
    input.mood,
    'native vertical 9:16 composition for TikTok',
    withReferenceClause(hasReferenceImage),
    withMustKeep(input.mustKeep),
  ].filter(Boolean).join('. ').trim()
}

function buildLtxPrompt(input: CanonicalVideoPrompt, hasReferenceImage: boolean): string {
  return [
    'vertical 9:16',
    `${input.subject}, ${input.action}`,
    `foreground ${input.foreground}`,
    `midground ${input.midground}`,
    `background ${input.background}`,
    compactParts([input.camera, input.motion]),
    input.lighting,
    input.environment,
    input.mood,
    withReferenceClause(hasReferenceImage),
    withMustKeep(input.mustKeep),
  ].filter(Boolean).join('. ').trim()
}

function buildSketchLocalPrompt(input: CanonicalVideoPrompt): string {
  return [
    `DEBUG scene: ${input.subject}`,
    `action: ${input.action}`,
    `foreground: ${input.foreground}`,
    `midground: ${input.midground}`,
    `background: ${input.background}`,
    `camera: ${input.camera}`,
    `motion: ${input.motion}`,
    `lighting: ${input.lighting}`,
    `mood: ${input.mood}`,
  ].filter(Boolean).join(' | ').trim()
}

export function buildProviderPromptVariants(
  input: CanonicalVideoPrompt,
  opts: { hasReferenceImage?: boolean } = {},
): ProviderPromptMap {
  const hasReferenceImage = opts.hasReferenceImage ?? false

  return {
    happyhorse: {
      provider: 'happyhorse',
      promptStyle: VIDEO_PROVIDER_PROMPT_MATRIX.happyhorse.promptStyle,
      prompt: buildHappyHorsePrompt(input, hasReferenceImage),
      rationale: VIDEO_PROVIDER_PROMPT_MATRIX.happyhorse.bestFor,
    },
    kling: {
      provider: 'kling',
      promptStyle: VIDEO_PROVIDER_PROMPT_MATRIX.kling.promptStyle,
      prompt: buildKlingPrompt(input, hasReferenceImage),
      rationale: VIDEO_PROVIDER_PROMPT_MATRIX.kling.bestFor,
    },
    seedance: {
      provider: 'seedance',
      promptStyle: VIDEO_PROVIDER_PROMPT_MATRIX.seedance.promptStyle,
      prompt: buildSeedancePrompt(input, hasReferenceImage),
      rationale: VIDEO_PROVIDER_PROMPT_MATRIX.seedance.bestFor,
    },
    ltx: {
      provider: 'ltx',
      promptStyle: VIDEO_PROVIDER_PROMPT_MATRIX.ltx.promptStyle,
      prompt: buildLtxPrompt(input, hasReferenceImage),
      rationale: VIDEO_PROVIDER_PROMPT_MATRIX.ltx.bestFor,
    },
    'sketch-local': {
      provider: 'sketch-local',
      promptStyle: VIDEO_PROVIDER_PROMPT_MATRIX['sketch-local'].promptStyle,
      prompt: buildSketchLocalPrompt(input),
      rationale: VIDEO_PROVIDER_PROMPT_MATRIX['sketch-local'].bestFor,
    },
  }
}

export function buildManualOverrideProviderPrompts(prompt: string): ProviderPromptMap {
  const normalized = normalizeText(prompt)
  return Object.fromEntries(
    VIDEO_PROMPT_PROVIDERS.map((provider) => [provider, {
      provider,
      promptStyle: 'manual_override',
      prompt: normalized,
      rationale: 'override manuel utilisateur',
    }]),
  ) as ProviderPromptMap
}

export function resolveProviderPrompt(
  providerPrompts: ProviderPromptMap | undefined,
  providerName: string,
  fallbackPrompt: string,
): string {
  const providerPrompt = providerPrompts?.[providerName as VideoPromptProvider]?.prompt
  return normalizeText(providerPrompt) || fallbackPrompt
}

export function buildVideoPromptSystemRules(): string {
  const globalRules = [
    'RÈGLES SYSTÈME GLOBALES :',
    '- le rendu visuel doit être conçu nativement pour un format TikTok vertical 9:16 ;',
    '- aucune scène ne doit finir sur un sujet isolé en fond studio, fond blanc, fond gris, fond noir ou fond seamless ;',
    '- impose toujours un vrai décor avec profondeur lisible : foreground, midground, background ;',
    '- une image de référence est une ancre d identité ou de style, pas un storyboard à recopier ;',
    '- n utilise jamais la référence comme ouverture obligatoire du clip ;',
    '- le rappel de la référence doit rester subtil, progressif et intégré naturellement à la scène ;',
    '- un clip court = un sujet héro, une action principale, un mouvement caméra principal ;',
    '- audio et dialogue restent secondaires : le visuel et le mouvement priment ;',
    '- pas de prose floue, pas de formules creuses type masterpiece, pas de contradictions ;',
  ]

  const providerRules = [
    'MATRICE PROVIDER -> STYLE DE PROMPT :',
    ...VIDEO_PROMPT_PROVIDERS.flatMap((provider) => {
      const profile = VIDEO_PROVIDER_PROMPT_MATRIX[provider]
      return [
        `- ${profile.displayName} (${provider}) -> ${profile.promptStyle} : ${profile.bestFor}.`,
        ...profile.systemRules.map((rule) => `  • ${rule}`),
      ]
    }),
  ]

  return [...globalRules, '', ...providerRules].join('\n')
}
