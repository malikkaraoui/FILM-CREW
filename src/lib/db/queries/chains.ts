import { db } from '../connection'
import { chain, publicationAccount } from '../schema'
import { eq, isNull, isNotNull, lt } from 'drizzle-orm'

type GetChainsOptions = {
  archivedOnly?: boolean
  includeArchived?: boolean
}

export async function getChains(options: GetChainsOptions = {}) {
  if (options.archivedOnly) {
    return db.select().from(chain).where(isNotNull(chain.archivedAt)).orderBy(chain.createdAt)
  }
  if (options.includeArchived) {
    return db.select().from(chain).orderBy(chain.createdAt)
  }
  return db.select().from(chain).where(isNull(chain.archivedAt)).orderBy(chain.createdAt)
}

export async function getChainById(id: string | null | undefined) {
  if (!id) return null
  const rows = await db.select().from(chain).where(eq(chain.id, id))
  return rows[0] ?? null
}

export async function createChain(data: {
  id: string
  name: string
  langSource: string
  audience?: string
}) {
  const [row] = await db.insert(chain).values(data).returning()
  return row
}

export async function updateChain(id: string, data: Partial<{
  name: string
  langSource: string
  audience: string
  brandKitPath: string
}>) {
  const [row] = await db
    .update(chain)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(chain.id, id))
    .returning()
  return row
}

export async function archiveChain(id: string) {
  const now = new Date()
  const [row] = await db
    .update(chain)
    .set({ archivedAt: now, updatedAt: now })
    .where(eq(chain.id, id))
    .returning()
  return row
}

export async function restoreChain(id: string) {
  const [row] = await db
    .update(chain)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(chain.id, id))
    .returning()
  return row
}

export async function getChainsArchivedBefore(date: Date) {
  return db.select().from(chain).where(lt(chain.archivedAt, date))
}

export async function deleteChain(id: string) {
  await db.delete(chain).where(eq(chain.id, id))
}

export async function duplicateChain(sourceId: string, newId: string, newName: string) {
  const source = await getChainById(sourceId)
  if (!source) return null
  const [row] = await db.insert(chain).values({
    id: newId,
    name: newName,
    langSource: source.langSource,
    audience: source.audience,
  }).returning()
  return row
}

// Publication accounts

export async function getPublicationAccounts(chainId: string | null | undefined) {
  if (!chainId) return []
  return db.select().from(publicationAccount).where(eq(publicationAccount.chainId, chainId))
}

export async function createPublicationAccount(data: {
  id: string
  chainId: string
  platform: string
  credentials?: unknown
}) {
  const [row] = await db.insert(publicationAccount).values(data).returning()
  return row
}

export async function deletePublicationAccount(id: string) {
  await db.delete(publicationAccount).where(eq(publicationAccount.id, id))
}
