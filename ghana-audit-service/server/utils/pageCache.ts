/**
 * Page cache for the DB-backed public pages (route rules in nuxt.config.ts).
 *
 * On the node-server preset only `cache`/`swr` route rules cache anything:
 * Nitro registers its cached event handler in front of the Nuxt renderer for
 * each such path (`isr` is honoured by the Vercel/Netlify presets alone).
 * Cached pages are rendered without the visitor's request headers and the
 * stored response is replayed to everyone, so server/plugins/pageCache.ts
 * adapts every response on the way out (fresh CSP nonce, no shared caching)
 * and keeps per-render state out of the cache.
 */
import type { NitroRouteRules } from 'nitropack/types'

/**
 * Cache `name` of the public-page route rules. It marks a rule as a page cache
 * for server/plugins/pageCache.ts and namespaces the entries in storage
 * (`cache:nitro:routes:pages:*`). Other cached routes (/api/**, /admin/**)
 * don't carry it and are left alone.
 */
export const PAGE_CACHE_NAME = 'pages'

/**
 * Route rule for a cached public page: each URL is rendered at most once per
 * `maxAge` seconds per pod; after that the stale copy is served while a
 * background render refreshes it (stale-while-revalidate).
 */
export function pageCacheRule(maxAge: number) {
  return { cache: { name: PAGE_CACHE_NAME, maxAge, swr: true } }
}

/** Whether the merged route rules for a request (getRouteRules) belong to a cached public page. */
export function isPageCacheRule(rules: NitroRouteRules | undefined): boolean {
  const cache = rules?.cache
  return !!cache && cache.name === PAGE_CACHE_NAME
}

/**
 * Nitro stores every cached response with a status below 400. A render that
 * must not be shared is handed to the cache layer with this status instead,
 * and the visitor gets the real one back from BYPASS_HEADER.
 */
export const BYPASS_STATUS = 503
export const BYPASS_HEADER = 'x-page-cache-bypass'

/** Headers that can carry nuxt-security's per-request `'nonce-…'` source. */
export const CSP_HEADERS = ['content-security-policy', 'content-security-policy-report-only']

const CSP_NONCE_RE = /'nonce-([^']+)'/

/** The nonce a CSP header value was generated with, if it has one. */
export function cspNonce(csp: unknown): string | undefined {
  return typeof csp === 'string' ? CSP_NONCE_RE.exec(csp)?.[1] : undefined
}

/**
 * Replace every occurrence of the nonce a response was rendered with. The
 * nonce is random per render, so any occurrence of it in the HTML (the
 * `nonce="…"` attributes nuxt-security adds, or a `useNonce()` value) or in
 * the CSP header refers to it.
 */
export function swapNonce(value: string, renderedNonce: string, nonce: string): string {
  return value.replaceAll(renderedNonce, nonce)
}

declare module 'h3' {
  interface H3EventContext {
    /**
     * Set by plugins/page-cache.server.ts when an SSR data fetch failed
     * transiently. The render shares this context with the request.
     */
    ssrFetchFailed?: boolean
    /**
     * Set once a render running with this request's context finishes — the
     * cache miss it is waiting for, or (later) the background refresh a stale
     * hit triggered.
     */
    pageCacheRendered?: boolean
  }
}
