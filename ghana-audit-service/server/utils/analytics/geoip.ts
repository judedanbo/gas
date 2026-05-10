import maxmind, { type CountryResponse, type AsnResponse, type Reader } from 'maxmind'

/**
 * MaxMind GeoLite2 lookup util.
 *
 * Configured via two env vars:
 *   ANALYTICS_GEOIP_DB_PATH  → path to GeoLite2-Country.mmdb
 *   ANALYTICS_ASN_DB_PATH    → path to GeoLite2-ASN.mmdb
 *
 * Files are not committed (license forbids redistribution). Operators
 * download them from https://www.maxmind.com/ (free GeoLite2 tier) and
 * mount them into the container or place them at the configured path
 * for local dev.
 *
 * If either env var is unset or the file fails to open, `getGeoIp()`
 * silently returns nulls — the analytics pipeline continues without geo
 * enrichment. No request path ever throws because of GeoIP.
 *
 * Lookups are synchronous (memory-mapped read; ~5–50 µs) so we can call
 * from the capture middleware without awaiting.
 */

export interface GeoLookup {
  country: string | null // ISO 3166-1 alpha-2, e.g. 'GH'
  asn: number | null
}

const NULL: GeoLookup = { country: null, asn: null }

let countryReader: Reader<CountryResponse> | null = null
let asnReader: Reader<AsnResponse> | null = null
let initStarted = false
let initWarned = false

/**
 * Open the MaxMind databases. Idempotent. Best-effort; if either file
 * is missing or unreadable we log once and continue with that reader
 * disabled.
 */
export async function initGeoIpReaders(): Promise<void> {
  if (initStarted) return
  initStarted = true

  const countryPath = process.env.ANALYTICS_GEOIP_DB_PATH?.trim()
  const asnPath = process.env.ANALYTICS_ASN_DB_PATH?.trim()

  if (!countryPath && !asnPath) {
    return // GeoIP intentionally disabled
  }

  if (countryPath) {
    try {
      countryReader = await maxmind.open<CountryResponse>(countryPath)
    } catch (err) {
      if (!initWarned) {
        console.warn('[analytics/geoip] country DB open failed:', (err as Error).message)
        initWarned = true
      }
    }
  }
  if (asnPath) {
    try {
      asnReader = await maxmind.open<AsnResponse>(asnPath)
    } catch (err) {
      if (!initWarned) {
        console.warn('[analytics/geoip] asn DB open failed:', (err as Error).message)
        initWarned = true
      }
    }
  }

  if (countryReader || asnReader) {
    console.info('[analytics/geoip] readers initialised', {
      country: !!countryReader,
      asn: !!asnReader
    })
  }
}

// Kick off init on module load. Lookups before init completes will return
// nulls — first few requests after boot won't be enriched.
void initGeoIpReaders()

/**
 * Test helper: drop cached readers so a subsequent initGeoIpReaders()
 * picks up new env vars.
 */
export function __resetGeoIpForTests(): void {
  countryReader = null
  asnReader = null
  initStarted = false
  initWarned = false
}

export function getGeoIp(ip: string): GeoLookup {
  if (!ip || (!countryReader && !asnReader)) return NULL

  let country: string | null = null
  let asn: number | null = null
  try {
    if (countryReader) {
      country = countryReader.get(ip)?.country?.iso_code ?? null
    }
    if (asnReader) {
      asn = asnReader.get(ip)?.autonomous_system_number ?? null
    }
  } catch {
    // Malformed IP, etc. Fail closed.
    return NULL
  }
  return { country, asn }
}

// ---------------------------------------------------------------------------
// Hosting / cloud ASN heuristic
// ---------------------------------------------------------------------------

/**
 * Curated list of well-known cloud / hosting ASNs. Real users almost never
 * arrive from these on a public-information government site, so a hit is a
 * weak-but-real bot signal (+5 in the score).
 *
 * Add more as we observe them in the wild — keeping the list explicit
 * (rather than e.g. "any ASN matching a regex") avoids over-flagging
 * legitimate Ghanaian ISPs that share an ASN range with hosting providers.
 */
const HOSTING_ASNS = new Set<number>([
  16509,
  14618,
  8987,
  39111, // AWS
  14061, // DigitalOcean
  24940, // Hetzner
  16276, // OVH
  396982,
  15169, // Google Cloud / Google
  8075, // Microsoft / Azure
  20473, // Vultr
  63949,
  20940, // Linode / Akamai
  13335, // Cloudflare
  46606, // Unified Layer
  46844, // Sharktech
  53850, // PONYNET (BuyVM)
  60068, // CDN77
  62240 // Clouvider
])

export function isHostingAsn(asn: number | null | undefined): boolean {
  return asn != null && HOSTING_ASNS.has(asn)
}
