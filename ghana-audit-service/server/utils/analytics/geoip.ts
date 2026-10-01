import { stat } from 'node:fs/promises'
import maxmind, { type CountryResponse, type AsnResponse, type Reader } from 'maxmind'

/**
 * MaxMind GeoLite2 lookup util.
 *
 * Configured via two env vars:
 *   ANALYTICS_GEOIP_DB_PATH  → path to GeoLite2-Country.mmdb
 *   ANALYTICS_ASN_DB_PATH    → path to GeoLite2-ASN.mmdb
 *
 * Files are not committed (license forbids redistribution). In production the
 * geoip-update CronJob (k8s/jobs/geoip-update-cronjob.yaml) downloads them onto
 * a shared volume mounted read-only into the frontend; for local dev, download
 * them from https://www.maxmind.com/ (free GeoLite2 tier) and point the env
 * vars at them.
 *
 * The files are re-checked every REFRESH_INTERVAL_MS: one that is missing at
 * boot (fresh volume, CronJob not run yet) is picked up once it appears, and
 * one the CronJob replaces is reloaded — no pod restart needed. A failed load
 * keeps serving the previous copy.
 *
 * If both env vars are unset or no file can be opened, `getGeoIp()` returns
 * nulls — the analytics pipeline continues without geo enrichment. No request
 * path ever throws because of GeoIP.
 *
 * Lookups are synchronous (in-memory read; ~5–50 µs) so we can call from the
 * capture middleware without awaiting.
 */

export interface GeoLookup {
  country: string | null // ISO 3166-1 alpha-2, e.g. 'GH'
  asn: number | null
}

const NULL: GeoLookup = { country: null, asn: null }

/**
 * GeoLite2 is released twice a week; re-checking every 15 minutes costs one
 * stat() per file and bounds how long a fresh pod runs without geo after the
 * first download lands.
 */
const REFRESH_INTERVAL_MS = 15 * 60 * 1000

interface LoadedDb<T extends CountryResponse | AsnResponse> {
  reader: Reader<T>
  mtimeMs: number
}

type DbLabel = 'country' | 'asn'

let countryDb: LoadedDb<CountryResponse> | null = null
let asnDb: LoadedDb<AsnResponse> | null = null
let initPromise: Promise<void> | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null
let timerPassRunning = false
// Labels whose load failure has already been logged; cleared on success so a
// later regression is reported again.
const loadWarned = new Set<DbLabel>()
let privateIpWarned = false

/**
 * (Re)open one database when its file is new or has changed since the last
 * load. On any failure the previous copy (if any) stays in service.
 */
async function loadIfChanged<T extends CountryResponse | AsnResponse>(
  label: DbLabel,
  path: string,
  current: LoadedDb<T> | null
): Promise<LoadedDb<T> | null> {
  try {
    const { mtimeMs } = await stat(path)
    if (current && current.mtimeMs === mtimeMs) return current
    const reader = await maxmind.open<T>(path)
    loadWarned.delete(label)
    console.info(`[analytics/geoip] ${label} DB ${current ? 'reloaded' : 'loaded'}`, {
      path,
      modified: new Date(mtimeMs).toISOString()
    })
    return { reader, mtimeMs }
  } catch (err) {
    if (!loadWarned.has(label)) {
      loadWarned.add(label)
      console.warn(
        `[analytics/geoip] ${label} DB unavailable at ${path}: ${(err as Error).message}` +
          (current ? ' (keeping previous copy)' : ' (retrying every 15 min)')
      )
    }
    return current
  }
}

/** Re-check both configured databases and swap in any that changed. */
export async function refreshGeoIpReaders(): Promise<void> {
  const countryPath = process.env.ANALYTICS_GEOIP_DB_PATH?.trim()
  const asnPath = process.env.ANALYTICS_ASN_DB_PATH?.trim()
  if (countryPath) countryDb = await loadIfChanged('country', countryPath, countryDb)
  if (asnPath) asnDb = await loadIfChanged('asn', asnPath, asnDb)
}

function onRefreshTick(): void {
  // A stalled network mount must not stack up overlapping passes.
  if (timerPassRunning) return
  timerPassRunning = true
  void refreshGeoIpReaders().finally(() => {
    timerPassRunning = false
  })
}

/**
 * Open the MaxMind databases and start the periodic refresh. Idempotent:
 * every caller awaits the same first load. Best-effort: a missing or
 * unreadable file is logged once and retried.
 */
export function initGeoIpReaders(): Promise<void> {
  initPromise ??= (async () => {
    const countryPath = process.env.ANALYTICS_GEOIP_DB_PATH?.trim()
    const asnPath = process.env.ANALYTICS_ASN_DB_PATH?.trim()

    if (!countryPath && !asnPath) {
      console.info(
        '[analytics/geoip] disabled — ANALYTICS_GEOIP_DB_PATH / ANALYTICS_ASN_DB_PATH unset'
      )
      return
    }

    await refreshGeoIpReaders()
    refreshTimer = setInterval(onRefreshTick, REFRESH_INTERVAL_MS)
    // Never keep the process alive just to poll for GeoIP files.
    refreshTimer.unref?.()
  })()
  return initPromise
}

// Kick off init on module load. Lookups before init completes will return
// nulls — first few requests after boot won't be enriched.
void initGeoIpReaders()

/**
 * Test helper: drop cached readers and stop the refresh timer so a subsequent
 * initGeoIpReaders() picks up new env vars.
 */
export function __resetGeoIpForTests(): void {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = null
  timerPassRunning = false
  countryDb = null
  asnDb = null
  initPromise = null
  loadWarned.clear()
  privateIpWarned = false
}

/**
 * True for addresses that can never geolocate: RFC 1918, CGNAT, loopback,
 * link-local and IPv6 ULA/link-local. Seeing one as the *client* IP means the
 * real address was lost upstream (proxy/load-balancer config), not that the
 * visitor's country is unknown.
 */
export function isNonRoutableIp(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip
  const octets = v4.split('.')
  if (octets.length === 4) {
    const [a, b] = octets.map(Number)
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    )
  }
  const v6 = ip.toLowerCase()
  return v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)
}

export function getGeoIp(ip: string): GeoLookup {
  const countryReader = countryDb?.reader
  const asnReader = asnDb?.reader
  if (!ip || (!countryReader && !asnReader)) return NULL

  if (!privateIpWarned && isNonRoutableIp(ip)) {
    privateIpWarned = true
    console.warn(
      `[analytics/geoip] client IP ${ip} is a private address, so it has no country. ` +
        'If this pod is behind ingress-nginx, the real visitor IP is being lost: the ' +
        'controller Service needs externalTrafficPolicy: Local and TRUSTED_PROXIES must ' +
        'cover the ingress pods (see k8s/README.md). Logged once per process.'
    )
  }

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
