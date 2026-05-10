import {
  checkRateLimit,
  checkMultiWindowRateLimit,
  createRateLimitKey,
  getClientIP,
  RATE_LIMITS,
  type RateLimitConfig
} from '../utils/rateLimiter'

// Static asset paths — never rate limited so a single page load doesn't
// burn through a user's budget on dozens of CSS/JS/image fetches.
const STATIC_PATH_PREFIXES = [
  '/_nuxt/',
  '/_ipx/',
  '/__nuxt/',
  '/__nuxt_island/',
  '/_loading/',
  '/_payload.json',
  '/icons/'
]

const STATIC_EXACT_PATHS = new Set([
  '/favicon.ico',
  '/favicon.svg',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/sw.js',
  '/registerSW.js'
])

const STATIC_FILE_EXTENSIONS =
  /\.(?:css|js|mjs|map|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot|json|txt|xml)$/i

// PDFs in these public dirs must be fetched through /api/downloads/{type}/{id}
// so they are subject to per-IP download limits and bandwidth accounting.
const BLOCKED_DIRECT_PATHS = /^\/uploads\/(?:reports|publications)\/.+\.pdf$/i

function isStaticAsset(path: string): boolean {
  if (STATIC_EXACT_PATHS.has(path)) return true
  if (path.startsWith('/workbox-')) return true
  for (const prefix of STATIC_PATH_PREFIXES) {
    if (path.startsWith(prefix)) return true
  }
  return STATIC_FILE_EXTENSIONS.test(path)
}

function applyRateLimitHeaders(
  event: Parameters<typeof setHeader>[0],
  limit: number,
  remaining: number,
  resetTime: number
): void {
  setHeader(event, 'X-RateLimit-Limit', limit.toString())
  setHeader(event, 'X-RateLimit-Remaining', remaining.toString())
  setHeader(event, 'X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString())
}

export default defineEventHandler(async (event): Promise<undefined | object> => {
  const rawPath = event.path || '/'
  const path = rawPath.split('?')[0]

  // Skip framework/static traffic so a normal page load doesn't drain budgets.
  if (isStaticAsset(path)) return

  const clientIP = getClientIP(event)

  // Hard block direct PDF access in /public/uploads/{reports,publications}/.
  // All downloads must funnel through /api/downloads/{type}/{id} so they are
  // metered and billed against the per-IP download quota.
  if (BLOCKED_DIRECT_PATHS.test(path)) {
    setResponseStatus(event, 403)
    return {
      statusCode: 403,
      statusMessage: 'Forbidden',
      message:
        'Direct file access is not permitted. Please use the official download link from the report or publication page.'
    }
  }

  const isApi = path.startsWith('/api/')
  const isDownload = path.startsWith('/api/downloads/')

  // Downloads: stricter dual-window limit (per-minute and per-hour).
  if (isDownload) {
    const result = await checkMultiWindowRateLimit(clientIP, [
      { name: 'download:minute', config: RATE_LIMITS.download },
      { name: 'download:hour', config: RATE_LIMITS.downloadHourly }
    ])

    applyRateLimitHeaders(event, result.limit, result.remaining, result.resetTime)

    if (result.isLimited) {
      setHeader(event, 'Retry-After', result.retryAfterSeconds)
      setResponseStatus(event, 429)
      return {
        statusCode: 429,
        statusMessage: 'Too Many Requests',
        message:
          'Download limit reached. Please wait before downloading another file. This limit helps us keep the site reliable for everyone.',
        retryAfter: result.retryAfterSeconds
      }
    }

    return
  }

  // Other API routes: existing per-route, per-IP buckets.
  if (isApi) {
    let config: RateLimitConfig = RATE_LIMITS.api

    if (event.method === 'POST') {
      if (path.includes('/newsletter') || path.includes('/contact')) {
        config = RATE_LIMITS.form
      }
    }

    if (path.includes('/search')) {
      config = RATE_LIMITS.search
    }

    const key = createRateLimitKey(clientIP, path)
    const { isLimited, remaining, resetTime } = await checkRateLimit(
      key,
      config.limit,
      config.windowMs
    )

    applyRateLimitHeaders(event, config.limit, remaining, resetTime)

    if (isLimited) {
      const retryAfter = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))
      setHeader(event, 'Retry-After', retryAfter)
      setResponseStatus(event, 429)
      return {
        statusCode: 429,
        statusMessage: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter
      }
    }

    return
  }

  // Everything else (HTML pages, including /, /reports, /publications, /admin,
  // /ak/*, etc.) — lenient global per-IP bucket as a backstop against scraping.
  const config = RATE_LIMITS.page
  const key = `${clientIP}:page`
  const { isLimited, remaining, resetTime } = await checkRateLimit(
    key,
    config.limit,
    config.windowMs
  )

  applyRateLimitHeaders(event, config.limit, remaining, resetTime)

  if (isLimited) {
    const retryAfter = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))
    setHeader(event, 'Retry-After', retryAfter)
    setResponseStatus(event, 429)
    return {
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Too many requests. Please slow down and try again shortly.',
      retryAfter
    }
  }

  return
})
