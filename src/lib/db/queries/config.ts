import { db } from '../connection'
import { config } from '../schema'
import { eq } from 'drizzle-orm'

export async function getConfig(key: string): Promise<string | null> {
  const rows = await db.select().from(config).where(eq(config.key, key))
  return rows[0]?.value ?? null
}

export async function setConfig(key: string, value: string) {
  const existing = await getConfig(key)
  if (existing !== null) {
    await db.update(config).set({ value, updatedAt: new Date() }).where(eq(config.key, key))
  } else {
    await db.insert(config).values({ key, value })
  }
}

export async function getAllConfig() {
  return db.select().from(config)
}
