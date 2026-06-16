import jwt, { type SignOptions } from 'jsonwebtoken'

/**
 * Short-lived ticket for authenticating an EventSource (SSE) connection.
 *
 * EventSource cannot set request headers, so SSE routes would otherwise need
 * the full admin session JWT (≈8h) in the query string — a long-lived credential
 * that leaks via logs/proxies/history. Instead the admin mints a ~2 minute,
 * `aud`-scoped ticket (after the normal Bearer auth has passed) and passes that
 * in the URL. The distinct `aud` means the ticket can't be used as a normal
 * admin Bearer token, and a normal session JWT can't be used as a ticket.
 *
 * Unlike the single-use pdfToken, this ticket is *reusable within its TTL* so
 * native EventSource auto-reconnects keep working; exposure is bounded by the
 * short lifetime rather than single use.
 */

const SSE_TICKET_AUDIENCE = 'sse-stream'
const SSE_TICKET_TTL_SECONDS = 120

export interface SseTicketPayload {
  userId: number
  /** Opaque server-side session id (maps to admin_sessions.session_id). */
  sid: string
  aud: typeof SSE_TICKET_AUDIENCE
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

export function signSseTicket(opts: { userId: number; sid: string }): string {
  const payload: Omit<SseTicketPayload, 'iat' | 'exp'> = {
    userId: opts.userId,
    sid: opts.sid,
    aud: SSE_TICKET_AUDIENCE
  }
  const signOpts: SignOptions = { expiresIn: SSE_TICKET_TTL_SECONDS, algorithm: 'HS256' }
  return jwt.sign(payload as object, getJWTSecret(), signOpts)
}

/** Verify a ticket. Returns `{ userId, sid }` or null when invalid/expired/wrong-aud. */
export function verifySseTicket(token: string): { userId: number; sid: string } | null {
  let decoded: SseTicketPayload
  try {
    decoded = jwt.verify(token, getJWTSecret(), { algorithms: ['HS256'] }) as SseTicketPayload
  } catch {
    return null
  }
  if (decoded.aud !== SSE_TICKET_AUDIENCE) return null
  if (typeof decoded.userId !== 'number' || !decoded.sid) return null
  return { userId: decoded.userId, sid: decoded.sid }
}
