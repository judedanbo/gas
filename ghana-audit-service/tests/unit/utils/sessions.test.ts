import { describe, it, expect } from 'vitest'
import { evaluateSession } from '../../../server/utils/sessions'

const IDLE = 30 * 60_000 // 30m
const WARN = 2 * 60_000 // 2m

function row(overrides: Partial<Parameters<typeof evaluateSession>[0]> = {}) {
  const now = Date.now()
  return {
    createdAt: new Date(now - 60_000),
    lastActivityAt: new Date(now - 60_000),
    absoluteExpiresAt: new Date(now + 8 * 3_600_000),
    revokedAt: null,
    ...overrides
  }
}

describe('evaluateSession', () => {
  it('accepts a live session and reports timing', () => {
    const now = Date.now()
    const res = evaluateSession(row(), now, IDLE, WARN)
    expect(res.ok).toBe(true)
    expect(res.timing?.warningBeforeMs).toBe(WARN)
    // Soonest expiry is the idle window (lastActivity + 30m), not the 8h cap.
    expect(Date.parse(res.timing!.expiresAt)).toBe(now - 60_000 + IDLE)
  })

  it('rejects a revoked session', () => {
    const res = evaluateSession(row({ revokedAt: new Date() }), Date.now(), IDLE, WARN)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('revoked')
  })

  it('rejects once the absolute cap is passed', () => {
    const now = Date.now()
    const res = evaluateSession(row({ absoluteExpiresAt: new Date(now - 1) }), now, IDLE, WARN)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('absolute')
  })

  it('rejects once idle past the inactivity window', () => {
    const now = Date.now()
    const res = evaluateSession(row({ lastActivityAt: new Date(now - IDLE - 1) }), now, IDLE, WARN)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('idle')
  })

  it('caps the soonest expiry at the absolute deadline when it comes first', () => {
    const now = Date.now()
    const absolute = new Date(now + 5 * 60_000) // 5m away, sooner than the 30m idle
    const res = evaluateSession(
      row({ lastActivityAt: new Date(now), absoluteExpiresAt: absolute }),
      now,
      IDLE,
      WARN
    )
    expect(res.ok).toBe(true)
    expect(res.timing!.expiresAt).toBe(absolute.toISOString())
  })
})
