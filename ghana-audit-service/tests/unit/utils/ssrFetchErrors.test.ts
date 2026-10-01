import { describe, it, expect } from 'vitest'
import { hasTransientFetchError, isTransientFetchError } from '../../../utils/ssrFetchErrors'

describe('isTransientFetchError', () => {
  it('treats server errors and status-less failures as transient', () => {
    expect(isTransientFetchError({ statusCode: 500 })).toBe(true)
    expect(isTransientFetchError({ statusCode: 503, statusMessage: 'Service Unavailable' })).toBe(
      true
    )
    expect(isTransientFetchError({ status: 502 })).toBe(true)
    // internal SSR calls share the rate limiter's `unknown` bucket
    expect(isTransientFetchError({ statusCode: 429 })).toBe(true)
    // e.g. a network failure that never got an HTTP response
    expect(isTransientFetchError(new Error('fetch failed'))).toBe(true)
  })

  it('treats client errors as stable answers', () => {
    expect(isTransientFetchError({ statusCode: 404 })).toBe(false)
    expect(isTransientFetchError({ statusCode: 400 })).toBe(false)
    expect(isTransientFetchError({ status: 410 })).toBe(false)
  })

  it('ignores empty error slots', () => {
    // Nuxt initialises payload._errors entries to null/undefined
    expect(isTransientFetchError(null)).toBe(false)
    expect(isTransientFetchError(undefined)).toBe(false)
  })
})

describe('hasTransientFetchError', () => {
  it('scans a payload _errors map', () => {
    expect(hasTransientFetchError(undefined)).toBe(false)
    expect(hasTransientFetchError({ 'site-stats': null, 'hero-slideshow': undefined })).toBe(false)
    expect(hasTransientFetchError({ 'site-stats': null, report: { statusCode: 404 } })).toBe(false)
    expect(
      hasTransientFetchError({ 'site-stats': { statusCode: 500 }, report: { statusCode: 404 } })
    ).toBe(true)
  })
})
