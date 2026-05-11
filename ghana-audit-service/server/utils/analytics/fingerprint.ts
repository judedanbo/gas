import { createHash } from 'node:crypto'

/**
 * Privacy-preserving fingerprint utilities for the analytics pipeline.
 *
 * Raw IPs are never persisted: they are sha256'd with a server-side salt
 * (ANALYTICS_IP_SALT) so they cannot be reversed without the salt. Rotating
 * the salt anonymises older hashed IPs.
 *
 * UA strings are sha256'd as well — for joining and de-duplication. The full
 * UA string is sampled into bot_signatures.ua_sample (truncated) only when
 * a signature is created, for forensic display.
 */

let cachedSalt: string | null = null

function getIpSalt(): string {
  if (cachedSalt !== null) return cachedSalt
  const salt = process.env.ANALYTICS_IP_SALT || ''
  if (!salt) {
    // Loud warning the first time — running with an empty salt is a bug, not
    // a feature. Hashes will still be consistent within one process so the
    // pipeline keeps working, but rotation does nothing until a real salt
    // is set.
    console.warn('[analytics/fingerprint] ANALYTICS_IP_SALT is unset; IP hashes will be unsalted')
  }
  cachedSalt = salt
  return cachedSalt
}

/**
 * Test helper: drop the cached salt so a subsequent call reads
 * ANALYTICS_IP_SALT again.
 */
export function __resetIpSaltForTests(): void {
  cachedSalt = null
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(`${ip}|${getIpSalt()}`).digest('hex')
}

export function hashUa(ua: string): string {
  return createHash('sha256').update(ua).digest('hex')
}

// ---------------------------------------------------------------------------
// User-Agent classification
// ---------------------------------------------------------------------------

export type UaFamily = 'browser' | 'crawler' | 'script' | 'empty' | 'unknown'

const KNOWN_CRAWLERS =
  /(Googlebot|Bingbot|DuckDuckBot|YandexBot|Baiduspider|GPTBot|ChatGPT-User|ClaudeBot|Claude-Web|PerplexityBot|AppleBot|FacebookBot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|TelegramBot|MJ12bot|AhrefsBot|SemrushBot|DotBot|PetalBot|SeznamBot)/i

const KNOWN_SCRIPTS =
  /(python-requests|curl\/|Wget\/|Go-http-client|Scrapy|axios\/|node-fetch|got\/|java-http|okhttp|libwww-perl|Java\/|Python\/|aiohttp|httpx)/i

// Real browsers all start with "Mozilla/5.0" — that's a useful signal even
// though some bots spoof it.
const BROWSER = /^Mozilla\/5\.0/

/**
 * Classify a UA string into a coarse family. Used for dashboard grouping and
 * as one input to the abuse-detection score (Phase 4); not authoritative on
 * its own — bots routinely lie.
 */
export function classifyUa(ua: string | null | undefined): {
  family: UaFamily
  isKnownBot: boolean
} {
  const trimmed = (ua || '').trim()
  if (!trimmed || trimmed === '-' || trimmed.length < 5) {
    return { family: 'empty', isKnownBot: false }
  }
  if (KNOWN_CRAWLERS.test(trimmed)) {
    return { family: 'crawler', isKnownBot: true }
  }
  if (KNOWN_SCRIPTS.test(trimmed)) {
    return { family: 'script', isKnownBot: true }
  }
  if (BROWSER.test(trimmed)) {
    return { family: 'browser', isKnownBot: false }
  }
  return { family: 'unknown', isKnownBot: false }
}

// ---------------------------------------------------------------------------
// Route pattern normalisation
// ---------------------------------------------------------------------------

const UUID = /\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?=\/|$)/gi
const HEX24 = /\/[a-f0-9]{24}(?=\/|$)/gi
const NUMERIC = /\/\d+(?=\/|$)/g

// Routes whose terminal segment is a slug — collapse the slug so the rollup
// table doesn't explode by content cardinality. The negative lookahead `(?!\[)`
// ensures we don't re-collapse a segment that ID/UUID normalisation already
// turned into a placeholder like `[id]`. Add to this list as new slug-routed
// pages ship; keeping it explicit avoids over-collapsing static pages like
// /about/management-team.
const SLUG_ROUTES = [
  /^(\/api\/news)\/(?!\[)[^/]+$/,
  /^(\/api\/publications)\/(?!\[)[^/]+$/,
  /^(\/api\/events)\/(?!\[)[^/]+$/,
  /^(\/api\/reports)\/(?!\[)[^/]+$/,
  /^(\/api\/tenders)\/(?!\[)[^/]+$/,
  /^(\/api\/vacancies)\/(?!\[)[^/]+$/,
  /^(\/news)\/(?!\[)[^/]+$/,
  /^(\/publications)\/(?!\[)[^/]+$/,
  /^(\/events)\/(?!\[)[^/]+$/,
  /^(\/reports)\/(?!\[)[^/]+$/,
  /^(\/tenders)\/(?!\[)[^/]+$/,
  /^(\/vacancies)\/(?!\[)[^/]+$/
]

/**
 * Collapse a request path into a low-cardinality routing pattern suitable
 * for grouping in dashboards. Examples:
 *   /api/reports/123                         → /api/reports/[id]
 *   /api/news/some-article                   → /api/news/[slug]
 *   /ak/reports/123                          → /[locale]/reports/[id]
 *   /ak/news/some-article                    → /[locale]/news/[slug]
 *   /admin/users/4f8e.../edit                → /admin/users/[id]/edit
 *   /about/management-team                   → /about/management-team (unchanged)
 */
export function normaliseRoutePattern(path: string): string {
  let p = (path || '/').split('?')[0].split('#')[0]
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)

  // Detach the locale prefix so the slug-route regexes match the bare path,
  // then re-prepend at the end.
  let localePrefix = ''
  if (/^\/ak(\/|$)/.test(p)) {
    localePrefix = '/[locale]'
    p = p.slice(3) || '/'
  }

  // ID-shaped segments first; this turns numeric/UUID trailing segments into
  // placeholders so the slug step below can ignore them via its lookahead.
  p = p.replace(UUID, '/[uuid]')
  p = p.replace(HEX24, '/[id]')
  p = p.replace(NUMERIC, '/[id]')

  // Known slug routes — collapse the trailing slug (only if it isn't already
  // a placeholder).
  for (const re of SLUG_ROUTES) {
    const m = p.match(re)
    if (m) {
      p = `${m[1]}/[slug]`
      break
    }
  }

  return (localePrefix + p).slice(0, 256) || '/'
}

/**
 * Extract just the host portion of a referrer URL. Query strings are
 * dropped to avoid accidentally capturing tokens or PII.
 */
export function parseReferrerHost(ref: string | null | undefined): string | null {
  if (!ref) return null
  try {
    const host = new URL(ref).hostname
    return host ? host.slice(0, 128) : null
  } catch {
    return null
  }
}
