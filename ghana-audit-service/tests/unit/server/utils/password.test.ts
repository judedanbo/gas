import { describe, it, expect } from 'vitest'
import {
  generatePassword,
  generateInvitationToken,
  hashPassword,
  verifyPassword
} from '~/server/utils/password'

describe('generatePassword', () => {
  it('produces 8–10 character passwords', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword()
      expect(pw.length).toBeGreaterThanOrEqual(8)
      expect(pw.length).toBeLessThanOrEqual(10)
    }
  })

  it('contains only unambiguous alphanumeric characters (no special chars)', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword()
      // Only letters/digits, and none of the ambiguous ones (0 1 I O l o).
      expect(pw).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]+$/)
    }
  })

  it('always includes an uppercase letter, a lowercase letter and a digit', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword()
      expect(pw).toMatch(/[A-Z]/)
      expect(pw).toMatch(/[a-z]/)
      expect(pw).toMatch(/[0-9]/)
    }
  })

  it('is non-deterministic', () => {
    const set = new Set(Array.from({ length: 50 }, () => generatePassword()))
    expect(set.size).toBeGreaterThan(45)
  })

  it('produces a password that hashes and verifies', async () => {
    const pw = generatePassword()
    const hash = await hashPassword(pw)
    expect(await verifyPassword(pw, hash)).toBe(true)
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })
})

describe('generateInvitationToken', () => {
  it('produces a 64-char hex token', () => {
    const token = generateInvitationToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is unique across calls', () => {
    const set = new Set(Array.from({ length: 100 }, () => generateInvitationToken()))
    expect(set.size).toBe(100)
  })
})
