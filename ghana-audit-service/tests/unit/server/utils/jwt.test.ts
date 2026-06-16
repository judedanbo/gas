import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import jwt from 'jsonwebtoken'
import { signToken, verifyToken } from '~/server/utils/jwt'

const SECRET = 'test-secret-for-jwt-unit-tests'
const ORIGINAL = process.env.JWT_SECRET

beforeAll(() => {
  process.env.JWT_SECRET = SECRET
})
afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = ORIGINAL
})

const payload = { userId: 1, email: 'a@b.com', role: 'admin' as const, sid: 'sess-1' }

describe('jwt sign/verify', () => {
  it('round-trips a signed HS256 token', () => {
    const decoded = verifyToken(signToken(payload, 60))
    expect(decoded?.userId).toBe(1)
    expect(decoded?.sid).toBe('sess-1')
  })

  it('signs with the HS256 algorithm', () => {
    const header = JSON.parse(Buffer.from(signToken(payload, 60).split('.')[0], 'base64').toString())
    expect(header.alg).toBe('HS256')
  })

  it('rejects a token signed with a different algorithm (HS512)', () => {
    // Same secret, but a non-pinned algorithm — must be rejected by verify.
    const hs512 = jwt.sign(payload, SECRET, { algorithm: 'HS512', expiresIn: 60 })
    expect(verifyToken(hs512)).toBeNull()
  })

  it('rejects an unsigned (alg: none) token', () => {
    const none = jwt.sign(payload, '', { algorithm: 'none' })
    expect(verifyToken(none)).toBeNull()
  })

  it('rejects a token signed with the wrong secret', () => {
    const wrong = jwt.sign(payload, 'some-other-secret', { algorithm: 'HS256', expiresIn: 60 })
    expect(verifyToken(wrong)).toBeNull()
  })
})
