/**
 * Static asset detection. Used by the rate-limit middleware (so a single
 * page load doesn't burn through a user's quota) and the analytics
 * middleware (so request_events stays focused on real navigation/API
 * activity instead of every CSS/JS chunk).
 */

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

export function isStaticAsset(path: string): boolean {
  if (STATIC_EXACT_PATHS.has(path)) return true
  if (path.startsWith('/workbox-')) return true
  for (const prefix of STATIC_PATH_PREFIXES) {
    if (path.startsWith(prefix)) return true
  }
  return STATIC_FILE_EXTENSIONS.test(path)
}

/**
 * PDFs in /uploads/{reports,publications}/ must be fetched through
 * /api/downloads/{type}/{id} so they are subject to per-IP download
 * limits and bandwidth accounting. The rate-limit middleware blocks
 * them with 403; the analytics middleware skips them so we don't log
 * blocked-but-noisy attempts twice.
 */
export const BLOCKED_DIRECT_PATHS = /^\/uploads\/(?:reports|publications)\/.+\.pdf$/i
