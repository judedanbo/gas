import { describe, it, expect } from 'vitest'
import { looksLikePlaceholderSecret } from '~/server/utils/secretChecks'

describe('looksLikePlaceholderSecret', () => {
  it('flags the example/placeholder values shipped in .env files', () => {
    expect(looksLikePlaceholderSecret('change-this-jwt-secret', 32)).toBe(true)
    expect(looksLikePlaceholderSecret('change-me-in-production', 16)).toBe(true)
    expect(looksLikePlaceholderSecret('generate-a-secure-jwt-secret-here', 32)).toBe(true)
    expect(looksLikePlaceholderSecret('your-api-secret-here', 16)).toBe(true)
    expect(looksLikePlaceholderSecret('generate-a-32-byte-analytics-salt', 16)).toBe(true)
  })

  it('flags secrets that are too short even if otherwise random-looking', () => {
    expect(looksLikePlaceholderSecret('abc123', 32)).toBe(true)
    expect(looksLikePlaceholderSecret('f3a9c1', 16)).toBe(true)
  })

  it('accepts a strong random secret of sufficient length', () => {
    // 64 hex chars (openssl rand -hex 32)
    const strong = 'a3f1c9d27b8e4f60a1d5c3b9e7f20a48c6d1e9f3b2a7c4d8e0f1a2b3c4d5e6f70'
    expect(looksLikePlaceholderSecret(strong, 32)).toBe(false)
  })

  it('returns false for unset (handled separately by callers)', () => {
    expect(looksLikePlaceholderSecret(undefined, 32)).toBe(false)
    expect(looksLikePlaceholderSecret('', 32)).toBe(false)
  })
})
