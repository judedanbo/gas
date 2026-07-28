import { describe, it, expect } from 'vitest'
import { fileSizeToBytes } from '~/server/utils/fileSize'

describe('fileSizeToBytes', () => {
  it('parses raw byte-count strings from admin uploads', () => {
    expect(fileSizeToBytes('74285320')).toBe(74285320)
    expect(fileSizeToBytes('1024')).toBe(1024)
  })

  it('rounds fractional byte counts', () => {
    expect(fileSizeToBytes('1024.6')).toBe(1025)
  })

  it('converts legacy formatted labels to approximate bytes', () => {
    expect(fileSizeToBytes('4.2 MB')).toBe(Math.round(4.2 * 1024 ** 2))
    expect(fileSizeToBytes('512 KB')).toBe(512 * 1024)
    expect(fileSizeToBytes('1.5 GB')).toBe(Math.round(1.5 * 1024 ** 3))
    expect(fileSizeToBytes('900 B')).toBe(900)
  })

  it('accepts labels without a space and with lowercase units', () => {
    expect(fileSizeToBytes('4.2mb')).toBe(Math.round(4.2 * 1024 ** 2))
  })

  it('returns null for null, empty, zero, and unparseable values', () => {
    expect(fileSizeToBytes(null)).toBeNull()
    expect(fileSizeToBytes('')).toBeNull()
    expect(fileSizeToBytes('0')).toBeNull()
    expect(fileSizeToBytes('N/A')).toBeNull()
    expect(fileSizeToBytes('4.2 TB')).toBeNull()
  })
})
