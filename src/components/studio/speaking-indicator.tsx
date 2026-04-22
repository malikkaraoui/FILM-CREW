'use client'

import type { AgentRole } from '@/types/agent'

const AGENT_COLORS: Record<string, string> = {
  mia: 'bg-violet-400',
  lenny: 'bg-blue-400',
  laura: 'bg-green-400',
  nael: 'bg-red-400',
  emilie: 'bg-amber-400',
  nico: 'bg-cyan-400',
}

const AGENT_BORDER: Record<string, string> = {
  mia: 'border-violet-200 dark:border-violet-800',
  lenny: 'border-blue-200 dark:border-blue-800',
  laura: 'border-green-200 dark:border-green-800',
  nael: 'border-red-200 dark:border-red-800',
  emilie: 'border-amber-200 dark:border-amber-800',
  nico: 'border-cyan-200 dark:border-cyan-800',
}

const AGENT_BG: Record<string, string> = {
  mia: 'bg-violet-50 dark:bg-violet-950/30',
  lenny: 'bg-blue-50 dark:bg-blue-950/30',
  laura: 'bg-green-50 dark:bg-green-950/30',
  nael: 'bg-red-50 dark:bg-red-950/30',
  emilie: 'bg-amber-50 dark:bg-amber-950/30',
  nico: 'bg-cyan-50 dark:bg-cyan-950/30',
}

export function SpeakingIndicator({
  agent,
  label,
  phase,
}: {
  agent: AgentRole
  label: string
  phase: string
}) {
  const dotColor = AGENT_COLORS[agent] ?? 'bg-gray-400'
  const border = AGENT_BORDER[agent] ?? 'border-gray-200'
  const bg = AGENT_BG[agent] ?? 'bg-gray-50'

  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${border} ${bg}`}>
      <div className="flex items-center gap-1.5">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor} animate-pulse`} />
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor} animate-pulse`} style={{ animationDelay: '0.2s' }} />
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor} animate-pulse`} style={{ animationDelay: '0.4s' }} />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label} réfléchit…</span>
        <span className="text-[10px] text-muted-foreground">{phase}</span>
      </div>
    </div>
  )
}
