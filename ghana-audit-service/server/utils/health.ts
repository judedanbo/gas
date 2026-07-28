import { checkConnection } from '../database'
import { getRedis } from './redis'

/**
 * Health report consumed by /api/health — the probe target for external
 * uptime monitoring (.github/workflows/uptime.yml) and any future in-cluster
 * checks. Semantics:
 *
 * - `ok`        — site + database healthy (Redis up or intentionally absent)
 * - `degraded`  — site serving, but a configured Redis is unreachable.
 *                 Rate limiting / analytics fall back per-instance; not an
 *                 outage, so the endpoint still returns HTTP 200.
 * - `error`     — database unreachable. The endpoint returns HTTP 503 so
 *                 dumb HTTP monitors (status-code-only) flag it as down.
 */
export interface HealthReport {
  status: 'ok' | 'degraded' | 'error'
  timestamp: string
  checks: {
    database: 'up' | 'down'
    redis: 'up' | 'down' | 'not_configured'
  }
}

// Bounded so a wedged pool/socket can't hang the probe past the monitor's
// own request timeout — a hung check must surface as "down", not silence.
const DB_CHECK_TIMEOUT_MS = 5000
const REDIS_CHECK_TIMEOUT_MS = 2000

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch(() => {
        clearTimeout(timer)
        resolve(fallback)
      })
  })
}

export async function buildHealthReport(): Promise<HealthReport> {
  const dbUp = await withTimeout(checkConnection(), DB_CHECK_TIMEOUT_MS, false)

  const redis = getRedis()
  let redisStatus: HealthReport['checks']['redis'] = 'not_configured'
  if (redis) {
    redisStatus = await withTimeout(
      redis.ping().then(() => 'up' as const),
      REDIS_CHECK_TIMEOUT_MS,
      'down'
    )
  }

  const status: HealthReport['status'] = !dbUp
    ? 'error'
    : redisStatus === 'down'
      ? 'degraded'
      : 'ok'

  return {
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbUp ? 'up' : 'down',
      redis: redisStatus
    }
  }
}
