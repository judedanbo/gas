import { readFileSync } from 'node:fs'
import { Redis, type RedisOptions } from 'ioredis'

/**
 * Singleton Redis client for shared rate-limit state and (in later phases)
 * analytics hot counters. Configured via the REDIS_URL env var.
 *
 * If REDIS_URL is unset, getRedis() returns null and callers fall back to
 * an in-process backend. This keeps local dev / unit tests / CI green
 * without a live Redis, and keeps the site up if Redis goes away in prod
 * (the rate limiter degrades to per-instance counters with a warn log).
 *
 * TLS: when REDIS_URL is a `rediss://` URL (k8s), the client verifies the
 * server against the CA at REDIS_CA_FILE. Everything here degrades gracefully —
 * a missing/unreadable CA only warns (never throws), and any TLS/connection
 * failure is handled by the callers' in-process fallback. So the app keeps
 * serving even when TLS is misconfigured.
 */

let client: Redis | null = null
let initialised = false
let warnedConnect = false

/**
 * Build TLS options from the environment, or undefined for a non-TLS client.
 * Never throws: a missing/unreadable CA file logs a warning and returns
 * undefined so Redis init stays graceful.
 */
export function redisTlsOptions(): RedisOptions['tls'] | undefined {
  const caFile = process.env.REDIS_CA_FILE?.trim()
  // Escape hatch: keep encryption but skip server-identity verification if a
  // cert chain misbehaves (default is to verify).
  const rejectUnauthorized = process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false'

  if (!caFile) {
    // No CA configured. Only override verification if explicitly disabled;
    // otherwise let ioredis derive TLS from a rediss:// URL with defaults.
    return rejectUnauthorized ? undefined : { rejectUnauthorized: false }
  }

  try {
    return { ca: readFileSync(caFile), rejectUnauthorized }
  } catch (err) {
    console.warn('[redis] failed to read REDIS_CA_FILE; proceeding without it:', (err as Error).message)
    return rejectUnauthorized ? undefined : { rejectUnauthorized: false }
  }
}

function buildClient(url: string): Redis {
  const opts: RedisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    enableReadyCheck: true,
    reconnectOnError(err) {
      // Reconnect on transient READONLY errors (replica failover) but never
      // tight-loop on auth or wrong-host failures.
      return /READONLY/i.test(err.message)
    },
    retryStrategy(times) {
      // Exponential back-off capped at 10 s. Returning null disables retries.
      return Math.min(times * 200, 10_000)
    }
  }
  const tls = redisTlsOptions()
  if (tls) opts.tls = tls
  return new Redis(url, opts)
}

/**
 * Get the shared Redis client, or null if Redis is not configured.
 * Lazily connects on first call. A connection error is logged once and
 * the client is left in place — ioredis will keep trying in the background.
 */
export function getRedis(): Redis | null {
  if (initialised) return client

  initialised = true
  const url = process.env.REDIS_URL?.trim()
  if (!url) return null

  client = buildClient(url)

  client.on('error', (err) => {
    if (!warnedConnect) {
      console.warn('[redis] connection error:', err.message)
      warnedConnect = true
    }
  })
  client.on('ready', () => {
    if (warnedConnect) {
      console.info('[redis] reconnected')
      warnedConnect = false
    }
  })

  // Kick off the first connect so the first real request doesn't pay the
  // round-trip. Errors are handled by the listener above.
  client.connect().catch(() => {
    /* swallowed; the error event already logged */
  })

  return client
}

/**
 * Close the Redis connection. Called on Nitro shutdown.
 */
export async function closeRedis(): Promise<void> {
  if (!client) return
  try {
    await client.quit()
  } catch {
    client.disconnect()
  }
  client = null
  initialised = false
}

/**
 * Test helper: drop the cached client so a subsequent getRedis() reads
 * REDIS_URL again. Not exported via index — internal use only.
 */
export function __resetRedisForTests(): void {
  if (client) client.disconnect()
  client = null
  initialised = false
  warnedConnect = false
}
