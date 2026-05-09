import type { H3Event } from 'h3'
import { getHeader } from 'h3'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>()

// Trusted proxy IPs (configure via environment variable in production)
const TRUSTED_PROXIES = process.env.TRUSTED_PROXIES?.split(',').map((ip) => ip.trim()) || []

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000

// Track last cleanup
let lastCleanup = Date.now()

/**
 * Clean up expired entries from the rate limit store
 */
function cleanupExpiredEntries() {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
  lastCleanup = now
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (usually IP address)
 * @param limit - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Object with isLimited boolean and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { isLimited: boolean; remaining: number; resetTime: number } {
  const now = Date.now()

  // Periodic cleanup
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    cleanupExpiredEntries()
  }

  const entry = rateLimitStore.get(identifier)

  // No existing entry or expired entry
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs
    }
    rateLimitStore.set(identifier, newEntry)

    return {
      isLimited: false,
      remaining: limit - 1,
      resetTime: newEntry.resetTime
    }
  }

  // Increment count
  entry.count++

  // Check if limit exceeded
  const isLimited = entry.count > limit

  return {
    isLimited,
    remaining: Math.max(0, limit - entry.count),
    resetTime: entry.resetTime
  }
}

/**
 * Create a rate limit key for API routes
 */
export function createRateLimitKey(ip: string, route: string): string {
  return `${ip}:${route}`
}

/**
 * Get client IP from event with trusted proxy support
 * Only trusts x-forwarded-for header if request comes from a trusted proxy
 */
export function getClientIP(event: H3Event): string {
  const remoteAddress = event.node?.req?.socket?.remoteAddress || ''

  // Only trust forwarded headers if request comes from trusted proxy
  if (TRUSTED_PROXIES.length > 0 && TRUSTED_PROXIES.includes(remoteAddress)) {
    const forwarded = getHeader(event, 'x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }

    const realIP = getHeader(event, 'x-real-ip')
    if (realIP) {
      return realIP
    }
  }

  // Fallback to direct connection IP
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
  // Report/publication downloads (per-minute window): 5 per minute
  // This is the tight, anti-burst guard.
  download: {
    limit: 5,
    windowMs: 60 * 1000
  },
  // Report/publication downloads (per-hour window): 50 per hour
  // Bandwidth/cost guard against sustained abuse.
  downloadHourly: {
    limit: 50,
    windowMs: 60 * 60 * 1000
  }
}

/**
 * Result of a multi-window rate limit check. `limit`, `remaining`, and
 * `resetTime` reflect the tightest window so X-RateLimit-* headers are honest
 * about the constraint a client is closest to.
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
 * 50/hour). Returns the most-restrictive view: limited if any window is full,
 * remaining/resetTime taken from whichever window is closest to its cap.
 */
export function checkMultiWindowRateLimit(
  baseIdentifier: string,
  configs: Array<{ name: string; config: RateLimitConfig }>
): MultiWindowResult {
  const results = configs.map(({ name, config }) => {
    const key = `${baseIdentifier}:${name}`
    const r = checkRateLimit(key, config.limit, config.windowMs)
    return { ...r, limit: config.limit }
  })

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
