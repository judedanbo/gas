import {
  mysqlTable,
  int,
  bigint,
  smallint,
  varchar,
  char,
  datetime,
  boolean,
  text,
  json,
  index,
  uniqueIndex
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * request_events — raw, per-request log feeding rollups, abuse detection,
 * and ad-hoc forensic drill-downs. Retention is controlled by
 * ANALYTICS_RETENTION_DAYS (default 30) and enforced by a scheduled task.
 *
 * Static-asset paths (/_nuxt/**, /favicon.ico, etc.) are excluded by the
 * capture middleware to keep volume tractable. ipHash is sha256(ip + salt);
 * raw IPs are never persisted.
 */
export const requestEvents = mysqlTable(
  'request_events',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    ts: datetime('ts', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    method: varchar('method', { length: 8 }).notNull(),
    routePattern: varchar('route_pattern', { length: 256 }).notNull(),
    routePath: varchar('route_path', { length: 512 }).notNull(),
    status: smallint('status').notNull(),
    durationMs: int('duration_ms').notNull(),
    bytesOut: int('bytes_out').notNull().default(0),
    cacheHit: boolean('cache_hit').notNull().default(false),
    ipHash: char('ip_hash', { length: 64 }).notNull(),
    uaHash: char('ua_hash', { length: 64 }).notNull(),
    uaFamily: varchar('ua_family', { length: 32 }).notNull().default('unknown'),
    country: char('country', { length: 2 }),
    asn: int('asn'),
    referrerHost: varchar('referrer_host', { length: 128 }),
    isBot: boolean('is_bot'),
    role: varchar('role', { length: 16 }),
    // Header-anomaly signals for the abuse detector. NULL on rows captured
    // before the Phase 5d migration; true/false from then on. The detector
    // treats NULL as "unknown" and fires the signal only on explicit FALSE
    // (header was actually absent on the wire).
    hasAcceptLanguage: boolean('has_accept_language'),
    hasAcceptEncoding: boolean('has_accept_encoding'),
    httpVersion: varchar('http_version', { length: 8 })
  },
  (table) => [
    index('idx_req_ts').on(table.ts),
    index('idx_req_pattern_ts').on(table.routePattern, table.ts),
    index('idx_req_iphash_ts').on(table.ipHash, table.ts),
    index('idx_req_uahash').on(table.uaHash),
    index('idx_req_status_ts').on(table.status, table.ts)
  ]
)

/**
 * download_events — one row per /api/downloads/{type}/{id} fetch.
 * Lower volume than request_events and longer retention because the
 * audit-trail value is high.
 */
export const downloadEvents = mysqlTable(
  'download_events',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    ts: datetime('ts', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    kind: varchar('kind', { length: 16 }).notNull(),
    targetId: int('target_id').notNull(),
    slug: varchar('slug', { length: 256 }),
    durationMs: int('duration_ms').notNull(),
    bytesOut: int('bytes_out').notNull().default(0),
    isPartial: boolean('is_partial').notNull().default(false),
    ipHash: char('ip_hash', { length: 64 }).notNull(),
    uaHash: char('ua_hash', { length: 64 }).notNull(),
    uaFamily: varchar('ua_family', { length: 32 }).notNull().default('unknown'),
    country: char('country', { length: 2 }),
    asn: int('asn'),
    isBot: boolean('is_bot')
  },
  (table) => [
    index('idx_dl_ts').on(table.ts),
    index('idx_dl_kind_target').on(table.kind, table.targetId),
    index('idx_dl_iphash_ts').on(table.ipHash, table.ts)
  ]
)

/**
 * route_stats_hourly — one row per (hour, route_pattern), filled by the
 * hourly rollup task. Powers the dashboards; never queried for live charts
 * (those read Redis sorted sets).
 */
export const routeStatsHourly = mysqlTable(
  'route_stats_hourly',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    hour: datetime('hour').notNull(),
    routePattern: varchar('route_pattern', { length: 256 }).notNull(),
    visits: int('visits').notNull().default(0),
    uniqueIps: int('unique_ips').notNull().default(0),
    botVisits: int('bot_visits').notNull().default(0),
    cacheHits: int('cache_hits').notNull().default(0),
    bytesOut: bigint('bytes_out', { mode: 'number' }).notNull().default(0),
    p50Ms: int('p50_ms').notNull().default(0),
    p95Ms: int('p95_ms').notNull().default(0),
    p99Ms: int('p99_ms').notNull().default(0),
    status2xx: int('status_2xx').notNull().default(0),
    status3xx: int('status_3xx').notNull().default(0),
    status4xx: int('status_4xx').notNull().default(0),
    status5xx: int('status_5xx').notNull().default(0)
  },
  (table) => [
    uniqueIndex('uq_hour_pattern').on(table.hour, table.routePattern),
    index('idx_stats_hour').on(table.hour),
    index('idx_stats_pattern_hour').on(table.routePattern, table.hour)
  ]
)

/**
 * bot_signatures — one row per (ipHash, uaHash) pair the detector has
 * seen. Score is computed by a 5-minute scheduled task; classification
 * is auto-assigned but admins can override (decidedBy / decidedAt).
 *
 * classification values: 'clean' | 'crawler' | 'suspicious' | 'abusive'
 *                      | 'safe-allowlist'
 */
export const botSignatures = mysqlTable(
  'bot_signatures',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    ipHash: char('ip_hash', { length: 64 }).notNull(),
    uaHash: char('ua_hash', { length: 64 }).notNull(),
    uaFamily: varchar('ua_family', { length: 32 }).notNull().default('unknown'),
    uaSample: varchar('ua_sample', { length: 512 }),
    firstSeen: datetime('first_seen').notNull(),
    lastSeen: datetime('last_seen').notNull(),
    totalRequests: int('total_requests').notNull().default(0),
    distinctRoutes24h: int('distinct_routes_24h').notNull().default(0),
    rateLimitHits24h: int('rate_limit_hits_24h').notNull().default(0),
    failedLogins24h: int('failed_logins_24h').notNull().default(0),
    score: int('score').notNull().default(0),
    classification: varchar('classification', { length: 16 }).notNull().default('clean'),
    notes: text('notes'),
    decidedBy: int('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: datetime('decided_at'),
    country: char('country', { length: 2 }),
    asn: int('asn')
  },
  (table) => [
    uniqueIndex('uq_iphash_uahash').on(table.ipHash, table.uaHash),
    index('idx_bot_class_score').on(table.classification, table.score),
    index('idx_bot_lastseen').on(table.lastSeen)
  ]
)

/**
 * abuse_incidents — discrete events worth surfacing in the abuse tab.
 * Severity 'info' is retained 90 days; 'warning' / 'critical' for 1 year.
 *
 * kind values: 'rate_limit_api' | 'rate_limit_download' | 'rate_limit_form'
 *            | 'failed_login' | 'probing_path' | 'header_anomaly'
 *            | 'download_burst' | 'crawl_burst' | 'fuzz_attempt'
 */
export const abuseIncidents = mysqlTable(
  'abuse_incidents',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    ts: datetime('ts', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    kind: varchar('kind', { length: 32 }).notNull(),
    severity: varchar('severity', { length: 16 }).notNull().default('info'),
    ipHash: char('ip_hash', { length: 64 }),
    uaHash: char('ua_hash', { length: 64 }),
    routePattern: varchar('route_pattern', { length: 256 }),
    routePath: varchar('route_path', { length: 512 }),
    details: json('details')
  },
  (table) => [
    index('idx_inc_ts').on(table.ts),
    index('idx_inc_kind_ts').on(table.kind, table.ts),
    index('idx_inc_iphash_ts').on(table.ipHash, table.ts),
    index('idx_inc_severity_ts').on(table.severity, table.ts)
  ]
)

/**
 * search_queries — slim per-search log feeding the admin Insights tab.
 *
 * Captures every /api/search invocation: the query text (truncated), a
 * stable hash for grouping, the result count, and IP/UA fingerprints.
 * Zero-result queries (resultCount = 0) are a content-gap signal —
 * surface them to the content team so they can fill the gap.
 *
 * Retention: same as request_events (ANALYTICS_RETENTION_DAYS, default
 * 30 days) — handled by a small DELETE in the existing retention task.
 */
export const searchQueries = mysqlTable(
  'search_queries',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    ts: datetime('ts', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    queryText: varchar('query_text', { length: 256 }).notNull(),
    queryHash: char('query_hash', { length: 64 }).notNull(),
    locale: char('locale', { length: 8 }),
    resultCount: int('result_count').notNull().default(0),
    ipHash: char('ip_hash', { length: 64 }),
    uaFamily: varchar('ua_family', { length: 32 }).notNull().default('unknown')
  },
  (table) => [
    index('idx_sq_ts').on(table.ts),
    index('idx_sq_hash_ts').on(table.queryHash, table.ts),
    index('idx_sq_zero_ts').on(table.resultCount, table.ts)
  ]
)

// Type exports
export type RequestEvent = typeof requestEvents.$inferSelect
export type NewRequestEvent = typeof requestEvents.$inferInsert
export type DownloadEvent = typeof downloadEvents.$inferSelect
export type NewDownloadEvent = typeof downloadEvents.$inferInsert
export type RouteStatsHourly = typeof routeStatsHourly.$inferSelect
export type NewRouteStatsHourly = typeof routeStatsHourly.$inferInsert
export type BotSignature = typeof botSignatures.$inferSelect
export type NewBotSignature = typeof botSignatures.$inferInsert
export type AbuseIncident = typeof abuseIncidents.$inferSelect
export type NewAbuseIncident = typeof abuseIncidents.$inferInsert
export type SearchQuery = typeof searchQueries.$inferSelect
export type NewSearchQuery = typeof searchQueries.$inferInsert
