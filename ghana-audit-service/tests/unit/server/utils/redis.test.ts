import { describe, it, expect, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { redisTlsOptions } from '~/server/utils/redis'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

function writeTempCa(): string {
  const dir = mkdtempSync(join(tmpdir(), 'redis-ca-'))
  const file = join(dir, 'ca.crt')
  writeFileSync(file, '-----BEGIN CERTIFICATE-----\nMIIB...test...\n-----END CERTIFICATE-----\n')
  return file
}

describe('redisTlsOptions', () => {
  it('returns undefined when no CA and verification is on (default)', () => {
    delete process.env.REDIS_CA_FILE
    delete process.env.REDIS_TLS_REJECT_UNAUTHORIZED
    expect(redisTlsOptions()).toBeUndefined()
  })

  it('loads the CA when REDIS_CA_FILE points at a readable file', () => {
    delete process.env.REDIS_TLS_REJECT_UNAUTHORIZED
    process.env.REDIS_CA_FILE = writeTempCa()
    const tls = redisTlsOptions()
    expect(tls).toBeTruthy()
    expect(Buffer.isBuffer((tls as { ca: Buffer }).ca)).toBe(true)
    expect((tls as { rejectUnauthorized: boolean }).rejectUnauthorized).toBe(true)
  })

  it('does NOT throw and returns undefined when the CA path is missing (graceful degradation)', () => {
    delete process.env.REDIS_TLS_REJECT_UNAUTHORIZED
    process.env.REDIS_CA_FILE = '/no/such/redis-ca.crt'
    let result: unknown
    expect(() => {
      result = redisTlsOptions()
    }).not.toThrow()
    expect(result).toBeUndefined()
  })

  it('honours the REDIS_TLS_REJECT_UNAUTHORIZED=false escape hatch', () => {
    delete process.env.REDIS_CA_FILE
    process.env.REDIS_TLS_REJECT_UNAUTHORIZED = 'false'
    expect(redisTlsOptions()).toEqual({ rejectUnauthorized: false })

    process.env.REDIS_CA_FILE = writeTempCa()
    const tls = redisTlsOptions() as { ca: Buffer; rejectUnauthorized: boolean }
    expect(Buffer.isBuffer(tls.ca)).toBe(true)
    expect(tls.rejectUnauthorized).toBe(false)
  })
})
