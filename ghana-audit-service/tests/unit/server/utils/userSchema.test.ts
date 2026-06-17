import { describe, it, expect } from 'vitest'
import { userSchema, userUpdateSchema } from '~/server/utils/validation'

describe('userSchema email domain enforcement', () => {
  const base = { name: 'Jane Doe', role: 'editor' as const }

  it('accepts @audit.gov.gh addresses', () => {
    const result = userSchema.safeParse({ ...base, email: 'jane.doe@audit.gov.gh' })
    expect(result.success).toBe(true)
  })

  it('accepts the domain case-insensitively', () => {
    const result = userSchema.safeParse({ ...base, email: 'Jane@AUDIT.GOV.GH' })
    expect(result.success).toBe(true)
  })

  it('rejects non-audit.gov.gh addresses', () => {
    const result = userSchema.safeParse({ ...base, email: 'jane@gmail.com' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/@audit\.gov\.gh/)
    }
  })

  it('rejects look-alike domains', () => {
    for (const email of [
      'jane@evil-audit.gov.gh',
      'jane@audit.gov.gh.evil.com',
      'jane@sub.audit.gov.gh'
    ]) {
      expect(userSchema.safeParse({ ...base, email }).success).toBe(false)
    }
  })

  it('still rejects malformed emails', () => {
    expect(userSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false)
  })

  it('enforces the domain on updates too', () => {
    expect(userUpdateSchema.safeParse({ email: 'jane@gmail.com' }).success).toBe(false)
    expect(userUpdateSchema.safeParse({ email: 'jane@audit.gov.gh' }).success).toBe(true)
  })
})
