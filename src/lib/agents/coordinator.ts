import { BaseAgent, type AgentSpeakOptions } from './base-agent'
import { AGENT_PROFILES, MEETING_ORDER } from './profiles'
import { createAgentTrace } from '@/lib/db/queries/traces'
import { updateRunCost } from '@/lib/db/queries/runs'
import { executeWithFailover } from '@/lib/providers/failover'
import type { LLMProvider } from '@/lib/providers/types'
import { logger } from '@/lib/logger'
import type { AgentMessage, AgentRole, MeetingBrief, MeetingSceneOutlineItem } from '@/types/agent'
import type { MeetingLlmMode } from '@/types/run'
import type { StyleTemplate } from '@/lib/templates/loader'

const MEETING_TRANSCRIPT_MAX_CHARS = 2000
const MEETING_LLM_TIMEOUT_MS = 180_000
const SCENE_OUTLINE_TRANSCRIPT_MAX_CHARS = 3500

function compactTranscriptForPrompt(transcript: string, maxChars = MEETING_TRANSCRIPT_MAX_CHARS): string {
  if (transcript.length <= maxChars) return transcript

  const headChars = Math.floor(maxChars * 0.4)
  const tailChars = maxChars - headChars
  const head = transcript.slice(0, headChars)
  const tail = transcript.slice(-tailChars)

  return `${head}\n\n[... transcript tronqué pour rester lisible et local-first ...]\n\n${tail}`
}

function extractJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fenced?.[1]?.trim() || trimmed
  const firstBrace = source.indexOf('{')
  const lastBrace = source.lastIndexOf('}')

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('Aucun objet JSON exploitable trouvé dans la synthèse scène par scène')
  }

  return JSON.parse(source.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function toText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && normalizeWhitespace(value) ? normalizeWhitespace(value) : fallback
}

function toDuration(value: unknown, fallback = 5): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.replace(/[^0-9]/g, ''), 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return fallback
}

function normalizeSceneOutline(value: unknown): MeetingSceneOutlineItem[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry, index) => {
      const raw = asRecord(entry)
      const sceneIndex = toDuration(raw.index, index + 1)
      return {
        index: sceneIndex,
        title: toText(raw.title, `Scène ${sceneIndex}`),
        description: toText(raw.description, toText(raw.title, `Scène ${sceneIndex}`)),
        dialogue: toText(raw.dialogue, ''),
        camera: toText(raw.camera, 'plan simple'),
        lighting: toText(raw.lighting, 'lumière naturelle'),
        duration_s: toDuration(raw.duration_s, 5),
        emotion: toText(raw.emotion) || undefined,
        narrativeRole: toText(raw.narrativeRole) || undefined,
      }
    })
    .filter((scene) => scene.description.length > 0)
    .sort((a, b) => a.index - b.index)
}

/**
 * Coordonne une réunion de production entre les 6 agents.
 *
 * Flow :
 * 1. Mia ouvre la réunion et présente le brief
 * 2. Tour de table : chaque agent donne son avis
 * 3. Discussion libre (2 rounds)
 * 4. Emilie vérifie la cohérence Brand Kit
 * 5. Chaque agent rédige sa section du brief
 * 6. Mia conclut avec le résumé exécutif
 */
export class MeetingCoordinator {
  private agents: Map<AgentRole, BaseAgent> = new Map()
  private messages: AgentMessage[] = []
  private runId: string
  private idea: string
  private brandKit: string | null
  private template: StyleTemplate | null
  private meetingLlmMode: MeetingLlmMode
  private meetingLlmModel: string | null
  private onMessage?: (message: AgentMessage) => void

  constructor(opts: {
    runId: string
    idea: string
    brandKit?: string | null
    template?: StyleTemplate | null
    meetingLlmMode?: MeetingLlmMode
    meetingLlmModel?: string | null
    onMessage?: (message: AgentMessage) => void
  }) {
    this.runId = opts.runId
    this.idea = opts.idea
    this.brandKit = opts.brandKit ?? null
    this.template = opts.template ?? null
    this.meetingLlmMode = opts.meetingLlmMode ?? 'local'
    this.meetingLlmModel = opts.meetingLlmModel?.trim() || null
    this.onMessage = opts.onMessage

    // Initialiser tous les agents
    for (const [role, profile] of Object.entries(AGENT_PROFILES)) {
      this.agents.set(role as AgentRole, new BaseAgent(profile))
    }
  }

  getMessages(): AgentMessage[] {
    return [...this.messages]
  }

  /**
   * Lance la réunion complète et retourne le brief final.
   */
  async runMeeting(): Promise<MeetingBrief> {
    logger.info({
      event: 'meeting_start',
      runId: this.runId,
      idea: this.idea,
      llmMode: this.meetingLlmMode,
      llmModel: this.meetingLlmModel,
    })

    let totalCost = 0

    // Contexte template injecté dans toute la réunion (10D)
    const templateContext = this.template
      ? `\n\nTemplate de style : ${this.template.name} — ${this.template.description}\nRythme : ${this.template.rhythm}\nTransitions : ${this.template.transitions.join(', ')}`
      : ''

    // Phase 1 : Mia ouvre la réunion
    const openingContext = `Nouvelle réunion de production. L'idée du client est : "${this.idea}".${this.brandKit ? `\n\nBrand Kit de la chaîne :\n${this.brandKit}` : ''}${templateContext}\n\nPrésente le brief à l'équipe et lance la discussion. Sois directe et motivante.`

    const opening = await this.agentSpeak('mia', openingContext)
    totalCost += opening.metadata?.costEur ?? 0

    // Phase 2 : Tour de table — chaque agent réagit
    for (const role of MEETING_ORDER.slice(1, -1)) {
      const transcript = this.getPromptTranscript()
      // Ton spécifique à cet agent selon le template (10D)
      const agentTone = this.template?.agentTones?.[role]
      const toneContext = agentTone ? `\n[Ton attendu dans ce style ${this.template!.name} : ${agentTone}]` : ''
      const context = `Voici la discussion jusqu'ici :\n\n${transcript}\n\nC'est ton tour de parler. Donne ton avis de ${AGENT_PROFILES[role].title} sur cette idée. Sois concis (3-5 phrases). Challenge les idées des autres si nécessaire.${toneContext}`

      const msg = await this.agentSpeak(role, context, {
        resetHistory: true,
        timeoutMs: MEETING_LLM_TIMEOUT_MS,
      })
      totalCost += msg.metadata?.costEur ?? 0
    }

    // Phase 3 : Discussion libre — 2 rounds
    for (let round = 0; round < 2; round++) {
      for (const role of ['lenny', 'laura', 'nael'] as AgentRole[]) {
        const transcript = this.getPromptTranscript()
        const context = `Discussion en cours (round ${round + 2}) :\n\n${transcript}\n\nRéagis aux dernières interventions. Affine, challenge ou complète. 2-3 phrases max.`

        const msg = await this.agentSpeak(role, context, {
          resetHistory: true,
          timeoutMs: MEETING_LLM_TIMEOUT_MS,
        })
        totalCost += msg.metadata?.costEur ?? 0
      }
    }

    // Phase 4 : Emilie vérifie la cohérence Brand Kit
    const brandCheckContext = `Voici toute la discussion :\n\n${this.getPromptTranscript()}\n\n${this.brandKit ? `Brand Kit :\n${this.brandKit}\n\n` : ''}Vérifie la cohérence de toutes les propositions avec le Brand Kit. Valide ce qui est conforme, rejette ce qui ne l'est pas en expliquant pourquoi et en proposant une correction.`

    const brandCheck = await this.agentSpeak('emilie', brandCheckContext, {
      resetHistory: true,
      timeoutMs: MEETING_LLM_TIMEOUT_MS,
    })
    brandCheck.messageType = 'validation'
    totalCost += brandCheck.metadata?.costEur ?? 0

    // Phase 5 : Chaque agent rédige sa section du brief
    const fullTranscript = this.formatTranscript()
    const transcript = compactTranscriptForPrompt(fullTranscript)
    logger.info({ event: 'meeting_transcript', runId: this.runId, fullLength: fullTranscript.length, truncatedLength: transcript.length })
    const briefSections: MeetingBrief['sections'] = []

    for (const role of ['lenny', 'laura', 'nael', 'emilie', 'nico'] as AgentRole[]) {
      const agent = this.agents.get(role)!
      const section = await agent.writeBriefSection(transcript, this.runId, {
        timeoutMs: MEETING_LLM_TIMEOUT_MS,
        model: this.meetingLlmModel ?? undefined,
      })
      await this.recordMessage(section)
      totalCost += section.metadata?.costEur ?? 0

      briefSections.push({
        agent: role,
        title: AGENT_PROFILES[role].briefSection,
        content: section.content,
      })
    }

    // Phase 6 : Mia conclut — utiliser le transcript tronqué
    const closingContext = `Voici la réunion et les sections du brief :\n\n${transcript}\n\nConclus la réunion. Produis :\n1. Un résumé exécutif (5-7 lignes)\n2. Une estimation budget (en postes de coûts)\n3. Ta validation finale\n\nSois directe et structurée.`

    const closing = await this.agentSpeak('mia', closingContext, {
      resetHistory: true,
      timeoutMs: MEETING_LLM_TIMEOUT_MS,
    })
    totalCost += closing.metadata?.costEur ?? 0

    let sceneOutline: MeetingSceneOutlineItem[] = []
    try {
      sceneOutline = await this.buildSceneOutline(fullTranscript, briefSections)
    } catch (error) {
      logger.warn({
        event: 'meeting_scene_outline_missing',
        runId: this.runId,
        error: (error as Error).message,
      })
    }

    // Mettre à jour le coût du run
    await updateRunCost(this.runId, totalCost).catch(() => {})

    logger.info({
      event: 'meeting_complete',
      runId: this.runId,
      messageCount: this.messages.length,
      totalCost,
    })

    return {
      runId: this.runId,
      idea: this.idea,
      sections: briefSections,
      summary: closing.content,
      sceneOutline,
      estimatedBudget: `~${totalCost.toFixed(2)} € (réunion)`,
      validatedBy: 'mia',
      createdAt: new Date().toISOString(),
    }
  }

  private async agentSpeak(
    role: AgentRole,
    context: string,
    opts: AgentSpeakOptions = {},
  ): Promise<AgentMessage> {
    const agent = this.agents.get(role)!
    const message = await agent.speak(context, this.runId, {
      ...opts,
      model: opts.model ?? this.meetingLlmModel ?? undefined,
    })
    await this.recordMessage(message)
    return message
  }

  private async recordMessage(message: AgentMessage): Promise<void> {
    this.messages.push(message)

    // Notifier en temps réel
    this.onMessage?.(message)

    // Persister dans agent_trace
    await createAgentTrace({
      id: message.id,
      runId: message.runId,
      agentName: message.agentName,
      messageType: message.messageType,
      content: {
        text: message.content,
        metadata: message.metadata,
      },
    }).catch(() => {})
  }

  private formatTranscript(): string {
    return this.messages
      .filter((m) => m.messageType === 'dialogue' || m.messageType === 'validation')
      .map((m) => {
        const profile = AGENT_PROFILES[m.agentName as AgentRole]
        const label = profile ? `${profile.displayName} (${profile.title})` : m.agentName
        return `[${label}] ${m.content}`
      })
      .join('\n\n')
  }

  private getPromptTranscript(maxChars = MEETING_TRANSCRIPT_MAX_CHARS): string {
    return compactTranscriptForPrompt(this.formatTranscript(), maxChars)
  }

  private async buildSceneOutline(
    transcript: string,
    sections: MeetingBrief['sections'],
  ): Promise<MeetingSceneOutlineItem[]> {
    const compactTranscript = compactTranscriptForPrompt(transcript, SCENE_OUTLINE_TRANSCRIPT_MAX_CHARS)
    const compactSections = sections.map((section) => ({
      agent: section.agent,
      title: section.title,
      content: section.content.slice(0, 700),
    }))

    const { result } = await executeWithFailover(
      'llm',
      async (provider) => {
        const llm = provider as LLMProvider
        return llm.chat(
          [
            {
              role: 'system',
              content: [
                'Tu transformes une reunion de production en sceneOutline canonique.',
                'Retourne uniquement un JSON valide, sans markdown ni texte autour.',
                'Schema attendu :',
                '{',
                '  "sceneOutline": [',
                '    {',
                '      "index": 1,',
                '      "title": "titre court",',
                '      "description": "ce qui doit etre montre dans la scene",',
                '      "dialogue": "dialogue ou narration si disponible",',
                '      "camera": "intention camera principale",',
                '      "lighting": "intention lumiere",',
                '      "duration_s": 5,',
                '      "emotion": "emotion dominante",',
                '      "narrativeRole": "role de la scene dans le recit"',
                '    }',
                '  ]',
                '}',
                'Règles :',
                '- reprends le découpage scène par scène décidé par la réunion, sans fusion ni compression arbitraire',
                '- si plusieurs scènes sont évoquées, conserve-les toutes dans l ordre',
                '- chaque scène doit rester dessinable et exploitable ensuite par la prod',
                '- camera et lighting doivent rester courts et concrets',
              ].join('\n'),
            },
            {
              role: 'user',
              content: [
                `Idée : ${this.idea}`,
                '',
                'Résumé et sections du brief :',
                JSON.stringify(compactSections, null, 2),
                '',
                'Transcript compacté de la réunion :',
                compactTranscript,
              ].join('\n'),
            },
          ],
          {
            model: this.meetingLlmModel ?? undefined,
            temperature: 0.2,
            maxTokens: 2200,
            timeoutMs: MEETING_LLM_TIMEOUT_MS,
          },
        )
      },
      this.runId,
    )

    const payload = extractJsonObject(result.content)
    const sceneOutline = normalizeSceneOutline(payload.sceneOutline)

    if (sceneOutline.length === 0) {
      throw new Error('sceneOutline vide après synthèse réunion')
    }

    return sceneOutline
  }
}
