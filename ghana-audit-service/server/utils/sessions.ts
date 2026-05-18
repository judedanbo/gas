import { randomBytes } from 'node:crypto'
import { and, eq, isNull, ne, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { getSessionConfig } from './duration'

/**
 * Server-side admin session store. The JWT carries only an opaque session
 * id (`sid`); this module is the source of truth for whether that session
 * is still alive (not revoked, within the absolute cap, not idle-expired)
 * and slides the idle window as the user stays active.
 */

/** Don't write last_activity_at on every request — only if it moved this far. */
const ACTIVITY_WRITE_THROTTLE_MS = 30_000

export type SessionInvalidReason = 'invalid' | 'revoked' | 'idle' | 'absolute'

export interface SessionTiming {
  createdAt: string
  lastActivityAt: string
  idleExpiresAt: string
  absoluteExpiresAt: string
  /** Soonest of idle/absolute expiry — what the client counts down to. */
  expiresAt: string
  /** Lead time (ms) before `expiresAt` to show the warning modal. */
  warningBeforeMs: number
}

interface SessionRow {
  createdAt: Date
  lastActivityAt: Date
  absoluteExpiresAt: Date
  revokedAt: Date | null
}

export interface SessionEvaluation {
  ok: boolean
  reason?: SessionInvalidReason
  timing?: SessionTiming
}

/**
 * Pure session-state evaluation. Kept side-effect free so it can be unit
 * tested without a database.
 */
export function evaluateSession(
  row: SessionRow,
  nowMs: number,
  idleTimeoutMs: number,
  warningBeforeMs: number
): SessionEvaluation {
  if (row.revokedAt) return { ok: false, reason: 'revoked' }
  if (nowMs >= row.absoluteExpiresAt.getTime()) return { ok: false, reason: 'absolute' }

  const idleExpiryMs = row.lastActivityAt.getTime() + idleTimeoutMs
  if (nowMs >= idleExpiryMs) return { ok: false, reason: 'idle' }

  const idleExpiresAt = new Date(idleExpiryMs)
  const absoluteExpiresAt = row.absoluteExpiresAt
  const soonest = idleExpiresAt < absoluteExpiresAt ? idleExpiresAt : absoluteExpiresAt

  return {
    ok: true,
    timing: {
      createdAt: row.createdAt.toISOString(),
      lastActivityAt: row.lastActivityAt.toISOString(),
      idleExpiresAt: idleExpiresAt.toISOString(),
      absoluteExpiresAt: absoluteExpiresAt.toISOString(),
      expiresAt: soonest.toISOString(),
      warningBeforeMs
    }
  }
}

export function generateSessionId(): string {
  return randomBytes(32).toString('hex')
}

const SESSION_COLUMNS = {
  userId: schema.adminSessions.userId,
  createdAt: schema.adminSessions.createdAt,
  lastActivityAt: schema.adminSessions.lastActivityAt,
  absoluteExpiresAt: schema.adminSessions.absoluteExpiresAt,
  revokedAt: schema.adminSessions.revokedAt
}

export async function createSession(opts: {
  userId: number
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<{ sessionId: string; timing: SessionTiming; absoluteExpiresAt: Date }> {
  const { absoluteTimeoutMs, idleTimeoutMs, warningBeforeMs } = getSessionConfig()
  const db = getDatabase()
  const sessionId = generateSessionId()
  const now = new Date()
  const absoluteExpiresAt = new Date(now.getTime() + absoluteTimeoutMs)

  await db.insert(schema.adminSessions).values({
    sessionId,
    userId: opts.userId,
    createdAt: now,
    lastActivityAt: now,
    absoluteExpiresAt,
    ipAddress: opts.ipAddress ?? null,
    userAgent: opts.userAgent ? opts.userAgent.slice(0, 500) : null
  })

  const evaluation = evaluateSession(
    { createdAt: now, lastActivityAt: now, absoluteExpiresAt, revokedAt: null },
    now.getTime(),
    idleTimeoutMs,
    warningBeforeMs
  )

  return { sessionId, absoluteExpiresAt, timing: evaluation.timing! }
}

export interface ValidateResult {
  ok: boolean
  reason?: SessionInvalidReason
  userId?: number
  timing?: SessionTiming
}

async function loadSession(sessionId: string) {
  const db = getDatabase()
  const [row] = await db
    .select(SESSION_COLUMNS)
    .from(schema.adminSessions)
    .where(eq(schema.adminSessions.sessionId, sessionId))
    .limit(1)
  return row
}

/**
 * Validate a session. When `touch` is set, slides last_activity_at forward
 * (throttled) so ongoing activity keeps the session alive. When `force` is
 * set, always writes last_activity_at (used by the explicit refresh endpoint).
 */
export async function validateSession(
  sessionId: string,
  opts: { touch?: boolean; force?: boolean } = {}
): Promise<ValidateResult> {
  const { idleTimeoutMs, warningBeforeMs } = getSessionConfig()
  const row = await loadSession(sessionId)
  if (!row) return { ok: false, reason: 'invalid' }

  const nowMs = Date.now()
  const evaluation = evaluateSession(row, nowMs, idleTimeoutMs, warningBeforeMs)
  if (!evaluation.ok) return { ok: false, reason: evaluation.reason }

  const shouldWrite =
    opts.force || (opts.touch && nowMs - row.lastActivityAt.getTime() > ACTIVITY_WRITE_THROTTLE_MS)

  if (shouldWrite) {
    const lastActivityAt = new Date(nowMs)
    await getDatabase()
      .update(schema.adminSessions)
      .set({ lastActivityAt })
      .where(eq(schema.adminSessions.sessionId, sessionId))

    const refreshed = evaluateSession(
      { ...row, lastActivityAt },
      nowMs,
      idleTimeoutMs,
      warningBeforeMs
    )
    return { ok: true, userId: row.userId, timing: refreshed.timing }
  }

  return { ok: true, userId: row.userId, timing: evaluation.timing }
}

export async function revokeSession(sessionId: string): Promise<void> {
  await getDatabase()
    .update(schema.adminSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(schema.adminSessions.sessionId, sessionId), isNull(schema.adminSessions.revokedAt))
    )
}

export async function revokeAllForUser(userId: number, exceptSessionId?: string): Promise<void> {
  await getDatabase()
    .update(schema.adminSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.adminSessions.userId, userId),
        isNull(schema.adminSessions.revokedAt),
        exceptSessionId ? ne(schema.adminSessions.sessionId, exceptSessionId) : undefined
      )
    )
}

/**
 * Revoke one session by its numeric id, scoped to the owning user so an
 * admin can only terminate their own sessions. Returns true if a live
 * session was revoked.
 */
export async function revokeSessionById(userId: number, id: number): Promise<boolean> {
  const [result] = await getDatabase()
    .update(schema.adminSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.adminSessions.id, id),
        eq(schema.adminSessions.userId, userId),
        isNull(schema.adminSessions.revokedAt)
      )
    )
  return (result as { affectedRows?: number }).affectedRows ? true : false
}

export interface AdminSessionInfo {
  id: number
  current: boolean
  createdAt: string
  lastActivityAt: string
  absoluteExpiresAt: string
  ipAddress: string | null
  userAgent: string | null
}

/** Active (non-revoked, non-expired) sessions for a user, newest activity first. */
export async function listSessions(
  userId: number,
  currentSessionId: string
): Promise<AdminSessionInfo[]> {
  const { idleTimeoutMs } = getSessionConfig()
  const rows = await getDatabase()
    .select({
      id: schema.adminSessions.id,
      sessionId: schema.adminSessions.sessionId,
      createdAt: schema.adminSessions.createdAt,
      lastActivityAt: schema.adminSessions.lastActivityAt,
      absoluteExpiresAt: schema.adminSessions.absoluteExpiresAt,
      ipAddress: schema.adminSessions.ipAddress,
      userAgent: schema.adminSessions.userAgent
    })
    .from(schema.adminSessions)
    .where(and(eq(schema.adminSessions.userId, userId), isNull(schema.adminSessions.revokedAt)))
    .orderBy(desc(schema.adminSessions.lastActivityAt))

  const nowMs = Date.now()
  return rows
    .filter(
      (r) =>
        nowMs < r.absoluteExpiresAt.getTime() && nowMs < r.lastActivityAt.getTime() + idleTimeoutMs
    )
    .map((r) => ({
      id: r.id,
      current: r.sessionId === currentSessionId,
      createdAt: r.createdAt.toISOString(),
      lastActivityAt: r.lastActivityAt.toISOString(),
      absoluteExpiresAt: r.absoluteExpiresAt.toISOString(),
      ipAddress: r.ipAddress,
      userAgent: r.userAgent
    }))
}
