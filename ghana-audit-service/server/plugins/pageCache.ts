import type { H3Event } from 'h3'
import {
  getResponseHeader,
  getResponseStatus,
  removeResponseHeader,
  setResponseHeader,
  setResponseStatus
} from 'h3'
import { getRouteRules } from 'nitropack/runtime'
import { logWarn } from '../utils/logger'
import {
  BYPASS_HEADER,
  BYPASS_STATUS,
  CSP_HEADERS,
  cspNonce,
  isPageCacheRule,
  swapNonce
} from '../utils/pageCache'

/** Log each bypass reason at most once a minute (a DB outage would hit every render). */
const WARN_INTERVAL_MS = 60_000

/**
 * Makes the public page cache (route rules built with pageCacheRule, see
 * server/utils/pageCache.ts) safe to share between visitors.
 *
 * `render:response` runs inside a cached render — on a miss, or in the
 * background when a stale copy is refreshed. Nitro's render event carries no
 * request headers but shares event.context with the request that triggered
 * it. A render that must not be served to everyone (it set a cookie, or a data
 * fetch failed) is handed to the cache layer as BYPASS_STATUS, which Nitro
 * never stores; on a refresh the stale copy is kept instead.
 *
 * `beforeResponse` runs for every page response, cached or freshly rendered.
 * The cached copy holds the nonce of whichever request rendered it — in its
 * CSP header and its HTML alike — so both are re-keyed to this request's
 * nonce (nuxt-security makes one per request). For the same reason the HTML
 * must not land in a shared cache: Nitro's `s-maxage` Cache-Control and its
 * validators are replaced, so browsers refetch (from this cache, in ~ms) the
 * way they did before pages were cached.
 */
export default defineNitroPlugin((nitroApp) => {
  const lastWarned = new Map<string, number>()

  nitroApp.hooks.hook('render:response', (response, { event }) => {
    if (!isPageCacheRule(getRouteRules(event))) return
    event.context.pageCacheRendered = true

    const reason = event.context.ssrFetchFailed
      ? 'a data fetch failed during SSR'
      : setsCookie(event, response.headers)
        ? 'the render set a cookie'
        : undefined
    if (!reason) return

    const status = response.statusCode || 200
    response.headers = { ...response.headers, [BYPASS_HEADER]: String(status) }
    response.statusCode = BYPASS_STATUS

    const now = Date.now()
    if (now - (lastWarned.get(reason) ?? 0) >= WARN_INTERVAL_MS) {
      lastWarned.set(reason, now)
      logWarn('pageCache', `not caching ${event.path.split('?')[0]}: ${reason}`)
    }
  })

  nitroApp.hooks.hook('beforeResponse', (event, response) => {
    if (!isPageCacheRule(getRouteRules(event))) return

    const bypassedStatus = getResponseHeader(event, BYPASS_HEADER)
    if (bypassedStatus !== undefined) {
      removeResponseHeader(event, BYPASS_HEADER)
      if (getResponseStatus(event) === BYPASS_STATUS) {
        setResponseStatus(event, Number(bypassedStatus))
      }
    }

    const nonce = event.context.security?.nonce
    const renderedNonce = CSP_HEADERS.map((name) => cspNonce(getResponseHeader(event, name))).find(
      Boolean
    )
    if (nonce && renderedNonce && renderedNonce !== nonce) {
      for (const name of CSP_HEADERS) {
        const csp = getResponseHeader(event, name)
        if (typeof csp === 'string') {
          setResponseHeader(event, name, swapNonce(csp, renderedNonce, nonce))
        }
      }
      if (typeof response.body === 'string') {
        response.body = swapNonce(response.body, renderedNonce, nonce)
      }
    }

    setResponseHeader(event, 'cache-control', 'private, no-cache')
    removeResponseHeader(event, 'etag')
    removeResponseHeader(event, 'last-modified')

    // Surfaces in request_events.cache_hit (see server/middleware/00-analytics.ts).
    // Middleware short-circuits (e.g. the rate limiter's 429) never reach the cache.
    event.context.cacheHit = getResponseStatus(event) < 400 && !event.context.pageCacheRendered
  })
})

/** Whether the render set a cookie — on Nitro's render event or in the response it returned. */
function setsCookie(event: H3Event, headers: Record<string, string> | undefined): boolean {
  const names = [...event.node.res.getHeaderNames(), ...Object.keys(headers ?? {})]
  return names.some((name) => name.toLowerCase() === 'set-cookie')
}
