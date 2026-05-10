import { describe, it, expect, beforeEach } from 'vitest'
import {
  getGeoIp,
  isHostingAsn,
  initGeoIpReaders,
  __resetGeoIpForTests
} from '../../../../server/utils/analytics/geoip'

describe('analytics/geoip', () => {
  beforeEach(() => {
    delete process.env.ANALYTICS_GEOIP_DB_PATH
    delete process.env.ANALYTICS_ASN_DB_PATH
    __resetGeoIpForTests()
  })

  describe('getGeoIp without MMDB configured', () => {
    it('returns nulls for any IP when no DB env vars are set', async () => {
      await initGeoIpReaders()
      expect(getGeoIp('203.0.113.1')).toEqual({ country: null, asn: null })
      expect(getGeoIp('8.8.8.8')).toEqual({ country: null, asn: null })
    })

    it('returns nulls for empty / falsy IPs', async () => {
      await initGeoIpReaders()
      expect(getGeoIp('')).toEqual({ country: null, asn: null })
    })

    it('logs once and degrades gracefully if a configured DB file is missing', async () => {
      process.env.ANALYTICS_GEOIP_DB_PATH = '/no/such/file.mmdb'
      __resetGeoIpForTests()
      await initGeoIpReaders()
      // Should not throw, and should still return null lookups.
      expect(getGeoIp('203.0.113.1')).toEqual({ country: null, asn: null })
    })
  })

  describe('isHostingAsn', () => {
    it('matches well-known cloud ASNs', () => {
      // AWS, DigitalOcean, Hetzner, OVH, GCP, Azure, Vultr, Linode, Cloudflare
      const known = [16509, 14618, 14061, 24940, 16276, 396982, 15169, 8075, 20473, 63949, 13335]
      for (const asn of known) {
        expect(isHostingAsn(asn)).toBe(true)
      }
    })

    it('does not match Ghanaian ISP ASNs (sample non-hosting)', () => {
      // MTN Ghana (AS37339), Vodafone Ghana (AS30986), Surfline (AS37345)
      // are not on the hosting list — they're consumer ISPs.
      expect(isHostingAsn(37339)).toBe(false)
      expect(isHostingAsn(30986)).toBe(false)
      expect(isHostingAsn(37345)).toBe(false)
    })

    it('returns false for null / undefined / non-numeric inputs', () => {
      expect(isHostingAsn(null)).toBe(false)
      expect(isHostingAsn(undefined)).toBe(false)
    })
  })
})
