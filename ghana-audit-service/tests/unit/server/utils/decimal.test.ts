import { describe, it, expect } from 'vitest'
import { decimalToNumber } from '~/server/utils/decimal'

describe('decimalToNumber', () => {
  it('parses mysql2 DECIMAL strings', () => {
    expect(decimalToNumber('5.60000000')).toBe(5.6)
    expect(decimalToNumber('-0.18700000')).toBe(-0.187)
    expect(decimalToNumber('0')).toBe(0)
  })

  it('returns null for null, empty, and non-numeric values', () => {
    expect(decimalToNumber(null)).toBeNull()
    expect(decimalToNumber('')).toBeNull()
    expect(decimalToNumber('not-a-number')).toBeNull()
  })
})
