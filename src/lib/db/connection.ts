import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://malik@localhost:5432/video_tiktok',
})

export const db = drizzle(pool, { schema })
