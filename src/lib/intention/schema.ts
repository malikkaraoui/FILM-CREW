/**
 * Schéma du questionnaire adaptatif 6 blocs — Lot 10B
 *
 * 6 blocs : Production / Narration / Mise en scène / Image / Son / Montage
 * Max 15 questions, logique conditionnelle simple (showIf).
 */

export type QuestionOption = {
  value: string
  label: string
}

export type Question = {
  id: string
  label: string
  options: QuestionOption[]
  /** Cette question n'apparaît que si la réponse à `questionId` est `value` */
  showIf?: { questionId: string; value: string }
}

export type Bloc = {
  id: string
  label: string
  description: string
  questions: Question[]
}

export const INTENTION_BLOCS: Bloc[] = [
  {
    id: 'production',
    label: 'Production',
    description: 'Format général et audience',
    questions: [
      {
        id: 'genre',
        label: 'Genre du contenu',
        options: [
          { value: 'educatif', label: 'Éducatif' },
          { value: 'divertissement', label: 'Divertissement' },
          { value: 'documentaire', label: 'Documentaire' },
          { value: 'fiction', label: 'Fiction' },
          { value: 'publicitaire', label: 'Publicitaire' },
        ],
      },
      {
        id: 'duree',
        label: 'Durée cible',
        options: [
          { value: 'moins30s', label: '< 30 secondes' },
          { value: '30a60s', label: '30 – 60 secondes' },
          { value: '1a3min', label: '1 – 3 minutes' },
          { value: '3a5min', label: '3 – 5 minutes' },
        ],
      },
      {
        id: 'audience',
        label: 'Audience principale',
        options: [
          { value: 'grand_public', label: 'Grand public' },
          { value: 'ados', label: 'Adolescents' },
          { value: 'professionnels', label: 'Professionnels' },
          { value: 'enfants', label: 'Enfants' },
          { value: 'niche', label: 'Communauté niche' },
        ],
      },
    ],
  },
  {
    id: 'narration',
    label: 'Narration',
    description: 'Ton, structure et voix',
    questions: [
      {
        id: 'ton',
        label: 'Ton narratif',
        options: [
          { value: 'serieux', label: 'Sérieux' },
          { value: 'humoristique', label: 'Humoristique' },
          { value: 'poetique', label: 'Poétique' },
          { value: 'dramatique', label: 'Dramatique' },
          { value: 'pedagogique', label: 'Pédagogique' },
        ],
      },
      {
        id: 'structure',
        label: 'Structure narrative',
        options: [
          { value: 'lineaire', label: 'Linéaire' },
          { value: 'revelation', label: 'Révélation finale' },
          { value: 'boucle', label: 'En boucle' },
          { value: 'fragments', label: 'Fragments / montage parallèle' },
        ],
      },
      {
        id: 'voixoff',
        label: 'Voix-off',
        options: [
          { value: 'oui', label: 'Oui' },
          { value: 'non', label: 'Non' },
        ],
      },
      {
        id: 'style_voix',
        label: 'Style de la voix',
        options: [
          { value: 'neutre', label: 'Neutre et claire' },
          { value: 'chaleureuse', label: 'Chaleureuse' },
          { value: 'autoritaire', label: 'Autoritaire' },
          { value: 'enthousiaste', label: 'Enthousiaste' },
        ],
        showIf: { questionId: 'voixoff', value: 'oui' },
      },
    ],
  },
  {
    id: 'mise_en_scene',
    label: 'Mise en scène',
    description: 'Style visuel et rythme',
    questions: [
      {
        id: 'style_visuel',
        label: 'Style visuel',
        options: [
          { value: 'cinematographique', label: 'Cinématographique' },
          { value: 'documentaire', label: 'Documentaire' },
          { value: 'anime', label: 'Animé / illustré' },
          { value: 'minimaliste', label: 'Minimaliste' },
          { value: 'dynamique', label: 'Dynamique / énergie brute' },
        ],
      },
      {
        id: 'rythme',
        label: 'Rythme général',
        options: [
          { value: 'lent', label: 'Lent et contemplatif' },
          { value: 'modere', label: 'Modéré' },
          { value: 'rapide', label: 'Rapide et énergique' },
        ],
      },
    ],
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Couleurs et format',
    questions: [
      {
        id: 'palette',
        label: 'Palette de couleurs',
        options: [
          { value: 'naturelle', label: 'Naturelle / réaliste' },
          { value: 'chaude', label: 'Chaude (oranges, rouges)' },
          { value: 'froide', label: 'Froide (bleus, verts)' },
          { value: 'desaturee', label: 'Désaturée / monochrome' },
          { value: 'vive', label: 'Vive / saturée' },
        ],
      },
      {
        id: 'format',
        label: 'Format de diffusion',
        options: [
          { value: 'vertical', label: '9:16 vertical (TikTok, Reels)' },
          { value: 'horizontal', label: '16:9 horizontal (YouTube)' },
          { value: 'carre', label: '1:1 carré (Instagram)' },
        ],
      },
    ],
  },
  {
    id: 'son',
    label: 'Son',
    description: 'Musique et ambiance',
    questions: [
      {
        id: 'musique',
        label: 'Place de la musique',
        options: [
          { value: 'absente', label: 'Absente' },
          { value: 'discrete', label: 'Discrète en fond' },
          { value: 'presente', label: 'Présente et rythmante' },
          { value: 'dominante', label: 'Dominante / centrale' },
        ],
      },
      {
        id: 'ambiance',
        label: 'Ambiance sonore',
        options: [
          { value: 'naturelle', label: 'Sons naturels / réalistes' },
          { value: 'electronique', label: 'Électronique / synthétique' },
          { value: 'orchestrale', label: 'Orchestrale' },
          { value: 'silence', label: 'Silence (voix seule)' },
        ],
      },
    ],
  },
  {
    id: 'montage',
    label: 'Montage',
    description: 'Cuts et transitions',
    questions: [
      {
        id: 'vitesse_coupe',
        label: 'Vitesse de coupe',
        options: [
          { value: 'lente', label: 'Lente (plans longs)' },
          { value: 'standard', label: 'Standard' },
          { value: 'rapide', label: 'Rapide (clips courts)' },
        ],
      },
      {
        id: 'transitions',
        label: 'Style de transitions',
        options: [
          { value: 'coupes_franches', label: 'Coupes franches' },
          { value: 'fondu', label: 'Fondus enchaînés' },
          { value: 'zoom', label: 'Zooms / dé-zooms' },
          { value: 'wipe', label: 'Wipes / glissements' },
        ],
      },
    ],
  },
]

/** Toutes les questions à plat (hors conditionnelles masquées) */
export function getVisibleQuestions(answers: Record<string, string>): Question[] {
  return INTENTION_BLOCS.flatMap((bloc) =>
    bloc.questions.filter((q) => {
      if (!q.showIf) return true
      return answers[q.showIf.questionId] === q.showIf.value
    }),
  )
}

/** Compte total des questions pour un jeu de réponses donné */
export function countVisibleQuestions(answers: Record<string, string>): number {
  return getVisibleQuestions(answers).length
}

/** Convertit les réponses en phrase d'intention injectée dans ctx.idea */
export function buildIntentionPrefix(answers: Record<string, string>): string {
  const visibleIds = new Set(getVisibleQuestions(answers).map((q) => q.id))
  const parts: string[] = []

  for (const bloc of INTENTION_BLOCS) {
    const blocParts: string[] = []
    for (const question of bloc.questions) {
      if (!visibleIds.has(question.id)) continue
      const answer = answers[question.id]
      if (!answer) continue
      const option = question.options.find((o) => o.value === answer)
      if (option) blocParts.push(`${question.label}: ${option.label}`)
    }
    if (blocParts.length > 0) {
      parts.push(`[${bloc.label}] ${blocParts.join(' | ')}`)
    }
  }

  return parts.length > 0 ? parts.join('\n') : ''
}

export type IntentionAnswers = Record<string, string>
