import { describe, it, expect } from 'vitest'
import {
  PAGE_CACHE_NAME,
  cspNonce,
  isPageCacheRule,
  pageCacheRule,
  swapNonce
} from '../../../../server/utils/pageCache'

describe('pageCacheRule', () => {
  it('emits a Nitro stale-while-revalidate cache rule marked as a page cache', () => {
    expect(pageCacheRule(600)).toEqual({
      cache: { name: PAGE_CACHE_NAME, maxAge: 600, swr: true }
    })
  })
})

describe('isPageCacheRule', () => {
  it('recognises page cache rules', () => {
    expect(isPageCacheRule(pageCacheRule(3600))).toBe(true)
    // Merged with the `/**` header rule, as getRouteRules returns it
    const merged = { ...pageCacheRule(600), headers: { 'X-Frame-Options': 'SAMEORIGIN' } }
    expect(isPageCacheRule(merged)).toBe(true)
  })

  it('ignores other cached routes and uncached ones', () => {
    // /api/** and /admin/** cache rules carry no page-cache name
    expect(isPageCacheRule({ cache: { maxAge: 300, staleMaxAge: 600 } })).toBe(false)
    expect(isPageCacheRule({ cache: false })).toBe(false)
    expect(isPageCacheRule({ isr: 600 })).toBe(false)
    expect(isPageCacheRule({})).toBe(false)
    expect(isPageCacheRule(undefined)).toBe(false)
  })
})

describe('cspNonce', () => {
  it('extracts the nonce source from a CSP header value', () => {
    const csp =
      "default-src 'self'; script-src 'self' 'nonce-5OaJm4MQQMT+OHmgp/gMbpID'; object-src 'none';"
    expect(cspNonce(csp)).toBe('5OaJm4MQQMT+OHmgp/gMbpID')
  })

  it('returns undefined without a nonce or a string header', () => {
    expect(cspNonce("default-src 'self'")).toBeUndefined()
    expect(cspNonce(undefined)).toBeUndefined()
    expect(cspNonce(['a', 'b'])).toBeUndefined()
  })
})

describe('swapNonce', () => {
  const rendered = 'l53EgCRmzSXhaUwLsuuQnbgv'
  const fresh = 'Zq0+9b/aXc1d2E3f4G5h6I7j'

  it('re-keys every nonce occurrence in cached HTML', () => {
    const html = [
      `<link nonce="${rendered}" rel="stylesheet" href="/_nuxt/entry.css">`,
      `<script nonce="${rendered}" type="importmap">{}</script>`,
      `<script nonce="${rendered}" type="application/json" data-nuxt-data="nuxt-app">[]</script>`
    ].join('')

    const out = swapNonce(html, rendered, fresh)

    expect(out).not.toContain(rendered)
    expect(out.match(/nonce="[^"]*"/g)).toEqual(Array(3).fill(`nonce="${fresh}"`))
    expect(out.length).toBe(html.length)
  })

  it('re-keys the CSP header', () => {
    expect(swapNonce(`script-src 'self' 'nonce-${rendered}';`, rendered, fresh)).toBe(
      `script-src 'self' 'nonce-${fresh}';`
    )
  })
})
