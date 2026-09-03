import pg from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const { Pool } = pg

const connectionString = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL).toString().replace(/[?&]sslmode=[^&]*/g, '')
  : ''

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

export async function query(text, params) {
  return pool.query(text, params)
}
