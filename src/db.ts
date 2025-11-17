import 'dotenv/config'
import { Pool } from 'pg'
import caText from './ca.pem' with { type: 'text' }

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in server/.env')
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: true,
    ca: caText,
  },
})

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  // ... (el resto de tu función query sigue igual)
  const client = await pool.connect()
  try {
    const res = await client.query(text, params)
    return { rows: res.rows as T[] }
  } finally {
    client.release()
  }
}