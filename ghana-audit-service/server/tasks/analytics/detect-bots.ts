import { getPool } from '../../database'
import { scoreSignature, type ScoreSnapshot } from '../../utils/analytics/score'
import type { UaFamily } from '../../utils/analytics/fingerprint'

/**
 * Score every (ip_hash, ua_hash) pair active in the last 24h, upsert into
 * bot_signatures, and emit warning-severity abuse_incidents for newly
 * abusive pairs.
 *
 * Human overrides are preserved: if an existing row was decided manually
 * (decided_by IS NOT NULL and classification IN ('safe-allowlist',
 * 'abusive')), we update the rolling counters/score/last-seen but leave
 * the classification untouched. The dashboard surfaces both the auto
 * score and the override.
 */

interface AggregateRow {
  ip_hash: string
  ua_hash: string
  ua_family: UaFamily
  ua_sample: string | null
  total_requests: number
  distinct_routes: number
  first_seen: Date | string
  last_seen: Date | string
  rate_limit_hits: number
  probing_hits: number
  fuzz_hits: number
  failed_logins: number
  downloads: number
  country: string | null
  asn: number | null
  any_missing_accept_language: number
  any_missing_accept_encoding: number
  any_http_10: number
}

const WINDOW_HOURS = 24

const AGGREGATE_SQL = `
  SELECT
    re.ip_hash,
    re.ua_hash,
    -- ua_family is consistent within a uaHash; MAX picks an arbitrary
    -- representative cheaply.
    MAX(re.ua_family) AS ua_family,
    NULL AS ua_sample,
    COUNT(*) AS total_requests,
    COUNT(DISTINCT re.route_pattern) AS distinct_routes,
    MIN(re.ts) AS first_seen,
    MAX(re.ts) AS last_seen,
    -- Geo is mostly stable per IP; pick a representative cheaply.
    MAX(re.country) AS country,
    MAX(re.asn) AS asn,
    -- Header-anomaly per-signature flags (Phase 5d). The MAX-of-CASE
    -- pattern reads as "this signature has been observed with the
    -- anomaly on at least one request in the window". NULLs (events
    -- captured before the column existed) are treated as "unknown" —
    -- they can't trip the signal.
    MAX(CASE WHEN re.has_accept_language = 0 THEN 1 ELSE 0 END) AS any_missing_accept_language,
    MAX(CASE WHEN re.has_accept_encoding = 0 THEN 1 ELSE 0 END) AS any_missing_accept_encoding,
    MAX(CASE WHEN re.http_version = '1.0' THEN 1 ELSE 0 END) AS any_http_10,
    COALESCE(rl.hits, 0) AS rate_limit_hits,
    COALESCE(pp.hits, 0) AS probing_hits,
    COALESCE(fz.hits, 0) AS fuzz_hits,
    COALESCE(fl.hits, 0) AS failed_logins,
    COALESCE(dl.dls, 0) AS downloads
  FROM request_events re
  LEFT JOIN (
    SELECT ip_hash, ua_hash, COUNT(*) AS hits
    FROM abuse_incidents
    WHERE ts >= (NOW() - INTERVAL ? HOUR) AND kind LIKE 'rate_limit_%'
    GROUP BY ip_hash, ua_hash
  ) rl ON rl.ip_hash = re.ip_hash AND rl.ua_hash = re.ua_hash
  LEFT JOIN (
    SELECT ip_hash, ua_hash, COUNT(*) AS hits
    FROM abuse_incidents
    WHERE ts >= (NOW() - INTERVAL ? HOUR) AND kind = 'probing_path'
    GROUP BY ip_hash, ua_hash
  ) pp ON pp.ip_hash = re.ip_hash AND pp.ua_hash = re.ua_hash
  LEFT JOIN (
    SELECT ip_hash, ua_hash, COUNT(*) AS hits
    FROM abuse_incidents
    WHERE ts >= (NOW() - INTERVAL ? HOUR) AND kind = 'fuzz_attempt'
    GROUP BY ip_hash, ua_hash
  ) fz ON fz.ip_hash = re.ip_hash AND fz.ua_hash = re.ua_hash
  LEFT JOIN (
    SELECT ip_hash, ua_hash, COUNT(*) AS hits
    FROM abuse_incidents
    WHERE ts >= (NOW() - INTERVAL ? HOUR) AND kind = 'failed_login'
    GROUP BY ip_hash, ua_hash
  ) fl ON fl.ip_hash = re.ip_hash AND fl.ua_hash = re.ua_hash
  LEFT JOIN (
    SELECT ip_hash, ua_hash, COUNT(*) AS dls
    FROM download_events
    WHERE ts >= (NOW() - INTERVAL ? HOUR)
    GROUP BY ip_hash, ua_hash
  ) dl ON dl.ip_hash = re.ip_hash AND dl.ua_hash = re.ua_hash
  WHERE re.ts >= (NOW() - INTERVAL ? HOUR)
  GROUP BY re.ip_hash, re.ua_hash
`

const UPSERT_SQL = `
  INSERT INTO bot_signatures (
    ip_hash, ua_hash, ua_family, ua_sample,
    first_seen, last_seen,
    total_requests, distinct_routes_24h, rate_limit_hits_24h,
    failed_logins_24h, score, classification, country, asn
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    ua_family = VALUES(ua_family),
    last_seen = GREATEST(last_seen, VALUES(last_seen)),
    first_seen = LEAST(first_seen, VALUES(first_seen)),
    total_requests = VALUES(total_requests),
    distinct_routes_24h = VALUES(distinct_routes_24h),
    rate_limit_hits_24h = VALUES(rate_limit_hits_24h),
    failed_logins_24h = VALUES(failed_logins_24h),
    score = VALUES(score),
    -- Geo is stable per IP, but COALESCE preserves a previously-resolved
    -- value when GeoIP is currently unavailable (e.g. MMDB not mounted).
    country = COALESCE(VALUES(country), country),
    asn = COALESCE(VALUES(asn), asn),
    -- Preserve manual overrides: only update classification when the row
    -- was never decided by a human. decided_by IS NULL means auto.
    classification = CASE
      WHEN decided_by IS NULL THEN VALUES(classification)
      ELSE classification
    END
`

const NEWLY_ABUSIVE_INCIDENT_SQL = `
  INSERT INTO abuse_incidents (kind, severity, ip_hash, ua_hash, details)
  SELECT 'crawl_burst', 'warning', ?, ?, ?
  WHERE NOT EXISTS (
    SELECT 1 FROM abuse_incidents
    WHERE ip_hash = ? AND ua_hash = ?
      AND kind = 'crawl_burst'
      AND ts >= (NOW() - INTERVAL 1 HOUR)
  )
`

export default defineTask({
  meta: {
    name: 'analytics:detect-bots',
    description: 'Score active (ip,ua) pairs and refresh bot_signatures'
  },
  async run() {
    const pool = getPool()
    const [rows] = (await pool.query(AGGREGATE_SQL, [
      WINDOW_HOURS,
      WINDOW_HOURS,
      WINDOW_HOURS,
      WINDOW_HOURS,
      WINDOW_HOURS,
      WINDOW_HOURS
    ])) as [AggregateRow[], unknown]

    let upserted = 0
    let newAbusive = 0
    for (const row of rows) {
      const snapshot: ScoreSnapshot = {
        uaFamily: (row.ua_family || 'unknown') as UaFamily,
        totalRequests24h: Number(row.total_requests),
        distinctRoutes24h: Number(row.distinct_routes),
        rateLimitHits24h: Number(row.rate_limit_hits),
        probingHits24h: Number(row.probing_hits),
        failedLogins24h: Number(row.failed_logins),
        downloads24h: Number(row.downloads),
        asn: row.asn != null ? Number(row.asn) : null,
        missingAcceptLanguage: Number(row.any_missing_accept_language) > 0,
        missingAcceptEncoding: Number(row.any_missing_accept_encoding) > 0,
        httpVersion10: Number(row.any_http_10) > 0,
        fuzzAttempts24h: Number(row.fuzz_hits)
      }
      const result = scoreSignature(snapshot)

      await pool.execute(UPSERT_SQL, [
        row.ip_hash,
        row.ua_hash,
        snapshot.uaFamily,
        row.ua_sample,
        row.first_seen,
        row.last_seen,
        snapshot.totalRequests24h,
        snapshot.distinctRoutes24h,
        snapshot.rateLimitHits24h,
        snapshot.failedLogins24h,
        result.score,
        result.classification,
        row.country,
        snapshot.asn
      ])
      upserted++

      if (result.classification === 'abusive') {
        const [insRes] = (await pool.execute(NEWLY_ABUSIVE_INCIDENT_SQL, [
          row.ip_hash,
          row.ua_hash,
          JSON.stringify({
            score: result.score,
            reasons: result.reasons,
            snapshot
          }),
          row.ip_hash,
          row.ua_hash
        ])) as [{ affectedRows: number }, unknown]
        if (insRes.affectedRows > 0) newAbusive++
      }
    }

    return {
      result: {
        scanned: rows.length,
        upserted,
        newAbusiveIncidents: newAbusive
      }
    }
  }
})
