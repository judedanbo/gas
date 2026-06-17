import { getHeader } from 'h3'
import { performance } from 'node:perf_hooks'
import { getClientIP } from '../utils/rateLimiter'
import { isStaticAsset, BLOCKED_DIRECT_PATHS } from '../utils/staticAssets'
import {
  hashIp,
  hashUa,
  classifyUa,
  normaliseRoutePattern,
  parseReferrerHost,
  isIpAnonymizedRoute
} from '../utils/analytics/fingerprint'
import { pushAnalyticsEvent } from '../utils/analytics/buffer'
import { isProbingPath } from '../utils/analytics/probingPaths'
import { recordIncident } from '../utils/analytics/recordIncident'
import { recordIncidentDeduped } from '../utils/analytics/recordIncidentDeduped'
import { getGeoIp } from '../utils/analytics/geoip'
import {
  analyseQueryString,
  highestSeverity,
  matchKindFingerprint
} from '../utils/analytics/fuzzPatterns'

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
      ip: string | null
      ipHash: string
      uaHash: string
      uaFamily: string
      country: string | null
      asn: number | null
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
  // Geo lookup happens here, before the raw IP leaves scope. The hashed
  // IP can't be reverse-resolved, so country/asn must be resolved now.
  const { country, asn } = getGeoIp(ip)
  const referrerHost = parseReferrerHost(
    getHeader(event, 'referer') || getHeader(event, 'referrer')
  )
  // Header-anomaly signals for the Phase 4 abuse detector. Real browsers
  // send Accept-Language + Accept-Encoding on every request; many bots
  // skip them. HTTP/1.0 in 2026 also typically means a stale scripted
  // client. Capture the booleans here on the request side; the detector
  // aggregates per (ipHash, uaHash) and feeds them into score.ts.
  const hasAcceptLanguage = !!getHeader(event, 'accept-language')
  const hasAcceptEncoding = !!getHeader(event, 'accept-encoding')
  const httpVersion = (event.node.req.httpVersion || '').slice(0, 8) || null

  const routePattern = normaliseRoutePattern(rawPath)
  const routePath = rawPath.slice(0, 512)

  // Raw IP for abuse attribution + geolocation — except on IP-anonymised routes
  // (CitizensEye), where we persist null and rely on ipHash only. country/asn are
  // still resolved above from the live IP (coarse, aggregate; not the IP itself).
  const storedIp = isIpAnonymizedRoute(routePattern) ? null : ip

  // Stash on context so downstream handlers (download endpoints, future
  // detector hooks) can reuse the hashes + geo without recomputing.
  event.context.analytics = { ip: storedIp, ipHash, uaHash, uaFamily, country, asn }

  // Probing-path detection — fires the moment we see the request, not when
  // the response closes, so we don't lose the signal if the connection is
  // dropped before sending. Severity 'warning' because a single hit is
  // strong evidence of malicious automation but we want admins to confirm
  // before taking action (still flag-only).
  if (isProbingPath(path)) {
    recordIncident({
      kind: 'probing_path',
      severity: 'warning',
      ip: storedIp,
      ipHash,
      uaHash,
      routePattern,
      routePath,
      details: { path, method, ua: ua.slice(0, 200) }
    })
  }

  // Query-string fuzz scan. Fires for any non-static, non-admin GET/POST
  // whose query contains SQLi / XSS / path-traversal / SSRF / encoded
  // payloads. Admin paths are skipped per the Phase 5g plan — JWT-gated
  // surfaces are low-risk and admins legitimately submit complex queries.
  //
  // Body fields on form POSTs are scanned in the handlers themselves
  // (after readBody), since middleware can't read the body without
  // disturbing the stream.
  //
  // Deduplicated per (kind, ipHash, routePattern + match-kind fingerprint)
  // on a 5-minute window via Redis SET NX EX → in-process LRU fallback.
  // Without dedup a sustained fuzzing campaign would write one row per
  // attacker request; the score signal only needs *that* the signature
  // is fuzzing, not the exact count.
  if (!path.startsWith('/api/admin/') && !path.startsWith('/admin/')) {
    const fuzzMatches = analyseQueryString(rawPath)
    if (fuzzMatches.length > 0) {
      recordIncidentDeduped(
        {
          kind: 'fuzz_attempt',
          severity: highestSeverity(fuzzMatches),
          ip: storedIp,
          ipHash,
          uaHash,
          routePattern,
          routePath,
          details: { source: 'query', matches: fuzzMatches }
        },
        `${routePattern}:${matchKindFingerprint(fuzzMatches)}`,
        300
      )
    }
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
        // event.context.cacheHit is set by defineAnalyticsCachedHandler;
        // unwrapped routes leave it undefined → recorded as false.
        cacheHit: event.context.cacheHit === true,
        ip: storedIp,
        ipHash,
        uaHash,
        uaFamily,
        country,
        asn,
        referrerHost,
        isBot: null,
        role: role ? String(role).slice(0, 16) : null,
        hasAcceptLanguage,
        hasAcceptEncoding,
        httpVersion
      })
    } catch (err) {
      // Capture must never break the response. Log and move on.
      console.warn('[analytics] capture failed:', (err as Error).message)
    }
  })
})
