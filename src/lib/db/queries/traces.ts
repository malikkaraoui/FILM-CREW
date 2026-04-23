import { db } from '../connection'
import { agentTrace } from '../schema'
import { eq, desc } from 'drizzle-orm'

export async function createAgentTrace(data: {
  id: string
  runId: string
  agentName: string
  messageType: string
  content: unknown
}) {
  const [row] = await db.insert(agentTrace).values(data).returning()
  return row
}

export async function getAgentTraces(runId: string) {
  return db
    .select()
    .from(agentTrace)
    .where(eq(agentTrace.runId, runId))
    .orderBy(agentTrace.createdAt)
}

export async function getAgentTracesByAgent(runId: string, agentName: string) {
  return db
    .select()
    .from(agentTrace)
    .where(eq(agentTrace.runId, runId))
    .orderBy(agentTrace.createdAt)
    .then((rows) => rows.filter((r) => r.agentName === agentName))
}

export async function deleteAgentTraces(runId: string) {
  await db.delete(agentTrace).where(eq(agentTrace.runId, runId))
}
