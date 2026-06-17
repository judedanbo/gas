import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import jwt from 'jsonwebtoken'
import { signSseTicket, verifySseTicket } from '~/server/utils/sseTicket'

const SECRET = 'test-secret-for-sse-ticket-tests'
const ORIGINAL = process.env.JWT_SECRET

beforeAll(() => {
  process.env.JWT_SECRET = SECRET
})
afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = ORIGINAL
})

describe('sseTicket', () => {
  it('round-trips userId + sid', () => {
    const t = signSseTicket({ userId: 7, sid: 'sess-abc' })
    expect(verifySseTicket(t)).toEqual({ userId: 7, sid: 'sess-abc' })
  })

  it('is reusable within its TTL (not single-use)', () => {
    const t = signSseTicket({ userId: 1, sid: 's1' })
    expect(verifySseTicket(t)).not.toBeNull()
    expect(verifySseTicket(t)).not.toBeNull()
  })

  it('signs with HS256', () => {
    const header = JSON.parse(
      Buffer.from(signSseTicket({ userId: 1, sid: 's1' }).split('.')[0], 'base64').toString()
    )
    expect(header.alg).toBe('HS256')
  })

  it('rejects a token with a different aud (e.g. a normal session JWT)', () => {
    // A session-shaped JWT without aud: 'sse-stream' must not pass.
    const sessionish = jwt.sign({ userId: 1, sid: 's1', role: 'admin' }, SECRET, {
      algorithm: 'HS256',
      expiresIn: 120
    })
    expect(verifySseTicket(sessionish)).toBeNull()
  })

  it('rejects an expired ticket', () => {
    const expired = jwt.sign({ userId: 1, sid: 's1', aud: 'sse-stream' }, SECRET, {
      algorithm: 'HS256',
      expiresIn: -10
    })
    expect(verifySseTicket(expired)).toBeNull()
  })

  it('rejects a non-HS256 algorithm', () => {
    const hs512 = jwt.sign({ userId: 1, sid: 's1', aud: 'sse-stream' }, SECRET, {
      algorithm: 'HS512',
      expiresIn: 120
    })
    expect(verifySseTicket(hs512)).toBeNull()
  })

  it('rejects a wrong-secret or garbage token', () => {
    const wrong = jwt.sign({ userId: 1, sid: 's1', aud: 'sse-stream' }, 'other-secret', {
      algorithm: 'HS256',
      expiresIn: 120
    })
    expect(verifySseTicket(wrong)).toBeNull()
    expect(verifySseTicket('not-a-jwt')).toBeNull()
    expect(verifySseTicket('')).toBeNull()
  })
})
