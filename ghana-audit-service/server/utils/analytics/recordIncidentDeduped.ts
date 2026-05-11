import { getRedis } from '../redis'
import { recordIncident } from './recordIncident'
import type { NewAbuseIncident } from '../../database/schema/analytics'

/**
 * Dedup wrapper around recordIncident. Mirrors the rate-limiter's
 * Redis-primary, in-process-fallback shape (see server/utils/rateLimiter.ts).
 *
 * Use case: high-frequency abuse signals like `fuzz_attempt` where every
 * request from a scripted attacker matches a pattern. Without dedup we'd
 * write one abuse_incidents row per attacker request — easily millions
 * per day at sustained attack rates. The detector only needs *that* the
 * signature is fuzzing, not the exact count, so suppressing repeats
 * within a window is safe.
 *
 * Key shape: `incident-dedup:{kind}:{ipHash|'none'}:{dedupKey}`. The
 * caller picks `dedupKey` to control what counts as "the same incident"
 * — typically a route + signal-family fingerprint. TTL is also caller-
 * chosen (5 min is a good default for fuzz; longer is fine for noisier
 * signals).
 *
 * Atomicity: `SET key 1 EX ttl NX` is one round-trip. Only the first
 * call within the window succeeds. Memory fallback uses a Map + size cap
 * for LRU-ish eviction; the worst case during a Redis outage is one
 * incident row per attacker per window per Nitro instance, which is
 * still vastly less than the un-deduped flood.
 *
 * Fire-and-forget signature matches recordIncident — callers don't need
 * to await.
 */

const MEMORY_CAP = 5_000

interface CacheEntry {
  expiresAt: number
}

const memCache = new Map<string, CacheEntry>()

function memorySetNx(key: string, ttlSeconds: number): boolean {
  const now = Date.now()
  const existing = memCache.get(key)
  if (existing && existing.expiresAt > now) {
    return false
  }
  // Expired or missing → claim. Re-set in the Map so insertion order
  // tracks recency for the LRU eviction below.
  if (existing) memCache.delete(key)
  memCache.set(key, { expiresAt: now + ttlSeconds * 1000 })
  if (memCache.size > MEMORY_CAP) {
    const oldest = memCache.keys().next().value
    if (oldest !== undefined) memCache.delete(oldest)
  }
  return true
}

export function recordIncidentDeduped(
  incident: NewAbuseIncident,
  dedupKey: string,
  ttlSeconds: number
): void {
  void (async () => {
    const key = `incident-dedup:${incident.kind}:${incident.ipHash || 'none'}:${dedupKey}`
    const redis = getRedis()
    if (redis) {
      try {
        const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX')
        if (result === 'OK') {
          recordIncident(incident)
        }
        return
      } catch {
        // Fall through to memory backend on Redis error.
      }
    }
    if (memorySetNx(key, ttlSeconds)) {
      recordIncident(incident)
    }
  })()
}

/** Test helper: clear the in-process LRU. */
export function __resetIncidentDedupForTests(): void {
  memCache.clear()
}

/** Test helper: peek at the LRU size for assertions. */
export function __getIncidentDedupSizeForTests(): number {
  return memCache.size
}
