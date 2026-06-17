import { describe, it, expect, beforeEach } from 'vitest'
import {
  hashIp,
  hashUa,
  classifyUa,
  normaliseRoutePattern,
  parseReferrerHost,
  isIpAnonymizedRoute,
  __resetIpSaltForTests
} from '../../../../server/utils/analytics/fingerprint'

describe('analytics/fingerprint', () => {
  beforeEach(() => {
    process.env.ANALYTICS_IP_SALT = 'test-salt-do-not-use-in-prod'
    __resetIpSaltForTests()
  })

  describe('hashIp', () => {
    it('returns a 64-char hex sha256', () => {
      const h = hashIp('203.0.113.1')
      expect(h).toMatch(/^[0-9a-f]{64}$/)
    })

    it('is deterministic for the same salt + IP', () => {
      expect(hashIp('203.0.113.1')).toBe(hashIp('203.0.113.1'))
    })

    it('differs for different IPs', () => {
      expect(hashIp('203.0.113.1')).not.toBe(hashIp('203.0.113.2'))
    })

    it('changes when the salt rotates', () => {
      const before = hashIp('203.0.113.1')
      process.env.ANALYTICS_IP_SALT = 'another-salt'
      __resetIpSaltForTests()
      const after = hashIp('203.0.113.1')
      expect(before).not.toBe(after)
    })
  })

  describe('hashUa', () => {
    it('returns a 64-char hex sha256', () => {
      expect(hashUa('Mozilla/5.0')).toMatch(/^[0-9a-f]{64}$/)
    })

    it('produces the same hash regardless of salt (UA is unsalted)', () => {
      const before = hashUa('curl/7.85.0')
      process.env.ANALYTICS_IP_SALT = 'rotated'
      __resetIpSaltForTests()
      expect(hashUa('curl/7.85.0')).toBe(before)
    })
  })

  describe('classifyUa', () => {
    it('classifies empty / minimal UAs as empty', () => {
      expect(classifyUa('').family).toBe('empty')
      expect(classifyUa('  ').family).toBe('empty')
      expect(classifyUa('-').family).toBe('empty')
      expect(classifyUa('foo').family).toBe('empty') // length < 5
      expect(classifyUa(null).family).toBe('empty')
      expect(classifyUa(undefined).family).toBe('empty')
    })

    it('flags known crawlers', () => {
      const cases = [
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)',
        'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
        'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/bot)',
        'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'
      ]
      for (const ua of cases) {
        expect(classifyUa(ua)).toEqual({ family: 'crawler', isKnownBot: true })
      }
    })

    it('flags known scripted clients', () => {
      const cases = [
        'python-requests/2.31.0',
        'curl/7.85.0',
        'Wget/1.21.3',
        'Go-http-client/1.1',
        'axios/1.4.0',
        'okhttp/4.10.0',
        'Java/17.0.6',
        'Python/3.11 aiohttp/3.8.5'
      ]
      for (const ua of cases) {
        expect(classifyUa(ua)).toEqual({ family: 'script', isKnownBot: true })
      }
    })

    it('classifies typical browser UAs as browser', () => {
      const ua =
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      expect(classifyUa(ua)).toEqual({ family: 'browser', isKnownBot: false })
    })

    it('falls back to unknown for things that don’t match any rule', () => {
      // Real-world example: a custom embedded HTTP client that doesn't begin
      // with Mozilla/5.0 and isn't on the script allowlist.
      expect(classifyUa('AcmeFetcher/1.2 contact@example.com').family).toBe('unknown')
    })
  })

  describe('normaliseRoutePattern', () => {
    it('passes through static paths unchanged', () => {
      expect(normaliseRoutePattern('/about/management-team')).toBe('/about/management-team')
      expect(normaliseRoutePattern('/')).toBe('/')
      expect(normaliseRoutePattern('/reports')).toBe('/reports')
    })

    it('collapses numeric ID segments', () => {
      expect(normaliseRoutePattern('/api/reports/123')).toBe('/api/reports/[id]')
      expect(normaliseRoutePattern('/api/publications/45/related')).toBe(
        '/api/publications/[id]/related'
      )
      expect(normaliseRoutePattern('/reports/789')).toBe('/reports/[id]')
    })

    it('collapses 24-char hex and UUID segments', () => {
      expect(normaliseRoutePattern('/admin/users/507f1f77bcf86cd799439011')).toBe(
        '/admin/users/[id]'
      )
      expect(normaliseRoutePattern('/admin/users/3d4f8e2c-1234-5678-90ab-cdef01234567/edit')).toBe(
        '/admin/users/[uuid]/edit'
      )
    })

    it('collapses known slug routes', () => {
      expect(normaliseRoutePattern('/news/some-article-title')).toBe('/news/[slug]')
      expect(normaliseRoutePattern('/api/news/another-article')).toBe('/api/news/[slug]')
      expect(normaliseRoutePattern('/publications/some-pub')).toBe('/publications/[slug]')
    })

    it('collapses /ak locale prefix', () => {
      expect(normaliseRoutePattern('/ak/reports/123')).toBe('/[locale]/reports/[id]')
      expect(normaliseRoutePattern('/ak/news/some-article')).toBe('/[locale]/news/[slug]')
    })

    it('strips query strings and trailing slashes', () => {
      expect(normaliseRoutePattern('/reports/?page=2')).toBe('/reports')
      expect(normaliseRoutePattern('/reports/123?download=1')).toBe('/reports/[id]')
    })

    it('truncates excessively long patterns to 256 chars', () => {
      const long = '/a' + '/very-long-segment'.repeat(20)
      expect(normaliseRoutePattern(long).length).toBeLessThanOrEqual(256)
    })
  })

  describe('parseReferrerHost', () => {
    it('returns just the hostname', () => {
      expect(parseReferrerHost('https://google.com/search?q=ghana+audit')).toBe('google.com')
      expect(parseReferrerHost('https://www.audit.gov.gh/reports/123')).toBe('www.audit.gov.gh')
    })

    it('returns null for null / empty / malformed', () => {
      expect(parseReferrerHost(null)).toBeNull()
      expect(parseReferrerHost(undefined)).toBeNull()
      expect(parseReferrerHost('')).toBeNull()
      expect(parseReferrerHost('not-a-url')).toBeNull()
    })

    it('caps hostnames at 128 chars', () => {
      const longHost = 'a'.repeat(200) + '.example.com'
      const result = parseReferrerHost(`https://${longHost}/`)
      expect(result).not.toBeNull()
      expect(result!.length).toBeLessThanOrEqual(128)
    })
  })

  describe('isIpAnonymizedRoute (CitizensEye carve-out)', () => {
    it('matches the /citizenseye prefix and its sub-paths', () => {
      expect(isIpAnonymizedRoute('/citizenseye')).toBe(true)
      expect(isIpAnonymizedRoute('/citizenseye/privacy')).toBe(true)
    })

    it('matches the locale-prefixed form emitted by normaliseRoutePattern', () => {
      expect(isIpAnonymizedRoute(normaliseRoutePattern('/ak/citizenseye'))).toBe(true)
      expect(isIpAnonymizedRoute('/[locale]/citizenseye/privacy')).toBe(true)
    })

    it('does not match unrelated routes (raw IP must be stored)', () => {
      expect(isIpAnonymizedRoute('/')).toBe(false)
      expect(isIpAnonymizedRoute('/contact')).toBe(false)
      expect(isIpAnonymizedRoute('/api/reports/[id]')).toBe(false)
      // No false-positive on a route that merely starts with the same letters.
      expect(isIpAnonymizedRoute('/citizenseye-news')).toBe(false)
    })
  })
})
