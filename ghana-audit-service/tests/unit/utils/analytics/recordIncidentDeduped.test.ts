import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  recordIncidentDeduped,
  __resetIncidentDedupForTests,
  __getIncidentDedupSizeForTests
} from '../../../../server/utils/analytics/recordIncidentDeduped'
import type { NewAbuseIncident } from '../../../../server/database/schema/analytics'

// Mock the underlying recordIncident so we can count its invocations,
// and getRedis so each test controls Redis presence + responses. Both
// modules are imported by recordIncidentDeduped lazily through the
// barrel; the mocks are hoisted by Vitest's transformer.

const insertSpy = vi.fn()
const setSpy = vi.fn<(...args: unknown[]) => Promise<string | null>>()

vi.mock('../../../../server/utils/analytics/recordIncident', () => ({
  recordIncident: (input: NewAbuseIncident) => insertSpy(input)
}))

let mockRedisAvailable = true
vi.mock('../../../../server/utils/redis', () => ({
  getRedis: () => (mockRedisAvailable ? { set: setSpy } : null)
}))

function makeIncident(overrides: Partial<NewAbuseIncident> = {}): NewAbuseIncident {
  return {
    kind: 'fuzz_attempt',
    severity: 'warning',
    ipHash: 'a'.repeat(64),
    uaHash: 'b'.repeat(64),
    routePattern: '/api/reports',
    routePath: '/api/reports?search=...',
    details: { source: 'query' },
    ...overrides
  }
}

async function flush() {
  // recordIncidentDeduped fire-and-forgets via void async IIFE.
  await new Promise((r) => setImmediate(r))
}

describe('analytics/recordIncidentDeduped', () => {
  beforeEach(() => {
    insertSpy.mockReset()
    setSpy.mockReset()
    __resetIncidentDedupForTests()
    mockRedisAvailable = true
  })

  describe('Redis backend', () => {
    it('records when SET NX returns OK', async () => {
      setSpy.mockResolvedValueOnce('OK')
      recordIncidentDeduped(makeIncident(), 'pattern:sqli', 300)
      await flush()
      expect(setSpy).toHaveBeenCalledTimes(1)
      expect(insertSpy).toHaveBeenCalledTimes(1)
    })

    it('does NOT record when SET NX returns null (key already exists)', async () => {
      setSpy.mockResolvedValueOnce(null)
      recordIncidentDeduped(makeIncident(), 'pattern:sqli', 300)
      await flush()
      expect(setSpy).toHaveBeenCalledTimes(1)
      expect(insertSpy).not.toHaveBeenCalled()
    })

    it('passes the correct Redis args', async () => {
      setSpy.mockResolvedValueOnce('OK')
      recordIncidentDeduped(
        makeIncident({ kind: 'probing_path', ipHash: 'h'.repeat(64) }),
        '/wp-login.php',
        600
      )
      await flush()
      expect(setSpy).toHaveBeenCalledWith(
        `incident-dedup:probing_path:${'h'.repeat(64)}:/wp-login.php`,
        '1',
        'EX',
        600,
        'NX'
      )
    })

    it('uses "none" in the key when ipHash is null', async () => {
      setSpy.mockResolvedValueOnce('OK')
      recordIncidentDeduped(makeIncident({ ipHash: null }), 'k', 60)
      await flush()
      const callArgs = setSpy.mock.calls[0]
      expect(callArgs[0]).toMatch(/^incident-dedup:fuzz_attempt:none:k$/)
    })

    it('falls back to memory backend when Redis throws', async () => {
      setSpy.mockRejectedValueOnce(new Error('connection refused'))
      recordIncidentDeduped(makeIncident(), 'pattern:sqli', 300)
      await flush()
      // Redis attempted once, then memory fallback recorded.
      expect(setSpy).toHaveBeenCalledTimes(1)
      expect(insertSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Memory backend (no Redis configured)', () => {
    beforeEach(() => {
      mockRedisAvailable = false
    })

    it('records on first call', async () => {
      recordIncidentDeduped(makeIncident(), 'pattern:sqli', 300)
      await flush()
      expect(insertSpy).toHaveBeenCalledTimes(1)
    })

    it('suppresses duplicate within the TTL window', async () => {
      recordIncidentDeduped(makeIncident(), 'pattern:sqli', 300)
      recordIncidentDeduped(makeIncident(), 'pattern:sqli', 300)
      recordIncidentDeduped(makeIncident(), 'pattern:sqli', 300)
      await flush()
      expect(insertSpy).toHaveBeenCalledTimes(1)
    })

    it('distinguishes by ipHash', async () => {
      recordIncidentDeduped(makeIncident({ ipHash: 'a'.repeat(64) }), 'pattern:sqli', 300)
      recordIncidentDeduped(makeIncident({ ipHash: 'b'.repeat(64) }), 'pattern:sqli', 300)
      await flush()
      expect(insertSpy).toHaveBeenCalledTimes(2)
    })

    it('distinguishes by dedupKey', async () => {
      recordIncidentDeduped(makeIncident(), 'pattern:sqli', 300)
      recordIncidentDeduped(makeIncident(), 'pattern:xss', 300)
      await flush()
      expect(insertSpy).toHaveBeenCalledTimes(2)
    })

    it('distinguishes by kind', async () => {
      recordIncidentDeduped(makeIncident({ kind: 'fuzz_attempt' }), 'k', 300)
      recordIncidentDeduped(makeIncident({ kind: 'probing_path' }), 'k', 300)
      await flush()
      expect(insertSpy).toHaveBeenCalledTimes(2)
    })

    it('re-records once the TTL elapses', async () => {
      // Real-time wait of 50ms. Stable on any CI: setImmediate isn't
      // faked here so flush() resolves cleanly, and the LRU's expiresAt
      // check uses Date.now().
      recordIncidentDeduped(makeIncident(), 'pattern:sqli', 0.05)
      await flush()
      expect(insertSpy).toHaveBeenCalledTimes(1)

      await new Promise((r) => setTimeout(r, 60))

      recordIncidentDeduped(makeIncident(), 'pattern:sqli', 0.05)
      await flush()
      expect(insertSpy).toHaveBeenCalledTimes(2)
    })

    it('keeps the LRU bounded as keys are added', async () => {
      // Push 5050 distinct keys past the 5000-entry cap. The Map's size
      // must stay <= cap; every call is still a fresh key so every one
      // records.
      for (let i = 0; i < 5050; i++) {
        recordIncidentDeduped(makeIncident(), `key-${i}`, 300)
      }
      await flush()
      expect(__getIncidentDedupSizeForTests()).toBeLessThanOrEqual(5000)
      expect(insertSpy).toHaveBeenCalledTimes(5050)
    })
  })
})
