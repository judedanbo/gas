import type { H3Event } from 'h3'
import { getHeader } from 'h3'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>()

// Trusted proxy IPs (configure via environment variable in production)
const TRUSTED_PROXIES = process.env.TRUSTED_PROXIES?.split(',').map(ip => ip.trim()) || []

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
  }
}
