import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import maxmind from 'maxmind'
import { stat } from 'node:fs/promises'
import {
  getGeoIp,
  initGeoIpReaders,
  refreshGeoIpReaders,
  __resetGeoIpForTests
} from '../../../../server/utils/analytics/geoip'

// The MaxMind readers and file stats are mocked so the refresh logic can be
// exercised without shipping a real (licence-restricted) .mmdb fixture.
vi.mock('maxmind', () => ({ default: { open: vi.fn() } }))
vi.mock('node:fs/promises', function () {
  const stat = vi.fn()
  return { stat, default: { stat } }
})

const COUNTRY_PATH = '/app/data/geoip/GeoLite2-Country.mmdb'
const ASN_PATH = '/app/data/geoip/GeoLite2-ASN.mmdb'

const openMock = vi.mocked(maxmind.open)
const statMock = vi.mocked(stat)

function enoent(path: string): Error {
  return Object.assign(new Error(`ENOENT: no such file or directory, stat '${path}'`), {
    code: 'ENOENT'
  })
}

/** Fake reader whose lookups always answer with the given country/asn. */
function fakeReader(record: Record<string, unknown>) {
  return { get: vi.fn(() => record) } as never
}

describe('analytics/geoip refresh', () => {
  // Simulated files on disk: path → mtime. Absent → ENOENT.
  let files: Map<string, number>

  beforeEach(() => {
    files = new Map()
    statMock.mockImplementation((async (path: string) => {
      const mtimeMs = files.get(path)
      if (mtimeMs === undefined) throw enoent(path)
      return { mtimeMs }
    }) as never)
    process.env.ANALYTICS_GEOIP_DB_PATH = COUNTRY_PATH
    process.env.ANALYTICS_ASN_DB_PATH = ASN_PATH
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    __resetGeoIpForTests()
  })

  afterEach(() => {
    __resetGeoIpForTests()
    delete process.env.ANALYTICS_GEOIP_DB_PATH
    delete process.env.ANALYTICS_ASN_DB_PATH
    vi.restoreAllMocks()
  })

  it('loads both databases when present at boot', async () => {
    files.set(COUNTRY_PATH, 1)
    files.set(ASN_PATH, 1)
    openMock.mockImplementation((async (path: string) =>
      path === COUNTRY_PATH
        ? fakeReader({ country: { iso_code: 'GH' } })
        : fakeReader({ autonomous_system_number: 37339 })) as never)

    await initGeoIpReaders()

    expect(getGeoIp('41.66.200.1')).toEqual({ country: 'GH', asn: 37339 })
  })

  it('lets every init() caller await the first load', async () => {
    files.set(COUNTRY_PATH, 1)
    openMock.mockResolvedValue(fakeReader({ country: { iso_code: 'GH' } }))

    // Module load fires init() without awaiting; a later caller must still
    // be able to wait for that same first load to finish.
    void initGeoIpReaders()
    await initGeoIpReaders()

    expect(getGeoIp('41.66.200.1').country).toBe('GH')
    expect(openMock).toHaveBeenCalledTimes(1)
  })

  it('picks up a database that only appears after boot', async () => {
    // Fresh volume: the geoip-update CronJob hasn't written anything yet.
    await initGeoIpReaders()
    expect(getGeoIp('41.66.200.1')).toEqual({ country: null, asn: null })
    expect(openMock).not.toHaveBeenCalled()

    files.set(COUNTRY_PATH, 1)
    openMock.mockResolvedValue(fakeReader({ country: { iso_code: 'GH' } }))
    await refreshGeoIpReaders()

    expect(getGeoIp('41.66.200.1')).toEqual({ country: 'GH', asn: null })
  })

  it('re-checks on a timer once initialised', async () => {
    vi.useFakeTimers()
    try {
      await initGeoIpReaders()
      expect(getGeoIp('41.66.200.1').country).toBeNull()

      files.set(COUNTRY_PATH, 1)
      openMock.mockResolvedValue(fakeReader({ country: { iso_code: 'GH' } }))
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000)

      expect(getGeoIp('41.66.200.1').country).toBe('GH')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not re-open an unchanged file', async () => {
    files.set(COUNTRY_PATH, 1)
    openMock.mockResolvedValue(fakeReader({ country: { iso_code: 'GH' } }))
    await initGeoIpReaders()
    await refreshGeoIpReaders()
    await refreshGeoIpReaders()

    expect(openMock).toHaveBeenCalledTimes(1)
  })

  it('reloads a file the CronJob replaced', async () => {
    files.set(COUNTRY_PATH, 1)
    openMock.mockResolvedValueOnce(fakeReader({ country: { iso_code: 'GH' } }))
    await initGeoIpReaders()
    expect(getGeoIp('41.66.200.1').country).toBe('GH')

    files.set(COUNTRY_PATH, 2)
    openMock.mockResolvedValueOnce(fakeReader({ country: { iso_code: 'TG' } }))
    await refreshGeoIpReaders()

    expect(openMock).toHaveBeenCalledTimes(2)
    expect(getGeoIp('41.66.200.1').country).toBe('TG')
  })

  it('keeps serving the previous copy if a reload fails', async () => {
    files.set(COUNTRY_PATH, 1)
    openMock.mockResolvedValueOnce(fakeReader({ country: { iso_code: 'GH' } }))
    await initGeoIpReaders()

    files.set(COUNTRY_PATH, 2)
    openMock.mockRejectedValueOnce(new Error('Cannot locate metadata'))
    await refreshGeoIpReaders()

    expect(getGeoIp('41.66.200.1').country).toBe('GH')
  })

  it('logs a missing file once, not on every retry', async () => {
    await initGeoIpReaders()
    await refreshGeoIpReaders()
    await refreshGeoIpReaders()

    const warns = vi
      .mocked(console.warn)
      .mock.calls.filter((c) => String(c[0]).includes('country DB unavailable'))
    expect(warns).toHaveLength(1)
  })

  it('warns once when asked to geolocate a private client IP', async () => {
    files.set(COUNTRY_PATH, 1)
    openMock.mockResolvedValue(fakeReader({}))
    await initGeoIpReaders()

    getGeoIp('10.224.0.4')
    getGeoIp('10.224.0.5')
    getGeoIp('41.66.200.1')

    const warns = vi
      .mocked(console.warn)
      .mock.calls.filter((c) => String(c[0]).includes('is a private address'))
    expect(warns).toHaveLength(1)
    expect(String(warns[0][0])).toContain('externalTrafficPolicy: Local')
  })

  it('does not warn about private IPs while GeoIP is disabled', async () => {
    delete process.env.ANALYTICS_GEOIP_DB_PATH
    delete process.env.ANALYTICS_ASN_DB_PATH
    await initGeoIpReaders()

    getGeoIp('10.224.0.4')

    expect(console.warn).not.toHaveBeenCalled()
  })
})
