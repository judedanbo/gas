import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineAnalyticsCachedHandler } from '../../../../server/utils/analytics/cached'

/**
 * The wrapper composes two Nitro auto-imports (defineEventHandler +
 * defineCachedEventHandler) which aren't available in vitest's bare
 * context. We stub them globally with the contract the wrapper relies on,
 * then verify the wrapper's state-machine matches.
 *
 * Stubs are installed in beforeEach (not at module top-level) because the
 * wrapper resolves the globals lazily — only when defineAnalyticsCachedHandler
 * is actually called — so this ordering works without breaking
 * `import/first`.
 *
 * Contract we model:
 *   - defineEventHandler(fn) returns the function unchanged.
 *   - defineCachedEventHandler(fn, opts) returns a function that, when
 *     invoked, either:
 *       a) on cache miss: calls `fn` and remembers the return value
 *       b) on cache hit:  returns the remembered value WITHOUT calling fn
 *     The per-test toggle `cacheState` flips between the two.
 */

type EventCtx = { cacheHit?: boolean }
type FakeEvent = { context: EventCtx }
type Handler = (e: FakeEvent) => unknown

let cacheState: 'miss' | 'hit'
const innerCalls: Array<FakeEvent> = []

beforeEach(() => {
  cacheState = 'miss'
  innerCalls.length = 0
  vi.stubGlobal('defineEventHandler', (fn: Handler) => fn)
  vi.stubGlobal('defineCachedEventHandler', (fn: Handler) => {
    let cached: unknown = undefined
    return async (event: FakeEvent) => {
      if (cacheState === 'hit' && cached !== undefined) {
        return cached
      }
      innerCalls.push(event)
      const result = await fn(event)
      cached = result
      return result
    }
  })
})

describe('analytics/cached', () => {
  it('flags cacheHit=false on the first call (miss path runs the inner handler)', async () => {
    const handler = defineAnalyticsCachedHandler(async () => ({ ok: true })) as (
      e: FakeEvent
    ) => Promise<unknown>
    const event: FakeEvent = { context: {} }
    const result = await handler(event)
    expect(result).toEqual({ ok: true })
    expect(event.context.cacheHit).toBe(false)
    expect(innerCalls).toHaveLength(1)
  })

  it('flags cacheHit=true when Nitro serves from cache (inner handler skipped)', async () => {
    const handler = defineAnalyticsCachedHandler(async () => ({ ok: true })) as (
      e: FakeEvent
    ) => Promise<unknown>
    // Prime the cache.
    await handler({ context: {} })

    // Flip to "hit" — the inner handler should be skipped.
    cacheState = 'hit'
    const event: FakeEvent = { context: {} }
    const result = await handler(event)
    expect(result).toEqual({ ok: true })
    expect(event.context.cacheHit).toBe(true)
    expect(innerCalls).toHaveLength(1)
  })

  it('passes the inner handler return value through on miss', async () => {
    const handler = defineAnalyticsCachedHandler(async () => ({
      data: [1, 2, 3]
    })) as (e: FakeEvent) => Promise<{ data: number[] }>
    const event: FakeEvent = { context: {} }
    const result = await handler(event)
    expect(result.data).toEqual([1, 2, 3])
  })

  it('default cacheHit is set even when the inner handler throws', async () => {
    const handler = defineAnalyticsCachedHandler<unknown>(async () => {
      throw new Error('boom')
    }) as (e: FakeEvent) => Promise<unknown>
    const event: FakeEvent = { context: {} }
    await expect(handler(event)).rejects.toThrow('boom')
    expect(event.context.cacheHit).toBe(false)
  })
})
