import { getHeader } from 'h3'
import { performance } from 'node:perf_hooks'
import { getClientIP } from '../utils/rateLimiter'
import { isStaticAsset, BLOCKED_DIRECT_PATHS } from '../utils/staticAssets'
import {
  hashIp,
  hashUa,
  classifyUa,
  normaliseRoutePattern,
  parseReferrerHost
} from '../utils/analytics/fingerprint'
import { pushAnalyticsEvent } from '../utils/analytics/buffer'
import { isProbingPath } from '../utils/analytics/probingPaths'
import { recordIncident } from '../utils/analytics/recordIncident'

/**
 * Capture middleware. Filename prefix `00-` is intentional: middleware files
 * are loaded in alphabetical order, so `00-analytics.ts` runs before
 * `adminAuth.ts` and `rateLimit.ts`. That matters because if rate-limit
 * short-circuits with a 429 we still want to record the rate-limited
 * request — which works because we register a `res.on('close')` listener
 * here, before any later middleware has a chance to return.
 *
 * Role tagging is read from `event.context.auth` inside the close listener,
 * by which point adminAuth has either populated it (success) or rejected
 * the request (in which case role is null). Either is correct.
 */

declare module 'h3' {
  interface H3EventContext {
    analytics?: {
      ipHash: string
      uaHash: string
      uaFamily: string
    }
  }
}

export default defineEventHandler((event) => {
  const rawPath = event.path || '/'
  const path = rawPath.split('?')[0]
  if (isStaticAsset(path)) return
  if (BLOCKED_DIRECT_PATHS.test(path)) return

  const start = performance.now()
  const method = (event.method || 'GET').slice(0, 8)
  const ua = getHeader(event, 'user-agent') || ''
  const ip = getClientIP(event)
  const ipHash = hashIp(ip)
  const uaHash = hashUa(ua)
  const { family: uaFamily } = classifyUa(ua)
  const referrerHost = parseReferrerHost(
    getHeader(event, 'referer') || getHeader(event, 'referrer')
  )

  const routePattern = normaliseRoutePattern(rawPath)
  const routePath = rawPath.slice(0, 512)

  // Stash on context so downstream handlers (download endpoints, future
  // detector hooks) can reuse the hashes without recomputing.
  event.context.analytics = { ipHash, uaHash, uaFamily }

  // Probing-path detection — fires the moment we see the request, not when
  // the response closes, so we don't lose the signal if the connection is
  // dropped before sending. Severity 'warning' because a single hit is
  // strong evidence of malicious automation but we want admins to confirm
  // before taking action (still flag-only).
  if (isProbingPath(path)) {
    recordIncident({
      kind: 'probing_path',
      severity: 'warning',
      ipHash,
      uaHash,
      routePattern,
      routePath,
      details: { path, method, ua: ua.slice(0, 200) }
    })
  }

  event.node.res.on('close', () => {
    try {
      const durationMs = Math.max(0, Math.round(performance.now() - start))
      const status = event.node.res.statusCode || 0
      const contentLen = event.node.res.getHeader('content-length')
      const bytesOut =
        typeof contentLen === 'string'
          ? Math.max(0, parseInt(contentLen, 10) || 0)
          : typeof contentLen === 'number'
            ? Math.max(0, contentLen)
            : 0
      const role = event.context.auth?.user?.role ?? null

      pushAnalyticsEvent({
        method,
        routePattern,
        routePath,
        status,
        durationMs,
        bytesOut,
        cacheHit: false,
        ipHash,
        uaHash,
        uaFamily,
        country: null,
        asn: null,
        referrerHost,
        isBot: null,
        role: role ? String(role).slice(0, 16) : null
      })
    } catch (err) {
      // Capture must never break the response. Log and move on.
      console.warn('[analytics] capture failed:', (err as Error).message)
    }
  })
})
