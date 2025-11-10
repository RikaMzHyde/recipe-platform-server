import 'dotenv/config'
import fs from 'fs'
import { Pool } from 'pg'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in server/.env')
}

const caPath = join(__dirname, 'ca.pem')

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(caPath).toString(),
  },
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