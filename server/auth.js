import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

function tokenSecret() {
  return process.env.SITE_TOKEN_SECRET || process.env.DATABASE_URL || ''
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

export async function passwordMatches(password, passwordHash) {
  if (!passwordHash) return false
  return bcrypt.compare(String(password || ''), passwordHash)
}

export function signToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })).toString(
    'base64url',
  )
  const sig = crypto.createHmac('sha256', tokenSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return false
  const [payload, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', tokenSecret()).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return Number(data.exp) > Date.now()
  } catch {
    return false
  }
}

export function readBearerToken(req) {
  const header = String(req.headers.authorization || '')
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}
