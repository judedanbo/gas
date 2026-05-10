import { describe, it, expect } from 'vitest'
import {
  scoreSignature,
  effectiveClassification,
  type ScoreSnapshot
} from '../../../../server/utils/analytics/score'

function snapshot(overrides: Partial<ScoreSnapshot> = {}): ScoreSnapshot {
  return {
    uaFamily: 'browser',
    totalRequests24h: 10,
    distinctRoutes24h: 5,
    rateLimitHits24h: 0,
    probingHits24h: 0,
    failedLogins24h: 0,
    downloads24h: 0,
    asn: null,
    ...overrides
  }
}

describe('analytics/score', () => {
  describe('scoreSignature', () => {
    it('classifies a normal browser as clean', () => {
      const r = scoreSignature(snapshot({ uaFamily: 'browser' }))
      expect(r.score).toBe(0)
      expect(r.classification).toBe('clean')
      expect(r.reasons).toEqual([])
    })

    it('marks known crawlers as crawler with +10', () => {
      const r = scoreSignature(snapshot({ uaFamily: 'crawler' }))
      expect(r.score).toBe(10)
      expect(r.classification).toBe('crawler')
      expect(r.reasons[0]).toMatch(/known_crawler_ua/)
    })

    it('a scripted UA alone is suspicious', () => {
      const r = scoreSignature(snapshot({ uaFamily: 'script' }))
      expect(r.score).toBe(30)
      expect(r.classification).toBe('crawler')
    })

    it('script UA + crawl signature crosses into suspicious', () => {
      const r = scoreSignature(snapshot({ uaFamily: 'script', distinctRoutes24h: 60 }))
      expect(r.score).toBe(55)
      expect(r.classification).toBe('suspicious')
    })

    it('a probing-path hit alone is suspicious by score (50)', () => {
      const r = scoreSignature(snapshot({ probingHits24h: 1 }))
      expect(r.score).toBe(50)
      expect(r.classification).toBe('suspicious')
    })

    it('probing + scripted + rate-limit hits is abusive', () => {
      const r = scoreSignature(
        snapshot({
          uaFamily: 'script',
          probingHits24h: 1,
          rateLimitHits24h: 3
        })
      )
      // 30 + 50 + 20 = 100
      expect(r.score).toBe(100)
      expect(r.classification).toBe('abusive')
    })

    it('credential pressure (5+ failed logins) adds +40', () => {
      const r = scoreSignature(snapshot({ failedLogins24h: 5 }))
      expect(r.score).toBe(40)
      expect(r.classification).toBe('suspicious')
    })

    it('credential pressure under threshold does not score', () => {
      const r = scoreSignature(snapshot({ failedLogins24h: 4 }))
      expect(r.score).toBe(0)
    })

    it('download burst (>10) adds +20', () => {
      const r = scoreSignature(snapshot({ downloads24h: 11 }))
      expect(r.score).toBe(20)
      expect(r.classification).toBe('crawler')
    })

    it('hosting ASN adds +5 (DigitalOcean)', () => {
      const r = scoreSignature(snapshot({ asn: 14061 }))
      expect(r.score).toBe(5)
      expect(r.classification).toBe('clean')
      expect(r.reasons).toEqual(expect.arrayContaining([expect.stringMatching(/^hosting_asn/)]))
    })

    it('non-hosting ASN does not add to score (Ghanaian ISP)', () => {
      const r = scoreSignature(snapshot({ asn: 37339 }))
      expect(r.score).toBe(0)
    })

    it('hosting ASN tips a scripted UA into suspicious', () => {
      const r = scoreSignature(snapshot({ uaFamily: 'script', asn: 16509 }))
      // 30 (script) + 5 (hosting AWS) = 35 → suspicious threshold
      expect(r.score).toBe(35)
      expect(r.classification).toBe('suspicious')
    })

    it('empty UA + crawl signature reaches suspicious', () => {
      const r = scoreSignature(snapshot({ uaFamily: 'empty', distinctRoutes24h: 100 }))
      // 25 + 25 = 50
      expect(r.score).toBe(50)
      expect(r.classification).toBe('suspicious')
    })

    it('threshold buckets: 0→clean, 10→crawler, 50→suspicious, 75→abusive', () => {
      expect(scoreSignature(snapshot({ uaFamily: 'browser' })).classification).toBe('clean') // 0
      expect(scoreSignature(snapshot({ uaFamily: 'crawler' })).classification).toBe('crawler') // 10
      expect(scoreSignature(snapshot({ uaFamily: 'script' })).classification).toBe('crawler') // 30
      expect(
        scoreSignature(snapshot({ uaFamily: 'script', rateLimitHits24h: 1 })).classification
      ).toBe('suspicious') // 50
      const high = scoreSignature(
        snapshot({ uaFamily: 'script', distinctRoutes24h: 60, rateLimitHits24h: 1 })
      )
      expect(high.score).toBe(75)
      expect(high.classification).toBe('abusive')
    })

    it('returns reasons matching the signals that fired', () => {
      const r = scoreSignature(
        snapshot({
          uaFamily: 'crawler',
          distinctRoutes24h: 51,
          downloads24h: 11
        })
      )
      expect(r.reasons).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^known_crawler_ua/),
          expect.stringMatching(/^crawl_signature/),
          expect.stringMatching(/^download_burst/)
        ])
      )
    })
  })

  describe('effectiveClassification', () => {
    it('safe-allowlist override wins over auto-computed abusive', () => {
      expect(effectiveClassification('safe-allowlist', 'abusive')).toBe('safe-allowlist')
    })

    it('abusive override wins over auto-computed clean', () => {
      expect(effectiveClassification('abusive', 'clean')).toBe('abusive')
    })

    it('null/undefined override falls through to auto', () => {
      expect(effectiveClassification(null, 'crawler')).toBe('crawler')
      expect(effectiveClassification(undefined, 'suspicious')).toBe('suspicious')
    })

    it('non-special override (e.g. "clean") still falls through to auto', () => {
      // Only 'safe-allowlist' and 'abusive' are sticky overrides.
      expect(effectiveClassification('clean', 'abusive')).toBe('abusive')
    })
  })
})
