import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  checkRateLimit,
  checkMultiWindowRateLimit,
  createRateLimitKey,
  getClientIP,
  RATE_LIMITS
} from '../../../server/utils/rateLimiter'

describe('rateLimiter', () => {
  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Reset time-based state between tests
      vi.useFakeTimers()
    })

    it('should allow requests under the limit', () => {
      const identifier = 'test-ip-1'
      const limit = 5
      const windowMs = 60000

      const result = checkRateLimit(identifier, limit, windowMs)

      expect(result.isLimited).toBe(false)
      expect(result.remaining).toBe(4) // limit - 1
    })

    it('should track request count correctly', () => {
      const identifier = 'test-ip-2'
      const limit = 3
      const windowMs = 60000

      // First request
      let result = checkRateLimit(identifier, limit, windowMs)
      expect(result.remaining).toBe(2)

      // Second request
      result = checkRateLimit(identifier, limit, windowMs)
      expect(result.remaining).toBe(1)

      // Third request
      result = checkRateLimit(identifier, limit, windowMs)
      expect(result.remaining).toBe(0)
    })

    it('should limit requests when limit is exceeded', () => {
      const identifier = 'test-ip-3'
      const limit = 2
      const windowMs = 60000

      // First two requests
      checkRateLimit(identifier, limit, windowMs)
      checkRateLimit(identifier, limit, windowMs)

      // Third request should be limited
      const result = checkRateLimit(identifier, limit, windowMs)
      expect(result.isLimited).toBe(true)
      expect(result.remaining).toBe(0)
    })

    it('should reset after window expires', () => {
      const identifier = 'test-ip-4'
      const limit = 2
      const windowMs = 60000

      // Exhaust limit
      checkRateLimit(identifier, limit, windowMs)
      checkRateLimit(identifier, limit, windowMs)

      // Advance time past window
      vi.advanceTimersByTime(windowMs + 1000)

      // Should be allowed again
      const result = checkRateLimit(identifier, limit, windowMs)
      expect(result.isLimited).toBe(false)
      expect(result.remaining).toBe(1)
    })
  })

  describe('createRateLimitKey', () => {
    it('should create correct key format', () => {
      const ip = '192.168.1.1'
      const route = '/api/newsletter'

      const key = createRateLimitKey(ip, route)

      expect(key).toBe('192.168.1.1:/api/newsletter')
    })

    it('should handle special characters in route', () => {
      const ip = '10.0.0.1'
      const route = '/api/reports?page=1'

      const key = createRateLimitKey(ip, route)

      expect(key).toBe('10.0.0.1:/api/reports?page=1')
    })
  })

  describe('getClientIP', () => {
    it('should return remote address when no trusted proxies', () => {
      const mockEvent = {
        node: {
          req: {
            socket: {
              remoteAddress: '192.168.1.100'
            }
          }
        }
      }

      // @ts-expect-error - Mocking H3Event partially
      const ip = getClientIP(mockEvent)

      expect(ip).toBe('192.168.1.100')
    })

    it('should return unknown when no address available', () => {
      const mockEvent = {
        node: {
          req: {
            socket: {}
          }
        }
      }

      // @ts-expect-error - Mocking H3Event partially
      const ip = getClientIP(mockEvent)

      expect(ip).toBe('unknown')
    })
  })

  describe('RATE_LIMITS configuration', () => {
    it('should have api rate limit config', () => {
      expect(RATE_LIMITS.api).toBeDefined()
      expect(RATE_LIMITS.api.limit).toBe(100)
      expect(RATE_LIMITS.api.windowMs).toBe(60000)
    })

    it('should have form rate limit config', () => {
      expect(RATE_LIMITS.form).toBeDefined()
      expect(RATE_LIMITS.form.limit).toBe(10)
      expect(RATE_LIMITS.form.windowMs).toBe(60000)
    })

    it('should have search rate limit config', () => {
      expect(RATE_LIMITS.search).toBeDefined()
      expect(RATE_LIMITS.search.limit).toBe(30)
      expect(RATE_LIMITS.search.windowMs).toBe(60000)
    })

    it('should have page rate limit config (lenient HTML navigation guard)', () => {
      expect(RATE_LIMITS.page).toBeDefined()
      expect(RATE_LIMITS.page.limit).toBe(300)
      expect(RATE_LIMITS.page.windowMs).toBe(60000)
    })

    it('should have download per-minute rate limit config', () => {
      expect(RATE_LIMITS.download).toBeDefined()
      expect(RATE_LIMITS.download.limit).toBe(5)
      expect(RATE_LIMITS.download.windowMs).toBe(60000)
    })

    it('should have download per-hour rate limit config', () => {
      expect(RATE_LIMITS.downloadHourly).toBeDefined()
      expect(RATE_LIMITS.downloadHourly.limit).toBe(50)
      expect(RATE_LIMITS.downloadHourly.windowMs).toBe(60 * 60 * 1000)
    })
  })

  describe('checkMultiWindowRateLimit', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('should report tightest non-limited window in headers', () => {
      const result = checkMultiWindowRateLimit('multi-ip-1', [
        { name: 'minute', config: { limit: 5, windowMs: 60_000 } },
        { name: 'hour', config: { limit: 50, windowMs: 3_600_000 } }
      ])

      expect(result.isLimited).toBe(false)
      // After one request: minute=4 left, hour=49 left → tightest is the minute window
      expect(result.remaining).toBe(4)
      expect(result.limit).toBe(5)
    })

    it('should flag limited when the per-minute window is exhausted', () => {
      const ip = 'multi-ip-2'
      const configs = [
        { name: 'minute', config: { limit: 2, windowMs: 60_000 } },
        { name: 'hour', config: { limit: 100, windowMs: 3_600_000 } }
      ]

      checkMultiWindowRateLimit(ip, configs)
      checkMultiWindowRateLimit(ip, configs)
      const third = checkMultiWindowRateLimit(ip, configs)

      expect(third.isLimited).toBe(true)
      expect(third.retryAfterSeconds).toBeGreaterThan(0)
    })

    it('should flag limited when the per-hour window is exhausted', () => {
      const ip = 'multi-ip-3'
      const configs = [
        { name: 'minute', config: { limit: 100, windowMs: 60_000 } },
        { name: 'hour', config: { limit: 2, windowMs: 3_600_000 } }
      ]

      checkMultiWindowRateLimit(ip, configs)
      checkMultiWindowRateLimit(ip, configs)
      const third = checkMultiWindowRateLimit(ip, configs)

      expect(third.isLimited).toBe(true)
      expect(third.retryAfterSeconds).toBeGreaterThan(0)
    })

    it('should keep windows isolated by name within the same IP', () => {
      const ip = 'multi-ip-4'

      // Burn one bucket via direct checkRateLimit at a specific name
      const first = checkMultiWindowRateLimit(ip, [
        { name: 'minute', config: { limit: 5, windowMs: 60_000 } }
      ])
      expect(first.remaining).toBe(4)

      // A different bucket name should be unaffected
      const second = checkMultiWindowRateLimit(ip, [
        { name: 'hour', config: { limit: 10, windowMs: 3_600_000 } }
      ])
      expect(second.remaining).toBe(9)
    })
  })
})
