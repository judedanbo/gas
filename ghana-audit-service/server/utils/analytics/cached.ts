import type { EventHandler, H3Event } from 'h3'
import { defineCachedEventHandler } from 'nitropack/runtime'

/**
 * Cache-instrumented event handler. Wraps Nitro's defineCachedEventHandler
 * so cache hits show up in request_events.cache_hit.
 *
 * How it works
 * ────────────
 * Nitro's cached handler stores the inner handler's return value. On a hit,
 * Nitro replays the cached value WITHOUT invoking the inner handler. We
 * exploit that asymmetry:
 *
 *   1. Outer handler runs unconditionally and pre-sets cacheHit = true.
 *   2. Inner handler runs only on a miss; when it does, it overwrites
 *      cacheHit to false.
 *
 * The capture middleware (00-analytics.ts) reads event.context.cacheHit in
 * its res-close listener and writes it onto the request_event row.
 *
 * Side benefits the wrapper preserves from Nitro's caching:
 *   - storage backend (defaults to the 'cache' mountpoint)
 *   - swr / staleMaxAge
 *   - per-event keying
 *
 * Migrating an endpoint:
 *   1. Replace `defineEventHandler(handler)` with
 *      `defineAnalyticsCachedHandler(handler, { maxAge: 300 })`.
 *   2. Remove the corresponding `cache:` entry from `nuxt.config.ts`
 *      route rules to avoid double caching.
 */

interface CachedHandlerOptions {
  /** Max age in seconds. Default 300. */
  maxAge?: number
  /** Stale-while-revalidate window in seconds. Default 2× maxAge. */
  staleMaxAge?: number
  /** Optional explicit cache key fn; defaults to event.path normalised. */
  getKey?: (event: H3Event) => string
  /** Storage mountpoint name; defaults to 'cache'. */
  base?: string
  /** Cache name segment used for key namespacing. */
  name?: string
}

declare module 'h3' {
  interface H3EventContext {
    cacheHit?: boolean
  }
}

/**
 * Wrap a handler with Nitro's cached event handler + cache-hit flagging.
 * The returned handler always sets event.context.cacheHit; true if served
 * from cache, false if the inner handler produced a fresh response.
 */
export function defineAnalyticsCachedHandler<T>(
  handler: (event: H3Event) => Promise<T> | T,
  options: CachedHandlerOptions = {}
): EventHandler {
  const maxAge = options.maxAge ?? 300

  // defineCachedEventHandler is auto-imported in the Nitro server context
  // (provided by nitropack). Cast its handler signature to keep TS happy
  // when the auto-import isn't visible to vue-tsc.
  const innerCached = (
    defineCachedEventHandler as unknown as (
      h: (event: H3Event) => Promise<T> | T,
      o: Record<string, unknown>
    ) => EventHandler
  )(
    async (event: H3Event) => {
      // The inner handler only runs on a miss — flag it so the outer
      // wrapper's optimistic `true` gets corrected.
      event.context.cacheHit = false
      return handler(event)
    },
    {
      maxAge,
      staleMaxAge: options.staleMaxAge ?? maxAge * 2,
      base: options.base ?? 'cache',
      name: options.name,
      getKey: options.getKey
    }
  )

  return defineEventHandler(async (event) => {
    // Optimistic: assume cache hit; the inner handler will reset to false
    // when it actually runs.
    event.context.cacheHit = true
    return innerCached(event)
  })
}
