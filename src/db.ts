import 'dotenv/config'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in server/.env')
}

export const pool = new Pool({
  connectionString,
  // En local no necesitamos SSL; si necesitas SSL en cloud, establece PGSSL=true
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
})

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  const client = await pool.connect()
  try {
    const res = await client.query(text, params)
    return { rows: res.rows as T[] }
  } finally {
    client.release()
  }
}
