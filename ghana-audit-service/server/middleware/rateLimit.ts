import {
  checkRateLimit,
  createRateLimitKey,
  getClientIP,
  RATE_LIMITS,
  type RateLimitConfig
} from '../utils/rateLimiter'

export default defineEventHandler((event): undefined | object => {
  const path = event.path || ''

  // Only apply rate limiting to API routes
  if (!path.startsWith('/api/')) {
    return
  }

  const clientIP = getClientIP(event)

  // Determine rate limit based on route type
  let config: RateLimitConfig = RATE_LIMITS.api

  // Stricter limits for form submissions (POST requests)
  if (event.method === 'POST') {
    if (path.includes('/newsletter') || path.includes('/contact')) {
      config = RATE_LIMITS.form
    }
  }

  // Stricter limits for search
  if (path.includes('/search')) {
    config = RATE_LIMITS.search
  }

  // Check rate limit
  const key = createRateLimitKey(clientIP, path)
  const { isLimited, remaining, resetTime } = checkRateLimit(key, config.limit, config.windowMs)

  // Set rate limit headers
  setHeader(event, 'X-RateLimit-Limit', config.limit.toString())
  setHeader(event, 'X-RateLimit-Remaining', remaining.toString())
  setHeader(event, 'X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString())

  // If rate limited, return 429 error
  if (isLimited) {
    setResponseStatus(event, 429)
    return {
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
    }
  }

  return
})
