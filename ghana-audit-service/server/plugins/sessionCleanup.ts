import { and, lt, or, isNotNull } from 'drizzle-orm'
import { getDatabase, schema } from '../database'

/**
 * Periodically prune admin_sessions: rows past their absolute cap, and
 * revoked rows older than the grace window. Idle-expired rows are left to
 * absolute expiry (cheap, and keeps them visible to a future audit query).
 * Mirrors the analyticsBuffer plugin's lifecycle wiring.
 */

const SWEEP_INTERVAL_MS = 60 * 60 * 1000 // hourly
const REVOKED_GRACE_MS = 24 * 60 * 60 * 1000 // keep revoked rows 24h
const FIRST_SWEEP_DELAY_MS = 30_000

let timer: NodeJS.Timeout | null = null

async function sweep(): Promise<void> {
  try {
    const db = getDatabase()
    const now = new Date()
    const revokedCutoff = new Date(now.getTime() - REVOKED_GRACE_MS)

    await db
      .delete(schema.adminSessions)
      .where(
        or(
          lt(schema.adminSessions.absoluteExpiresAt, now),
          and(
            isNotNull(schema.adminSessions.revokedAt),
            lt(schema.adminSessions.revokedAt, revokedCutoff)
          )
        )
      )
  } catch (err) {
    console.warn('[sessionCleanup] sweep failed:', (err as Error).message)
  }
}

export default defineNitroPlugin((nitroApp) => {
  const first = setTimeout(() => void sweep(), FIRST_SWEEP_DELAY_MS)
  first.unref?.()

  timer = setInterval(() => void sweep(), SWEEP_INTERVAL_MS)
  timer.unref?.()

  nitroApp.hooks.hook('close', () => {
    clearTimeout(first)
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  })
})
