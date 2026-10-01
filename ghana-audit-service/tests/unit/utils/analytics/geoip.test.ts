import { describe, it, expect, beforeEach } from 'vitest'
import {
  getGeoIp,
  isHostingAsn,
  isNonRoutableIp,
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

  describe('isNonRoutableIp', () => {
    it('flags private, loopback, link-local and CGNAT IPv4', () => {
      for (const ip of [
        '10.244.1.7',
        '10.224.0.4',
        '172.16.0.1',
        '172.31.255.255',
        '192.168.1.10',
        '127.0.0.1',
        '169.254.169.254',
        '100.64.0.1',
        '::ffff:10.244.1.7'
      ]) {
        expect(isNonRoutableIp(ip), ip).toBe(true)
      }
    })

    it('flags loopback, ULA and link-local IPv6', () => {
      for (const ip of ['::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'FE80::abcd']) {
        expect(isNonRoutableIp(ip), ip).toBe(true)
      }
    })

    it('does not flag public addresses', () => {
      for (const ip of [
        '41.66.200.1', // Ghana (MTN)
        '8.8.8.8',
        '172.15.0.1',
        '172.32.0.1',
        '100.128.0.1',
        '2001:4860:4860::8888',
        'unknown'
      ]) {
        expect(isNonRoutableIp(ip), ip).toBe(false)
      }
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
