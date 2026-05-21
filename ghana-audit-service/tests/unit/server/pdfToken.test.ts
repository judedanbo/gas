import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import jwt from 'jsonwebtoken'
import {
  signPdfToken,
  verifyAndConsumePdfToken,
  __resetPdfTokenStoreForTests
} from '~/server/utils/analytics/pdfToken'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-pdf-token-unit'
  // Force in-process fallback (no Redis) for these tests.
  delete process.env.REDIS_URL
})

beforeEach(() => {
  __resetPdfTokenStoreForTests()
})

describe('pdfToken', () => {
  it('round-trips through sign/verify', async () => {
    const { token, jti } = await signPdfToken({ userId: 42, sid: 'sess-abc', window: '7d' })
    expect(typeof token).toBe('string')
    expect(jti).toMatch(/^[0-9a-f]{32}$/)

    const decoded = await verifyAndConsumePdfToken(token)
    expect(decoded).not.toBeNull()
    expect(decoded?.userId).toBe(42)
    expect(decoded?.sid).toBe('sess-abc')
    expect(decoded?.window).toBe('7d')
    expect(decoded?.aud).toBe('pdf-report')
  })

  it('rejects a token whose jti has already been consumed (single-use)', async () => {
    const { token } = await signPdfToken({ userId: 1, sid: 's', window: '24h' })
    const first = await verifyAndConsumePdfToken(token)
    expect(first).not.toBeNull()
    const second = await verifyAndConsumePdfToken(token)
    expect(second).toBeNull()
  })

  it('rejects an expired token', async () => {
    // Sign manually with an immediate expiry to avoid waiting in tests.
    const expired = jwt.sign(
      {
        userId: 1,
        sid: 's',
        window: '7d',
        jti: 'abc',
        aud: 'pdf-report'
      },
      process.env.JWT_SECRET as string,
      { expiresIn: -1 }
    )
    const decoded = await verifyAndConsumePdfToken(expired)
    expect(decoded).toBeNull()
  })

  it('rejects a token signed with the wrong audience', async () => {
    const wrongAud = jwt.sign(
      {
        userId: 1,
        sid: 's',
        window: '7d',
        jti: 'abc',
        aud: 'something-else'
      },
      process.env.JWT_SECRET as string,
      { expiresIn: 60 }
    )
    const decoded = await verifyAndConsumePdfToken(wrongAud)
    expect(decoded).toBeNull()
  })

  it('rejects a token signed with a different secret', async () => {
    const { token } = await signPdfToken({ userId: 1, sid: 's', window: '7d' })
    // Verify with a different secret by temporarily swapping it.
    const real = process.env.JWT_SECRET
    process.env.JWT_SECRET = 'different-secret'
    try {
      const decoded = await verifyAndConsumePdfToken(token)
      expect(decoded).toBeNull()
    } finally {
      process.env.JWT_SECRET = real
    }
  })

  it('rejects garbage tokens', async () => {
    expect(await verifyAndConsumePdfToken('not-a-jwt')).toBeNull()
    expect(await verifyAndConsumePdfToken('')).toBeNull()
  })
})
