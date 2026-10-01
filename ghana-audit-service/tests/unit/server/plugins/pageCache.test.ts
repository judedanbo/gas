import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import {
  createEvent,
  getResponseHeader,
  getResponseStatus,
  setCookie,
  setResponseHeader,
  setResponseStatus
} from 'h3'
import type { H3Event } from 'h3'
import type { NitroApp, NitroRouteRules } from 'nitropack/types'
import { logWarn } from '~/server/utils/logger'
import { BYPASS_HEADER, BYPASS_STATUS, pageCacheRule } from '~/server/utils/pageCache'

// getRouteRules resolves the merged rules for the request path; tests set them directly.
const rules = vi.hoisted(() => ({ current: {} as NitroRouteRules }))

vi.mock('nitropack/runtime', () => ({
  getRouteRules: () => rules.current
}))

vi.mock('~/server/utils/logger', () => ({
  logWarn: vi.fn()
}))

interface RenderResponse {
  statusCode?: number
  headers?: Record<string, string>
  body?: unknown
}
type RenderResponseHook = (response: RenderResponse, context: { event: H3Event }) => void
type BeforeResponseHook = (event: H3Event, response: { body?: unknown }) => void

let installPlugin: (nitroApp: NitroApp) => void
let renderResponse: RenderResponseHook
let beforeResponse: BeforeResponseHook

beforeAll(async () => {
  vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)
  installPlugin = (await import('~/server/plugins/pageCache')).default
})

beforeEach(() => {
  rules.current = pageCacheRule(600)
  const hooks = new Map<string, unknown>()
  const fakeNitroApp = { hooks: { hook: (name: string, fn: unknown) => hooks.set(name, fn) } }
  installPlugin(fakeNitroApp as unknown as NitroApp)
  renderResponse = hooks.get('render:response') as RenderResponseHook
  beforeResponse = hooks.get('beforeResponse') as BeforeResponseHook
})

function makeEvent(path = '/'): H3Event {
  const req = new IncomingMessage(new Socket())
  req.url = path
  req.method = 'GET'
  return createEvent(req, new ServerResponse(req))
}

const RENDERED = 'l53EgCRmzSXhaUwLsuuQnbgv' // nonce baked into the cached copy
const FRESH = '5OaJm4MQQMT+OHmgp/gMbpID' // this request's nonce (nuxt-security)

/** Outgoing response the way Nitro's cached handler leaves it before beforeResponse. */
function cachedResponse(event: H3Event) {
  setResponseHeader(event, 'Content-Security-Policy', `script-src 'self' 'nonce-${RENDERED}';`)
  setResponseHeader(event, 'cache-control', 's-maxage=600, stale-while-revalidate')
  setResponseHeader(event, 'etag', 'W/"cached"')
  setResponseHeader(event, 'last-modified', 'Thu, 01 Oct 2026 14:00:00 GMT')
  return {
    body: `<link nonce="${RENDERED}" rel="stylesheet"><script nonce="${RENDERED}">init()</script>`
  }
}

describe('pageCache plugin — beforeResponse', () => {
  it('re-keys a cached copy to the nonce of this request, in header and HTML alike', () => {
    const event = makeEvent('/')
    event.context.security = { nonce: FRESH }
    const response = cachedResponse(event)

    beforeResponse(event, response)

    expect(getResponseHeader(event, 'content-security-policy')).toBe(
      `script-src 'self' 'nonce-${FRESH}';`
    )
    expect(response.body).toBe(
      `<link nonce="${FRESH}" rel="stylesheet"><script nonce="${FRESH}">init()</script>`
    )
    expect(event.context.cacheHit).toBe(true)
  })

  it('keeps cached pages out of shared caches and drops validators', () => {
    const event = makeEvent('/reports')
    event.context.security = { nonce: FRESH }

    beforeResponse(event, cachedResponse(event))

    expect(getResponseHeader(event, 'cache-control')).toBe('private, no-cache')
    expect(getResponseHeader(event, 'etag')).toBeUndefined()
    expect(getResponseHeader(event, 'last-modified')).toBeUndefined()
  })

  it('leaves a render made for this request as is and records a miss', () => {
    const event = makeEvent('/')
    event.context.security = { nonce: RENDERED }
    event.context.pageCacheRendered = true
    const response = cachedResponse(event)
    const html = response.body

    beforeResponse(event, response)

    expect(response.body).toBe(html)
    expect(getResponseHeader(event, 'content-security-policy')).toContain(`'nonce-${RENDERED}'`)
    expect(event.context.cacheHit).toBe(false)
  })

  it('restores the real status of a render the cache was told not to store', () => {
    const ok = makeEvent('/')
    setResponseStatus(ok, BYPASS_STATUS)
    setResponseHeader(ok, BYPASS_HEADER, '200')
    beforeResponse(ok, { body: '<html></html>' })
    expect(getResponseStatus(ok)).toBe(200)
    expect(getResponseHeader(ok, BYPASS_HEADER)).toBeUndefined()

    const notFound = makeEvent('/reports/missing')
    setResponseStatus(notFound, BYPASS_STATUS)
    setResponseHeader(notFound, BYPASS_HEADER, '404')
    beforeResponse(notFound, { body: '<html></html>' })
    expect(getResponseStatus(notFound)).toBe(404)
  })

  it('does not count a middleware short-circuit as a cache hit', () => {
    const event = makeEvent('/')
    setResponseStatus(event, 429) // rate limiter answered before the page handler ran
    beforeResponse(event, { body: { statusCode: 429 } })

    expect(event.context.cacheHit).toBe(false)
  })

  it('leaves other cached routes alone', () => {
    rules.current = { cache: { maxAge: 300, staleMaxAge: 600 } } // e.g. /api/news/**
    const event = makeEvent('/api/news')
    event.context.security = { nonce: FRESH }
    const response = cachedResponse(event)
    const body = response.body

    beforeResponse(event, response)

    expect(response.body).toBe(body)
    expect(getResponseHeader(event, 'cache-control')).toBe('s-maxage=600, stale-while-revalidate')
    expect(getResponseHeader(event, 'etag')).toBe('W/"cached"')
    expect(event.context.cacheHit).toBeUndefined()
  })
})

describe('pageCache plugin — render:response', () => {
  it('lets a clean render be cached', () => {
    const event = makeEvent('/')
    const response: RenderResponse = { statusCode: 200, headers: { 'content-type': 'text/html' } }

    renderResponse(response, { event })

    expect(response.statusCode).toBe(200)
    expect(response.headers).not.toHaveProperty(BYPASS_HEADER)
    expect(event.context.pageCacheRendered).toBe(true)
  })

  it('hands a render with a failed data fetch to the cache as a non-storable status', () => {
    const event = makeEvent('/about/the-service')
    event.context.ssrFetchFailed = true
    const response: RenderResponse = { statusCode: 200, headers: { 'content-type': 'text/html' } }

    renderResponse(response, { event })

    expect(response.statusCode).toBe(BYPASS_STATUS)
    expect(response.headers?.[BYPASS_HEADER]).toBe('200')
    expect(logWarn).toHaveBeenCalledWith(
      'pageCache',
      'not caching /about/the-service: a data fetch failed during SSR'
    )
  })

  it('does not cache a render that set a cookie', () => {
    const viaEvent = makeEvent('/')
    setCookie(viaEvent, 'gas_locale', 'ak')
    const first: RenderResponse = { statusCode: 200, headers: {} }
    renderResponse(first, { event: viaEvent })
    expect(first.statusCode).toBe(BYPASS_STATUS)

    const viaResponse: RenderResponse = { statusCode: 302, headers: { 'Set-Cookie': 'a=b' } }
    renderResponse(viaResponse, { event: makeEvent('/') })
    expect(viaResponse.statusCode).toBe(BYPASS_STATUS)
    expect(viaResponse.headers?.[BYPASS_HEADER]).toBe('302')
  })

  it('warns at most once a minute per reason', () => {
    vi.useFakeTimers()
    try {
      for (let i = 0; i < 3; i++) {
        const event = makeEvent('/')
        event.context.ssrFetchFailed = true
        renderResponse({ statusCode: 200, headers: {} }, { event })
      }
      expect(logWarn).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(60_000)
      const event = makeEvent('/')
      event.context.ssrFetchFailed = true
      renderResponse({ statusCode: 200, headers: {} }, { event })
      expect(logWarn).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores renders of routes that are not page-cached', () => {
    rules.current = { cache: { maxAge: 60, staleMaxAge: 120 } } // /admin/**
    const event = makeEvent('/admin/login')
    event.context.ssrFetchFailed = true
    const response: RenderResponse = { statusCode: 200, headers: {} }

    renderResponse(response, { event })

    expect(response.statusCode).toBe(200)
    expect(event.context.pageCacheRendered).toBeUndefined()
  })

  it('round-trips a skipped render to the visitor with its real status', () => {
    // render:response runs on Nitro's render event; the cache layer then copies
    // the (unstored) response's status and headers onto the request's response.
    const renderEvent = makeEvent('/')
    renderEvent.context.ssrFetchFailed = true
    const response: RenderResponse = { statusCode: 200, headers: { 'content-type': 'text/html' } }
    renderResponse(response, { event: renderEvent })

    const event = makeEvent('/')
    setResponseStatus(event, response.statusCode)
    for (const [name, value] of Object.entries(response.headers ?? {})) {
      setResponseHeader(event, name, value)
    }
    beforeResponse(event, { body: '<html></html>' })

    expect(getResponseStatus(event)).toBe(200)
    expect(getResponseHeader(event, BYPASS_HEADER)).toBeUndefined()
    expect(getResponseHeader(event, 'cache-control')).toBe('private, no-cache')
  })
})
