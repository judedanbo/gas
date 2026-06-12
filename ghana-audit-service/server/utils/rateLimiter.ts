import type { H3Event } from 'h3'
import { getHeader } from 'h3'
import { getRedis } from './redis'

/**
 * Multi-instance-safe rate limiter.
 *
 * If REDIS_URL is configured, counters live in Redis (shared across all
 * Nitro instances) using INCR + PEXPIRE NX for atomic per-window bumps.
 * Otherwise — and on Redis errors — we fall back to a per-process Map
 * so the site stays usable. The fallback is per-instance, so during a
 * Redis outage attackers can briefly get N× quota where N = instance
 * count; this is intentional and far safer than degrading open.
 *
 * Behaviour and the public function shapes are unchanged from the
 * pre-Redis implementation, except that the check functions are now
 * async (Redis is the network).
 */

// Trusted reverse-proxy sources, parsed once at startup. Each entry is either
// a bare IP ("10.0.0.5") or an IPv4 CIDR range ("10.244.0.0/16"). The frontend
// only honours forwarded client-IP headers when the connecting peer matches one
// of these — see getClientIP / isTrustedProxy.
const TRUSTED_PROXIES =
  process.env.TRUSTED_PROXIES?.split(',')
    .map((p) => p.trim())
    .filter(Boolean) || []

/**
 * Node frequently reports proxy peers as IPv4-mapped IPv6 (e.g.
 * "::ffff:10.244.1.7"). Strip that prefix so an IPv4 comparison can match.
 */
function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip
}

/**
 * Convert a dotted-quad IPv4 string to a 32-bit unsigned integer, or null if it
 * isn't a syntactically valid IPv4 address.
 */
function ipv4ToInt(ip: string): number | null {
  const octets = ip.split('.')
  if (octets.length !== 4) return null
  let value = 0
  for (const octet of octets) {
    const n = Number(octet)
    if (!Number.isInteger(n) || n < 0 || n > 255 || (octet.length > 1 && octet.startsWith('0'))) {
      return null
    }
    value = (value << 8) | n
  }
  return value >>> 0
}

/**
 * Decide whether a connecting peer is a configured trusted proxy.
 *
 * `remoteAddress` is the already-normalized peer IP (IPv4 string). `entries` are
 * the configured TRUSTED_PROXIES — a mix of bare IPs ("10.0.0.5") and IPv4 CIDR
 * ranges ("10.244.0.0/16"). Return true iff `remoteAddress` matches any entry.
 *
 * Implemented by the maintainer — see exported wrapper below for context.
 */
export function isTrustedProxy(
  remoteAddress: string,
  entries: string[] = TRUSTED_PROXIES
): boolean {
  if (!remoteAddress) return false

  for (const entry of entries) {
    if (!entry.includes('/')) {
      // Bare IP: exact match.
      if (entry === remoteAddress) return true
      continue
    }

    // CIDR range: compare the masked network portions.
    const [network, prefixStr] = entry.split('/')
    const prefix = Number(prefixStr)
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) continue // fail closed

    const networkInt = ipv4ToInt(network)
    const ipInt = ipv4ToInt(remoteAddress)
    if (networkInt === null || ipInt === null) continue // fail closed

    // Shifting a 32-bit value by 32 is a no-op in JS, so special-case /0.
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
    if ((ipInt & mask) >>> 0 === (networkInt & mask) >>> 0) return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Backend layer — memory fallback + Redis primary
// ---------------------------------------------------------------------------

interface BackendResult {
  count: number
  ttlMs: number
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-process fallback store. Used when REDIS_URL is unset, when Redis is
// unreachable, or when a Redis op throws. Memory cleanup mirrors the
// pre-Redis behaviour: a sweep every 5 minutes.
const memoryStore = new Map<string, RateLimitEntry>()
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupExpiredEntries() {
  const now = Date.now()
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetTime < now) {
      memoryStore.delete(key)
    }
  }
  lastCleanup = now
}

function memoryIncr(key: string, windowMs: number): BackendResult {
  const now = Date.now()
  if (now - lastCleanup > CLEANUP_INTERVAL) cleanupExpiredEntries()

  const entry = memoryStore.get(key)
  if (!entry || entry.resetTime < now) {
    const fresh: RateLimitEntry = { count: 1, resetTime: now + windowMs }
    memoryStore.set(key, fresh)
    return { count: 1, ttlMs: windowMs }
  }
  entry.count++
  return { count: entry.count, ttlMs: Math.max(0, entry.resetTime - now) }
}

let redisFailWarned = false

async function redisIncr(key: string, windowMs: number): Promise<BackendResult | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    // PEXPIRE … NX (Redis 7+) only sets TTL when the key has none —
    // guarantees the first incrementer in a window pins the expiry and
    // racing incrementers don't reset it.
    const pipe = redis.pipeline()
    pipe.incr(key)
    pipe.pexpire(key, windowMs, 'NX')
    pipe.pttl(key)
    const results = await pipe.exec()
    if (!results) return null
    const incrEntry = results[0]
    const ttlEntry = results[2]
    if (incrEntry[0]) throw incrEntry[0]
    if (ttlEntry[0]) throw ttlEntry[0]
    return { count: Number(incrEntry[1]), ttlMs: Number(ttlEntry[1]) }
  } catch (err) {
    if (!redisFailWarned) {
      console.warn('[rateLimit] Redis op failed, falling back to memory:', (err as Error).message)
      redisFailWarned = true
    }
    return null
  }
}

async function incr(key: string, windowMs: number): Promise<BackendResult> {
  const fromRedis = await redisIncr(key, windowMs)
  return fromRedis ?? memoryIncr(key, windowMs)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if a request should be rate limited.
 * @param identifier - Unique identifier (usually IP address)
 * @param limit - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<{ isLimited: boolean; remaining: number; resetTime: number }> {
  const { count, ttlMs } = await incr(identifier, windowMs)
  return {
    isLimited: count > limit,
    remaining: Math.max(0, limit - count),
    resetTime: Date.now() + Math.max(0, ttlMs)
  }
}

/**
 * Create a rate limit key for API routes
 */
export function createRateLimitKey(ip: string, route: string): string {
  return `${ip}:${route}`
}

/**
 * Get client IP from event with trusted proxy support.
 * Only trusts x-forwarded-for header if request comes from a trusted proxy.
 */
export function getClientIP(event: H3Event): string {
  const remoteAddress = normalizeIp(event.node?.req?.socket?.remoteAddress || '')

  if (TRUSTED_PROXIES.length > 0 && isTrustedProxy(remoteAddress)) {
    const forwarded = getHeader(event, 'x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }

    const realIP = getHeader(event, 'x-real-ip')
    if (realIP) {
      return realIP
    }
  }

  return remoteAddress || 'unknown'
}

// Rate limit configuration type
export interface RateLimitConfig {
  limit: number
  windowMs: number
}

// Rate limit configurations
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // General API requests: 100 per minute
  api: {
    limit: 100,
    windowMs: 60 * 1000
  },
  // Form submissions: 10 per minute
  form: {
    limit: 10,
    windowMs: 60 * 1000
  },
  // Search requests: 30 per minute
  search: {
    limit: 30,
    windowMs: 60 * 1000
  },
  // HTML page navigation: 300 per minute (lenient, catches scrapers without
  // affecting normal users or search-engine crawlers)
  page: {
    limit: 300,
    windowMs: 60 * 1000
  },
  // Report/publication downloads (per-minute window): 5 per minute.
  // Tight, anti-burst guard.
  download: {
    limit: 5,
    windowMs: 60 * 1000
  },
  // Report/publication downloads (per-hour window): 50 per hour.
  // Bandwidth/cost guard against sustained abuse.
  downloadHourly: {
    limit: 50,
    windowMs: 60 * 60 * 1000
  }
}

/**
 * Result of a multi-window rate limit check. `limit`, `remaining`, and
 * `resetTime` reflect the tightest window so X-RateLimit-* headers are
 * honest about the constraint a client is closest to.
 */
export interface MultiWindowResult {
  isLimited: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfterSeconds: number
}

/**
 * Check a request against multiple windows simultaneously (e.g. 5/min AND
 * 50/hour). Returns the most-restrictive view: limited if any window is
 * full, remaining/resetTime taken from whichever window is closest to its
 * cap.
 */
export async function checkMultiWindowRateLimit(
  baseIdentifier: string,
  configs: Array<{ name: string; config: RateLimitConfig }>
): Promise<MultiWindowResult> {
  const results = await Promise.all(
    configs.map(async ({ name, config }) => {
      const key = `${baseIdentifier}:${name}`
      const r = await checkRateLimit(key, config.limit, config.windowMs)
      return { ...r, limit: config.limit }
    })
  )

  const limited = results.find((r) => r.isLimited)
  if (limited) {
    return {
      isLimited: true,
      limit: limited.limit,
      remaining: 0,
      resetTime: limited.resetTime,
      retryAfterSeconds: Math.max(1, Math.ceil((limited.resetTime - Date.now()) / 1000))
    }
  }

  // Surface the tightest non-limited window in the headers.
  const tightest = results.reduce((a, b) => (a.remaining <= b.remaining ? a : b))
  return {
    isLimited: false,
    limit: tightest.limit,
    remaining: tightest.remaining,
    resetTime: tightest.resetTime,
    retryAfterSeconds: 0
  }
}
