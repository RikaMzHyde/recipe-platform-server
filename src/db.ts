import 'dotenv/config'
import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

let caText: string;

if (process.env.NODE_ENV === 'production') {
  // En producción, usa el import dinámico que funcionará en el entorno de despliegue
  const caModule = await import('./ca.pem', { with: { type: 'text' } });
  caText = caModule.default;
} else {
  // En desarrollo, lee el archivo directamente
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  caText = fs.readFileSync(path.join(__dirname, 'ca.pem'), 'utf-8');
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in server/.env')
}

const pool = new Pool({
  connectionString,
  ssl: {
    // En producción (Aiven/Render), no verifiques el certificado autofirmado.
    // En local, sí, para mayor seguridad.
    rejectUnauthorized: process.env.NODE_ENV !== 'production',
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
