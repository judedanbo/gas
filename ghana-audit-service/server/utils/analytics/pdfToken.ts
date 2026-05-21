import { randomBytes } from 'node:crypto'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { getRedis } from '../redis'

/**
 * Short-lived, single-use token for authenticating a headless Puppeteer
 * tab to the unified analytics report page. The PDF endpoint mints one
 * after admin auth has already passed; the report page exchanges it for a
 * normal session JWT via /api/admin/auth/exchange-pdf-token.
 *
 * Distinct `aud: 'pdf-report'` claim prevents replay against the regular
 * admin auth gate. A jti nonce stored in Redis (with in-process fallback)
 * makes the token single-use.
 */

const PDF_TOKEN_AUDIENCE = 'pdf-report'
const PDF_TOKEN_TTL_SECONDS = 60
const REDIS_KEY_PREFIX = 'pdf-token:'

export type PdfWindow = '24h' | '7d' | '30d'

export interface PdfTokenPayload {
  userId: number
  sid: string
  window: PdfWindow
  jti: string
  aud: typeof PDF_TOKEN_AUDIENCE
  iat?: number
  exp?: number
}

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return secret
}

// In-process fallback used only when Redis isn't configured (local dev /
// tests). The map holds the absolute expiry millisecond timestamp.
const memoryStore = new Map<string, number>()

function memoryStoreSweep(): void {
  const now = Date.now()
  for (const [k, exp] of memoryStore) {
    if (exp <= now) memoryStore.delete(k)
  }
}

async function rememberJti(jti: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.set(REDIS_KEY_PREFIX + jti, '1', 'EX', PDF_TOKEN_TTL_SECONDS)
    return
  }
  memoryStoreSweep()
  memoryStore.set(jti, Date.now() + PDF_TOKEN_TTL_SECONDS * 1000)
}

/** Atomically consume the jti. Returns true iff the nonce was live and we won the race. */
async function consumeJti(jti: string): Promise<boolean> {
  const redis = getRedis()
  if (redis) {
    const deleted = await redis.del(REDIS_KEY_PREFIX + jti)
    return deleted > 0
  }
  memoryStoreSweep()
  const exp = memoryStore.get(jti)
  if (exp === undefined || exp <= Date.now()) return false
  memoryStore.delete(jti)
  return true
}

export async function signPdfToken(opts: {
  userId: number
  sid: string
  window: PdfWindow
}): Promise<{ token: string; jti: string }> {
  const jti = randomBytes(16).toString('hex')
  const payload: Omit<PdfTokenPayload, 'iat' | 'exp'> = {
    userId: opts.userId,
    sid: opts.sid,
    window: opts.window,
    jti,
    aud: PDF_TOKEN_AUDIENCE
  }
  const signOpts: SignOptions = { expiresIn: PDF_TOKEN_TTL_SECONDS }
  const token = jwt.sign(payload as object, getJWTSecret(), signOpts)
  await rememberJti(jti)
  return { token, jti }
}

export async function verifyAndConsumePdfToken(token: string): Promise<PdfTokenPayload | null> {
  let decoded: PdfTokenPayload
  try {
    decoded = jwt.verify(token, getJWTSecret()) as PdfTokenPayload
  } catch {
    return null
  }
  if (decoded.aud !== PDF_TOKEN_AUDIENCE) return null
  if (!decoded.jti) return null

  const ok = await consumeJti(decoded.jti)
  if (!ok) return null
  return decoded
}

/** Test helper: drop the in-process jti store between cases. */
export function __resetPdfTokenStoreForTests(): void {
  memoryStore.clear()
}
