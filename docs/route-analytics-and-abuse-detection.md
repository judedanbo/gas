# Route Analytics & Abuse Detection — Design

Status: Draft for review
Branch: `claude/route-analytics-abuse-detection-G0BJo`
Owner: TBD
Last updated: 2026-05-10

## 1. Problem & goals

The Ghana Audit Service site (Nuxt 3 + Nitro + Drizzle/MySQL) currently has no
visibility into route-level traffic or behavioural abuse. Operators cannot
answer:

- Which public routes are hot enough to justify the existing 5-minute Nitro
  cache rules — and which routes should be added to them?
- Which audit reports / publications are most downloaded, and by whom?
- Are scrapers, AI crawlers, or scripted clients consuming a disproportionate
  share of bandwidth?
- Are any IPs or user-agents triggering rate limits at a rate that warrants
  intervention?
- Does traffic justify additional capacity (Redis cluster, CDN, larger MySQL)?

This document specifies a system that captures every request, stores both raw
and aggregated data, surfaces decisions through an admin-only dashboard, and
flags abuse for review (never auto-block).

### 1.1 Goals

1. Record every HTTP request with enough fidelity to answer popularity,
   abuse, and capacity questions from the same store.
2. Detect abusive patterns (rate-limit hammering, crawling, AI-agent fetches,
   scripted clients, login pressure) heuristically and visibly.
3. Provide an interactive admin dashboard that supports drill-down from
   summary to individual IP/UA evidence.
4. Preserve privacy: hash IPs, document retention, no third-party transit.
5. Stay inside the existing Drizzle/MySQL conventions; minimise new ops
   surface.

### 1.2 Non-goals

- Auto-blocking IPs. False positives on a public-information government site
  are worse than the abuse; abuse signals tighten quotas and surface to
  admins.
- Cookie-based session analytics or browser fingerprinting. Too much
  privacy/regulatory drag for a government property; IP+UA hashing is
  sufficient for "unique visitors".
- Real-time second-by-second telemetry. The hot path is near-real-time (5 s
  buffer flush, 5-minute Redis windows); the cold path is hourly.
- Replacing the existing rate-limiter. We *back* it with Redis and *feed* it
  with richer signals; the public API stays the same.

### 1.3 Locked decisions (from review)

| Decision      | Choice                                | Rationale                                           |
| ------------- | ------------------------------------- | --------------------------------------------------- |
| Hot store     | Redis 7                               | Live counters + shared rate-limit state             |
| Cold store    | MySQL via Drizzle                     | Reuse existing schema/migration tooling             |
| Sampling      | Log everything; downsample later      | Forensics + per-IP detection need full data         |
| Charts        | Apache ECharts via `vue-echarts`      | Heatmaps, geo maps, sankey for capacity drill-downs |
| First slice   | Full design doc, no code yet          | Review before implementation                        |
| Block policy  | Flag-only; humans tighten/block       | Government site, error costs > miss costs           |

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                Client                                    │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │ HTTP request
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       Nitro middleware chain                             │
│  1. adminAuth.ts        (auth context for /api/admin/**)                 │
│  2. rateLimit.ts        (Redis-backed; was Map-backed)                   │
│  3. analytics.ts (NEW)  (capture event, increment counters, enqueue)     │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │ event handler runs
                                    ▼
                       ┌──────── response sent ────────┐
                       │                                │
                       ▼                                ▼
              ┌────────────────┐              ┌────────────────────┐
              │ Redis (hot)    │              │ In-mem buffer      │
              │ - counters     │              │ - 500 ev / 5 s     │
              │ - rolling sets │              │ - flush to MySQL   │
              │ - rate-limit   │              └────────┬───────────┘
              └────────────────┘                       │
                                                       ▼
                                       ┌────────────────────────────┐
                                       │ MySQL: request_events      │
                                       │ download_events            │
                                       └────────┬───────────────────┘
                                                │ (hourly job)
                                                ▼
                                       ┌────────────────────────────┐
                                       │ MySQL: route_stats_hourly  │
                                       │ bot_signatures             │
                                       │ abuse_incidents            │
                                       └────────┬───────────────────┘
                                                │
                                                ▼
                                       ┌────────────────────────────┐
                                       │ /api/admin/analytics/**    │
                                       │ (rolled-up reads only)     │
                                       └────────┬───────────────────┘
                                                ▼
                                       ┌────────────────────────────┐
                                       │ pages/admin/analytics/*    │
                                       │ ECharts via vue-echarts    │
                                       └────────────────────────────┘
```

### 2.1 Hot path (Redis)

Every request increments small set of TTL'd counters that the rate-limiter
and the abuse detector both consume. Keys:

| Key pattern                              | Type         | TTL    | Use                                   |
| ---------------------------------------- | ------------ | ------ | ------------------------------------- |
| `rl:api:{ipHash}:{minute}`               | counter      | 2 min  | API per-minute rate limit             |
| `rl:dl:{ipHash}:{hour}`                  | counter      | 2 h    | Download per-hour rate limit          |
| `rl:login:{ipHash}:{hour}`               | counter      | 2 h    | Failed-login pressure                 |
| `cnt:route:{routePattern}:{minute}`      | counter      | 10 min | Live "last 60 minutes" sparkline      |
| `cnt:bytes:{routePattern}:{minute}`      | counter      | 10 min | Live bandwidth                        |
| `set:routes:{ipHash}:{hour}`             | hyperloglog  | 2 h    | Distinct routes per IP (crawl signal) |
| `set:ips:{routePattern}:{hour}`          | hyperloglog  | 2 h    | Unique visitors approx per route      |
| `zset:top:{period}`                      | sorted set   | 2 h    | Top routes / top IPs in window        |
| `score:bot:{ipHash}:{uaHash}`            | hash         | 24 h   | Rolling bot score components          |
| `flag:bot:{ipHash}:{uaHash}`             | string       | 24 h   | Cached classification (clean/sus/abus)|

Hyperloglog gives us approximate distinct counts at fixed memory (~12 KB per
key). Sorted sets give cheap top-N reads.

### 2.2 Cold path (MySQL)

Raw events land in `request_events` via a buffered batch insert. Once an hour
a Nitro scheduled task rolls the previous hour into `route_stats_hourly` and
`bot_signatures`; once a day a retention task drops raw events older than 30
days. The dashboard never queries `request_events` for live charts — only for
ad-hoc forensic drill-downs (and even then, time-bounded).

### 2.3 Read path

`/api/admin/analytics/*` endpoints exclusively query rollup tables and Redis
sorted sets. This keeps p95 dashboard latency < 100 ms regardless of raw
event volume.

## 3. Data model

All tables follow the conventions in `server/database/schema/news.ts`:
autoincrement int IDs, `datetime` with `CURRENT_TIMESTAMP` defaults, indexes
declared inline in the table's second arg `(table) => [...]`. Add a new
schema file `server/database/schema/analytics.ts` and re-export from
`schema/index.ts`.

### 3.1 `request_events` (raw, 30-day retention)

```ts
export const requestEvents = mysqlTable(
  'request_events',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    ts: datetime('ts', { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    method: varchar('method', { length: 8 }).notNull(),
    routePattern: varchar('route_pattern', { length: 256 }).notNull(),
    routePath: varchar('route_path', { length: 512 }).notNull(),
    status: smallint('status').notNull(),
    durationMs: int('duration_ms').notNull(),
    bytesOut: int('bytes_out').notNull().default(0),
    cacheHit: boolean('cache_hit').notNull().default(false),
    ipHash: char('ip_hash', { length: 64 }).notNull(),     // sha256 of (ip + salt)
    uaHash: char('ua_hash', { length: 64 }).notNull(),     // sha256 of UA string
    uaFamily: varchar('ua_family', { length: 32 }).notNull().default('unknown'),
    country: char('country', { length: 2 }),
    asn: int('asn'),
    referrerHost: varchar('referrer_host', { length: 128 }),
    isBot: boolean('is_bot'),                              // null = unknown, set lazily
    role: varchar('role', { length: 16 }),                 // 'anon' | 'admin' | 'editor' | 'viewer'
  },
  (t) => [
    index('idx_req_ts').on(t.ts),
    index('idx_req_pattern_ts').on(t.routePattern, t.ts),
    index('idx_req_iphash_ts').on(t.ipHash, t.ts),
    index('idx_req_uahash').on(t.uaHash),
    index('idx_req_status_ts').on(t.status, t.ts),
  ],
);
```

Volume estimate at 50 RPS sustained: ~130 M rows over 30 days; with the
above schema (~120 bytes/row plus indexes) that is roughly 30–40 GB. If
volume is closer to 5 RPS the cost is one tenth of that. We will measure in
the first week of Phase 1 and adjust retention if needed.

### 3.2 `download_events` (1-year retention)

```ts
export const downloadEvents = mysqlTable(
  'download_events',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    ts: datetime('ts', { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    kind: varchar('kind', { length: 16 }).notNull(),       // 'report' | 'publication'
    targetId: int('target_id').notNull(),
    slug: varchar('slug', { length: 256 }),
    durationMs: int('duration_ms').notNull(),
    bytesOut: int('bytes_out').notNull().default(0),
    isPartial: boolean('is_partial').notNull().default(false),  // Range request
    ipHash: char('ip_hash', { length: 64 }).notNull(),
    uaHash: char('ua_hash', { length: 64 }).notNull(),
    uaFamily: varchar('ua_family', { length: 32 }).notNull().default('unknown'),
    country: char('country', { length: 2 }),
    asn: int('asn'),
    isBot: boolean('is_bot'),
  },
  (t) => [
    index('idx_dl_ts').on(t.ts),
    index('idx_dl_kind_target').on(t.kind, t.targetId),
    index('idx_dl_iphash_ts').on(t.ipHash, t.ts),
  ],
);
```

### 3.3 `route_stats_hourly` (indefinite retention)

One row per `(hour, routePattern)`. Filled by the hourly rollup job.

```ts
export const routeStatsHourly = mysqlTable(
  'route_stats_hourly',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    hour: datetime('hour').notNull(),                      // truncated to hour
    routePattern: varchar('route_pattern', { length: 256 }).notNull(),
    visits: int('visits').notNull().default(0),
    uniqueIps: int('unique_ips').notNull().default(0),     // hyperloglog estimate
    botVisits: int('bot_visits').notNull().default(0),
    cacheHits: int('cache_hits').notNull().default(0),
    bytesOut: bigint('bytes_out', { mode: 'number' }).notNull().default(0),
    p50Ms: int('p50_ms').notNull().default(0),
    p95Ms: int('p95_ms').notNull().default(0),
    p99Ms: int('p99_ms').notNull().default(0),
    status2xx: int('status_2xx').notNull().default(0),
    status3xx: int('status_3xx').notNull().default(0),
    status4xx: int('status_4xx').notNull().default(0),
    status5xx: int('status_5xx').notNull().default(0),
  },
  (t) => [
    uniqueIndex('uq_hour_pattern').on(t.hour, t.routePattern),
    index('idx_stats_hour').on(t.hour),
    index('idx_stats_pattern_hour').on(t.routePattern, t.hour),
  ],
);
```

### 3.4 `bot_signatures`

One row per `(ipHash, uaHash)` pair seen, updated incrementally by the
detector.

```ts
export const botSignatures = mysqlTable(
  'bot_signatures',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    ipHash: char('ip_hash', { length: 64 }).notNull(),
    uaHash: char('ua_hash', { length: 64 }).notNull(),
    uaFamily: varchar('ua_family', { length: 32 }).notNull().default('unknown'),
    uaSample: varchar('ua_sample', { length: 512 }),       // last seen UA, truncated
    firstSeen: datetime('first_seen').notNull(),
    lastSeen: datetime('last_seen').notNull(),
    totalRequests: int('total_requests').notNull().default(0),
    distinctRoutes24h: int('distinct_routes_24h').notNull().default(0),
    rateLimitHits24h: int('rate_limit_hits_24h').notNull().default(0),
    failedLogins24h: int('failed_logins_24h').notNull().default(0),
    score: int('score').notNull().default(0),              // 0..100
    classification: varchar('classification', { length: 16 }).notNull().default('clean'),
    notes: text('notes'),
    decidedBy: int('decided_by').references(() => users.id),
    decidedAt: datetime('decided_at'),
    country: char('country', { length: 2 }),
    asn: int('asn'),
  },
  (t) => [
    uniqueIndex('uq_iphash_uahash').on(t.ipHash, t.uaHash),
    index('idx_bot_class_score').on(t.classification, t.score),
    index('idx_bot_lastseen').on(t.lastSeen),
  ],
);
```

`classification` enum: `'clean' | 'crawler' | 'suspicious' | 'abusive' |
'safe-allowlist'`. `safe-allowlist` is admin-set and exempts an IP/UA from
auto-tightening. `decidedBy` + `decidedAt` track human review.

### 3.5 `abuse_incidents`

Discrete events worth surfacing on the abuse tab.

```ts
export const abuseIncidents = mysqlTable(
  'abuse_incidents',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    ts: datetime('ts', { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    kind: varchar('kind', { length: 32 }).notNull(),       // see enum below
    severity: varchar('severity', { length: 16 }).notNull().default('info'),
    ipHash: char('ip_hash', { length: 64 }),
    uaHash: char('ua_hash', { length: 64 }),
    routePattern: varchar('route_pattern', { length: 256 }),
    routePath: varchar('route_path', { length: 512 }),
    details: json('details'),                              // structured evidence
  },
  (t) => [
    index('idx_inc_ts').on(t.ts),
    index('idx_inc_kind_ts').on(t.kind, t.ts),
    index('idx_inc_iphash_ts').on(t.ipHash, t.ts),
    index('idx_inc_severity_ts').on(t.severity, t.ts),
  ],
);
```

`kind` values: `rate_limit_api`, `rate_limit_download`, `rate_limit_form`,
`failed_login`, `probing_path`, `header_anomaly`, `download_burst`,
`crawl_burst`. `severity` ∈ `info | warning | critical`.

## 4. Capture pipeline

### 4.1 Middleware (`server/middleware/analytics.ts`)

Ordered after `adminAuth` (b) and `rateLimit` (r) — must be a name that
sorts after both, e.g. `zAnalytics.ts`, or simpler: rename existing files to
numeric prefixes (`10-adminAuth.ts`, `20-rateLimit.ts`, `30-analytics.ts`).
The latter is cleaner; do that as part of this PR.

Responsibilities:

1. Stamp `event.context.requestStart = performance.now()` at top.
2. Resolve `routePattern` from Nitro's matched route (use
   `event.context.matchedRoute?.path` or fall back to a regex normaliser
   that collapses numeric segments to `[id]` and slugs to `[slug]`).
3. Compute `ipHash`, `uaHash`, `uaFamily`, `referrerHost` once; cache on
   `event.context`.
4. Increment Redis counters (atomic Lua script `analytics.incr`):
   - `cnt:route:*`, `cnt:bytes:*`
   - `set:routes:{ipHash}:{hour}` PFADD
   - `set:ips:{routePattern}:{hour}` PFADD
5. Register an `event.node.res.on('close')` callback that:
   - Computes duration.
   - Detects cache hit (presence of `Cache-Control: max-age` or Nitro's
     internal `_kv` hit flag — TBD; see open question 13.1).
   - Pushes a record into the in-process buffer.

Skip these requests entirely (no event row): static asset paths
(`/_nuxt/**`, `/favicon.ico`, `/sitemap.xml`, `/robots.txt`, `/uploads/**`
that are blocked anyway). Use the existing skip list in
`server/utils/rateLimiter.ts:39`.

### 4.2 Buffered writer (`server/utils/analytics/buffer.ts`)

```
Plugin lifecycle:
  init()  — start a 5-second interval timer; bind to nitroApp 'close' hook
  push(ev) — append to in-memory array; if length >= 500, flush()
  flush() — atomic swap array, INSERT IGNORE batch into request_events
  close()  — flush and clear interval

Backpressure:
  - If MySQL flush takes > 2 s or fails, log and keep accumulating up to a
    hard cap of 5000 events. Beyond that, drop oldest with a warn metric.
  - On crash, in-flight buffer is lost. Acceptable for analytics; not
    acceptable for downloads (which write synchronously) or audit logs.
```

### 4.3 Download events

Inside `server/api/downloads/reports/[id].get.ts` and the publications
equivalent, append a synchronous `await db.insert(downloadEvents).values
(...)` after the response stream completes (in the `res.on('close')` or
`finally` block). Volume is small enough that synchronous writes are fine.

### 4.4 Scheduled jobs (Nitro `scheduledTasks`)

Configure in `nuxt.config.ts` under `nitro.scheduledTasks`:

| Task                        | Cron          | What it does                                           |
| --------------------------- | ------------- | ------------------------------------------------------ |
| `analytics:rollup-hourly`   | `5 * * * *`   | Aggregate previous hour into `route_stats_hourly`     |
| `analytics:detect-bots`     | `*/5 * * * *` | Recompute `score` for active (ipHash, uaHash) pairs   |
| `analytics:retention-raw`   | `0 3 * * *`   | Delete from `request_events` where `ts < NOW() - 30d` |
| `analytics:retention-inc`   | `15 3 * * *`  | Delete from `abuse_incidents` where `severity='info'` and `ts < NOW() - 90d` |
| `analytics:bot-decay`       | `30 3 * * *`  | Decay scores on `bot_signatures` not seen in 7 days   |

The rollup is the heaviest; written as a single SQL statement using window
functions / percentile_cont (MySQL 8 supports these via approximate
percentile via `PERCENT_RANK()` with sorted CTEs, or use `NTILE` for a
cheaper p95 approximation). See appendix A for the query.

## 5. Privacy & retention

| Item                  | Treatment                                           |
| --------------------- | --------------------------------------------------- |
| Raw IP                | Never persisted. Hashed with sha256(ip + ANALYTICS_IP_SALT). |
| `ANALYTICS_IP_SALT`   | 32-byte secret in env. Rotate quarterly (manual; documented). |
| User-Agent string     | Hashed for joining; first 512 chars stored in `bot_signatures.uaSample` for forensic display only. |
| Referrer              | Only host portion (`URL.hostname`) stored. Strip query strings to avoid capturing tokens. |
| Country / ASN         | Resolved locally via MaxMind GeoLite2. No external calls. |
| Raw event retention   | 30 days. Daily delete job.                          |
| Aggregate retention   | Indefinite.                                         |
| Download events       | 1 year (longer because volume is low and the audit-trail value is high). |
| Abuse incidents       | 90 days for `info`, 1 year for `warning`/`critical`.|
| Privacy policy        | `pages/privacy.vue` updated to disclose the above; link from footer. |
| Right-to-erasure      | Hashed IP cannot be reverse-resolved without the salt; rotating the salt effectively anonymises older data. Document this. |

## 6. Abuse detection

A scored, layered approach. No single signal classifies; bots are tagged by
the sum across signals over a 24-hour rolling window.

### 6.1 Signal table

| Signal                           | Source         | Score points | Notes                                  |
| -------------------------------- | -------------- | ------------ | -------------------------------------- |
| Known crawler UA                 | UA classifier  | +10          | Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot, AppleBot, FacebookBot, etc. Tag as `crawler`, not `abusive`. |
| Generic scripted UA              | UA classifier  | +30          | `python-requests`, `curl`, `wget`, `Go-http-client`, `Scrapy`, default Java, default OkHttp, `axios`, `node-fetch`. |
| Empty / minimal UA               | UA classifier  | +25          | Empty, `-`, single token under 10 chars. |
| Missing `Accept-Language`        | Header         | +5           | Most real browsers send it.            |
| Missing `Accept-Encoding`        | Header         | +5           |                                        |
| HTTP/1.0                         | Protocol       | +10          | Real browsers are 1.1+/2/3.            |
| Velocity > 60 req/min            | Redis counter  | +20          | Already triggers rate limit; reinforce. |
| Distinct routes > 50 in 1h       | Redis HLL      | +25          | Crawl signature.                       |
| Probing path hit                 | Path matcher   | +50          | `/wp-admin`, `/.env`, `/.git/config`, `/phpmyadmin`, `/admin/login.php`. Single hit is enough. |
| 5+ failed logins in 1h           | Redis counter  | +40          | Credential stuffing.                   |
| 10+ downloads in 1h              | Redis counter  | +20          | Per IP; legitimate at lower rate.      |
| Range-only repeated downloads    | Download log   | +15          | Same file, multiple Range fetches in short window suggests scraping. |
| Geographic / ASN anomaly         | GeoIP          | +5           | Hosting ASN (DigitalOcean, Hetzner, OVH, AWS, GCP, Azure ranges) on non-API path. |
| Referrer set to internal path    | Header         | +5           | Common spoof.                          |

### 6.2 Buckets

| Score   | Bucket         | Treatment                                           |
| ------- | -------------- | --------------------------------------------------- |
| 0–9     | `clean`        | Default rate limits, no flag.                       |
| 10–34   | `crawler`      | Default rate limits. Tagged in dashboards. Useful for legitimate bots. |
| 35–59   | `suspicious`   | Tightened rate limits (50% of normal quota). Surface in abuse tab. |
| 60+     | `abusive`      | Tight rate limits (10% of normal). Surface prominently. Still no auto-block. |

Admins can manually set `safe-allowlist` (overrides everything) or
`abusive` (forces the tightest tier). All overrides record `decidedBy`
and `decidedAt`.

### 6.3 Detector job

Runs every 5 minutes:

1. Read `score:bot:*` hashes from Redis (expired entries already gone).
2. For each `(ipHash, uaHash)`:
   - Compute total score from stored components.
   - Upsert into `bot_signatures` (merge with any human override).
   - Set `flag:bot:{ipHash}:{uaHash}` in Redis to the bucket name with 24 h
     TTL.
3. Insert into `abuse_incidents` for any newly-`abusive` signature with
   `severity='warning'`, including evidence JSON.

The rate-limit middleware reads `flag:bot:*` to scale quotas live.

## 7. Dashboard UX

Lives at `pages/admin/analytics/`. Sidebar entry "Analytics" with
sub-items "Overview", "Routes", "Downloads", "Abuse", "Capacity". All
gated by `requirePermission('viewer')` (existing helper).

Charts via `vue-echarts` (`<v-chart :option="...">`), one wrapper component
`components/admin/analytics/EChart.vue` to centralise theme, tooltips, and
dark-mode handling. Lazy-import chart types per page to keep bundle
manageable.

### 7.1 Overview (`pages/admin/analytics/index.vue`)

Single scannable page; refreshes every 30 s.

- **Top-line cards** (8 across, wrap to 4×2 on smaller screens):
  Total visits 24 h, Unique visitors 24 h, Downloads 24 h, Bot share %,
  Error rate %, p95 latency, Rate-limit hits 24 h, Cache hit %.
- **Hourly traffic** — stacked area chart, last 7 days. Series: human, bot,
  crawler. Click an hour to drill into Routes tab filtered to that hour.
- **Top 10 routes** — table with sparkline column (last 24 h) and visits.
- **Top 10 reports/publications** — table with downloads count + size.
- **Last 60 minutes** — small live sparkline strip at top, fed from Redis
  (no SQL query path; ~1 ms response).
- **Recent abuse incidents** — last 5, with link to abuse tab.

### 7.2 Routes (`pages/admin/analytics/routes.vue`)

Sortable, filterable table of every `routePattern` that received a hit in
the selected window (default 7 d).

Columns:
- Pattern
- Visits
- Unique IPs (from `route_stats_hourly.uniqueIps` summed; HLL is mergeable)
- p50 / p95 / p99 ms
- Error % (4xx + 5xx)
- Cache hit %
- Avg bytes
- **Caching benefit** = `visits × p95Ms` (proxy for "wall-clock time the
  cache could save"). Sort descending to surface caching candidates.
- Bot share %

Per-row drill-down opens a side panel with:
- Time series of visits (last 30 d)
- Status code mix (donut)
- Top 10 IPs/UAs/countries hitting this pattern
- Download vs. cached vs. miss split
- Link to the Nitro route rule (if any) so admins can see current cache
  config — useful when judging whether to *add* a cache rule.

### 7.3 Downloads (`pages/admin/analytics/downloads.vue`)

- Top 20 reports + publications by download count, with
  Δ-vs-previous-period.
- Time series of downloads per type.
- Country breakdown (ECharts geo map or bar).
- Repeat-downloader leaderboard: top IPs by `downloads / hour`,
  classification badge, click for evidence.
- Partial-download share (Range requests) — small tile.
- Bandwidth chart (bytes per day) — informs CDN decisions.

### 7.4 Abuse (`pages/admin/analytics/abuse.vue`)

This is the operator workbench.

- **Suspect leaderboard** — `bot_signatures` filtered to
  `suspicious | abusive`, ordered by score desc. Columns: classification,
  score, country, ASN, UA family, last seen, requests 24 h, distinct
  routes, rate-limit hits, failed logins.
  - Row actions: **Mark safe** (sets `safe-allowlist`), **Force abusive**
    (manual escalate), **View evidence**. Each action records audit log.
- **Incident timeline** — vertical timeline of `abuse_incidents`,
  filterable by kind/severity/IP/UA. Each item expands to show the JSON
  `details`.
- **Failed-login map** — hourly heatmap (day-of-week × hour-of-day) over
  last 30 days; bright cells indicate sustained attack windows.
- **Probing-path hit list** — what scanners are looking for, useful for
  WAF tuning even if we don't run one yet.
- **Rate-limit hits** — top 20 IPs by rate-limit triggers, with route
  breakdown. Identifies whether to lower or raise specific quotas.

### 7.5 Capacity (`pages/admin/analytics/capacity.vue`)

The infrastructure-planning tab.

- **Requests/sec & bandwidth** — line chart, 30 / 90 / 365 d windows.
- **Cache hit ratio trend** — validates the existing Nitro route rules.
  Highlight any route whose hit ratio has dropped > 10 % week-over-week.
- **Slowest 10 routes by p95** — caching / index candidates.
- **Heaviest 10 routes by bytes** — CDN candidates.
- **Day-of-week × hour-of-day heatmap** — when to schedule maintenance,
  whether to size for peaks.
- **Storage growth** — `request_events` row count and DB size over time;
  signals when to revisit retention.
- **Redis memory** — current usage, key count, eviction count if any.

## 8. Additional metrics (beyond the original ask)

Worth tracking now:

- **Cache-hit ratio per route.** Validates the route rules in
  `nuxt.config.ts`. Without this, we are guessing whether caching helps.
- **Geographic & ASN distribution.** Local MaxMind GeoLite2; no external
  call. ASN is the cleaner bot signal: hosting providers are rarely real
  users on a public-facing gov site.
- **Search queries.** `/api/search` already exists; capture the query
  string into a separate `search_queries` table (kept slim: ts, queryHash,
  queryText, resultCount, resultClicked). **Zero-result queries** are a
  content-gap signal: surface in the admin Search tab.
- **404 hot list.** Top broken paths hit per week → catches link rot in
  recently published material before users complain.
- **Form-abuse stats.** Cross-reference newsletter / contact submission
  IPs with bot signatures; show "spam attempts blocked" and "real
  signups" trend.
- **Referrer breakdown.** Internal vs external vs search-engine vs
  direct. Drives content distribution decisions.
- **Report freshness vs. traffic.** Overlay publish date with download
  count. Confirms (or refutes) that newest reports get all the views;
  informs publication cadence and "long tail" archive UX.
- **Login outcome by IP.** Folds into abuse detection but also a useful
  ops chart (failed-vs-successful login ratio).
- **API consumer mix.** % of `/api/**` traffic from official site vs
  external scripts. Useful if we ever publish a documented API.

Skip:

- **Browser fingerprinting** — privacy & maintenance cost > value.
- **Cookie-based session IDs** — regulatory drag for a gov site.
- **Time-on-page / bounce** unless a tiny client beacon is added in a
  later phase. Out of scope here.

## 9. File-level implementation plan

### 9.1 Infrastructure

- `docker-compose.yml`
  - Add `redis` service (image `redis:7-alpine`), AOF on, 256 MB max
    memory, `allkeys-lru`, healthcheck `redis-cli ping`, volume
    `redis-data`, on `gas-network`.
  - Frontend `depends_on.redis.condition: service_healthy`.
- `.env.example`, `ghana-audit-service/.env.example`
  - `REDIS_URL=redis://redis:6379/0` (Docker) / `redis://localhost:6379/0`
    (local).
  - `ANALYTICS_IP_SALT=` (32-byte hex; document rotation).
  - `ANALYTICS_RETENTION_DAYS=30`.
  - `ANALYTICS_GEOIP_DB_PATH=./data/GeoLite2-Country.mmdb` (optional).
  - `ANALYTICS_ASN_DB_PATH=./data/GeoLite2-ASN.mmdb` (optional).

### 9.2 Schema

- `ghana-audit-service/server/database/schema/analytics.ts` — tables from
  §3.
- `ghana-audit-service/server/database/schema/index.ts` — re-export.
- Generated migration in `server/database/migrations/`.

### 9.3 Server utilities

- `server/utils/redis.ts` — singleton ioredis client with `getRedis()`,
  `closeRedis()`, lazy-connect.
- `server/utils/analytics/buffer.ts` — buffered batch writer; Nitro plugin
  registers timer + close hook.
- `server/utils/analytics/fingerprint.ts`
  - `hashIp(ip: string): string`
  - `hashUa(ua: string): string`
  - `classifyUa(ua: string): { family: UaFamily; isKnownBot: boolean }`
  - `analyseHeaders(req): { score: number; reasons: string[] }`
  - `isProbingPath(path: string): boolean`
  - `normaliseRoutePattern(matched, path): string`
- `server/utils/analytics/geoip.ts` — lazy MaxMind reader; returns
  `{ country, asn }` or `null` if DB not configured.
- `server/utils/analytics/score.ts` — pure scoring function: takes a
  signature snapshot, returns `{ score, classification, reasons }`.
- `server/utils/rateLimiter.ts` — refactor: replace in-memory `Map` with
  Redis (`INCR`/`EXPIRE` Lua script). Public API unchanged. Add a
  `recordRateLimitHit(kind, ipHash, routePattern)` that writes to
  `abuse_incidents`.

### 9.4 Middleware

- Rename `server/middleware/adminAuth.ts` →
  `server/middleware/10-adminAuth.ts`.
- Rename `server/middleware/rateLimit.ts` →
  `server/middleware/20-rateLimit.ts`.
- Add `server/middleware/30-analytics.ts`.
- Update any imports/tests that reference the old paths (search and
  replace).

### 9.5 Download hooks

- `server/api/downloads/reports/[id].get.ts` — append `download_events`
  insert in a `finally` after the stream resolves.
- `server/api/downloads/publications/[id].get.ts` — same.

### 9.6 Scheduled tasks

- `server/tasks/analytics-rollup-hourly.ts`
- `server/tasks/analytics-detect-bots.ts`
- `server/tasks/analytics-retention-raw.ts`
- `server/tasks/analytics-retention-incidents.ts`
- `server/tasks/analytics-bot-decay.ts`
- `nuxt.config.ts` — `nitro.scheduledTasks` config.

### 9.7 Admin API

All under `server/api/admin/analytics/`, all gated by
`requirePermission('viewer')`:

- `overview.get.ts`
- `routes.get.ts` (filterable: window, search)
- `routes/[pattern].get.ts` (drill-down; pattern URL-encoded)
- `downloads.get.ts`
- `bots.get.ts`
- `bots/[id].patch.ts` (update classification, requires `editor`)
- `incidents.get.ts`
- `timeseries.get.ts` (generic time-series endpoint; `?metric=&window=`)
- `search-queries.get.ts`
- `not-found.get.ts`
- `live.get.ts` (last 60 minutes from Redis)

### 9.8 Composables

- `composables/useAnalytics.ts` — typed wrapper around the admin API
  endpoints; reuses `useAdminApi` under the hood. Adds caching via
  `useState` for the slow ones (route list).

### 9.9 Pages & components

- `pages/admin/analytics/index.vue` (Overview)
- `pages/admin/analytics/routes.vue`
- `pages/admin/analytics/downloads.vue`
- `pages/admin/analytics/abuse.vue`
- `pages/admin/analytics/capacity.vue`
- `components/admin/analytics/EChart.vue` (wrapper)
- `components/admin/analytics/StatCard.vue` (or reuse existing
  `AdminUiAdminStatsCard`)
- `components/admin/analytics/RouteRow.vue`
- `components/admin/analytics/IncidentItem.vue`
- `components/admin/analytics/SignatureRow.vue`
- Add nav entry to `AdminLayout` sidebar config.

### 9.10 i18n

- Add the `analytics.*` keys to `i18n/locales/en.json` and `ak.json`.
  (Akan translation for the page titles + chart labels; defer technical
  terms.)

### 9.11 Privacy & docs

- Update `pages/privacy.vue` (or add it; check current state) with the
  hashing/retention disclosure.
- Add a paragraph to `ghana-audit-service/CLAUDE.md` and the root
  `CLAUDE.md` describing the analytics middleware and pointing to this
  doc.

### 9.12 Tests

- Vitest unit:
  - `fingerprint.test.ts` — UA classifier covers known crawlers,
    scripts, browsers; header anomaly scorer; probing path matcher.
  - `score.test.ts` — bucket boundaries, allowlist override, decay.
  - `buffer.test.ts` — flush at threshold, flush on interval, drain on
    close, hard cap behaviour.
  - `route-pattern.test.ts` — pattern normaliser handles dynamic
    segments, query strings, trailing slashes.
- Integration (vitest + ephemeral MySQL/Redis):
  - Rollup correctness against a fixture of synthetic events.
  - Retention deletes only old rows.
- Playwright e2e:
  - Admin viewer can see overview; non-admin gets redirected.
  - Mark-safe action persists and removes from suspect list.

## 10. Phased rollout (revised)

Even though the user opted for "all four phases as one design doc, no code",
the **build** itself is still safer in slices once tickets are cut. Suggested
slicing of the implementation work, in order:

1. **Foundations** — Redis service, env vars, schema migration, redis util,
   rate-limiter refactor (no behaviour change). Mergeable independently;
   verifies infra.
2. **Capture** — middleware, fingerprint utils, buffered writer,
   download-event hooks. Run for ≥ 1 week before the next slice; observe
   actual volume, tune buffer / retention.
3. **Aggregation + Overview & Routes pages** — rollup job, the two main
   tabs.
4. **Abuse** — detector job, bot signatures, incidents tab.
5. **Capacity & enrichment** — GeoIP, ASN, Capacity tab, search-query
   tracking, 404 hot list.

Each slice targets a separate PR off the same branch (or sub-branches).
Total estimate: ~3–5 PRs over 2–3 weeks of focused work.

## 11. Operational runbook (preview)

To be expanded once implemented.

- **Redis is down**: rate limiter falls back to "permit" with a warn
  log; analytics middleware skips its Redis writes but still buffers
  events for MySQL. Site stays up.
- **MySQL flush failing**: buffer accumulates to 5 000 then drops; counter
  in Prometheus / log warns. No user-visible impact until > 30 minutes,
  at which point dashboards are stale.
- **Salt rotation**: deploy new `ANALYTICS_IP_SALT`, restart. Old hashes
  no longer collide with new ones (deduplication breaks for a while).
  Document in privacy notice that salt rotation is an explicit
  anonymising operation.
- **Backfill of historical data**: not supported. Analytics starts at
  Phase 2 deploy time.

## 12. Risks & mitigations

| Risk                                           | Mitigation                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| MySQL load from raw inserts at high traffic    | Buffered batch insert; benchmark on staging with synthetic load     |
| Redis becomes single point of failure          | Rate-limiter degrades open; analytics writes degrade to MySQL-only  |
| GDPR / privacy questions on hashed-IP storage  | Hash with salt, document, link from footer, retention 30 d         |
| ECharts bundle bloat                           | Lazy-import per chart type; only charts in use ship                 |
| Cron jitter / missed task                      | Rollup is idempotent — `INSERT ... ON DUPLICATE KEY UPDATE`         |
| MaxMind GeoLite2 license expiry                | Detect missing/expired DB; fall back to no-country gracefully       |
| False-positive abuse classification            | No auto-block; admins always have the final call                    |
| Schema migration on a live DB                  | Use `INSERT IGNORE` in batch writer; new tables only — no destructive change |
| Hot-key contention on Redis sorted sets        | Period suffix (`{minute}`/`{hour}`) shards the keys naturally       |

## 13. Open questions

13.1 **Cache-hit detection.** Nitro's `cachedEventHandler` and route-rule
caching write to a storage backend. There is no event we can subscribe to
post-hoc to learn whether a hit occurred. Options:
  a) Wrap `cachedEventHandler` ourselves and emit an event tag.
  b) Inspect response headers (`x-nitro-cache`, `cache-control: public,
     max-age=…` set by route rules) — heuristic.
  c) Probe Nitro storage state at request time — too brittle.
Recommendation: option (a). Add a tiny wrapper in `server/utils/cached.ts`
and migrate the few cached endpoints to it, with a comment.

13.2 **MySQL percentile computation.** MySQL 8 lacks a true percentile
aggregate. Options:
  a) `WITH RECURSIVE` per-bucket percent rank — exact, slow.
  b) `NTILE(100)` over `durationMs` ordered — approximate, fast.
  c) Maintain a coarse histogram in Redis (10-bucket log scale) and read
     it for percentiles — fastest, lowest fidelity.
Recommendation: (b) for the rollup job (good enough for ops); (c) for the
live "last 60 min" sparkline.

13.3 **Where does GeoIP enrichment happen?** Three options:
  a) In the middleware, synchronously, on every request. Adds ~50 µs.
  b) In the buffered writer batch, looking up only distinct IP hashes per
     batch. Same data quality, less overhead.
  c) Lazily by the rollup job, populating `country`/`asn` on rollup
     rows. Cheapest; raw rows lack geo data.
Recommendation: (b). Geo on raw events is useful for forensics.

13.4 **Should we surface bot decisions to the rate-limit headers?** If an
admin marks an IP `abusive`, the next request from that IP gets a tightened
quota — but the response headers do not advertise *why*. Should we add an
`X-Abuse-Tier` header for transparency, or stay quiet to avoid teaching
attackers the system? Default is **quiet**; revisit if asked.

13.5 **`safe-allowlist` UI.** Should the operator be able to allow-list by
ASN (e.g. "all Vodafone Ghana") rather than per-IP? Useful for ISPs behind
NAT but more complex to implement. Defer.

13.6 **Historical data import.** The admin team may ask for analytics on
the period before this ships. We have no source of truth (no log files
retained?). Confirm; if needed, scope a separate import from any nginx /
CDN logs that exist.

## 14. Decisions still needed before code lands

| Question                                                       | Default              |
| -------------------------------------------------------------- | -------------------- |
| Commit `GeoLite2-*.mmdb` to repo?                              | No (license, size).  |
| Redis persistence mode                                         | AOF, 256 MB cap, allkeys-lru. |
| Add a `/privacy` page if missing                               | Yes; required.       |
| Surface analytics nav item to `viewer` role or `editor`+ only  | `viewer`+ (least restrictive) |
| Beacon for time-on-page                                        | Defer (Phase 5).     |
| Auto-rotate `ANALYTICS_IP_SALT`                                | Manual, quarterly.   |

## 15. Appendix A — rollup query (sketch)

```sql
INSERT INTO route_stats_hourly (
  hour, route_pattern, visits, unique_ips, bot_visits, cache_hits,
  bytes_out, p50_ms, p95_ms, p99_ms,
  status_2xx, status_3xx, status_4xx, status_5xx
)
SELECT
  DATE_FORMAT(ts, '%Y-%m-%d %H:00:00') AS hour,
  route_pattern,
  COUNT(*)                                         AS visits,
  COUNT(DISTINCT ip_hash)                          AS unique_ips,
  SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END)      AS bot_visits,
  SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END)   AS cache_hits,
  SUM(bytes_out)                                   AS bytes_out,
  -- approximate percentiles via NTILE
  MAX(CASE WHEN bucket = 50  THEN duration_ms END) AS p50_ms,
  MAX(CASE WHEN bucket = 95  THEN duration_ms END) AS p95_ms,
  MAX(CASE WHEN bucket = 99  THEN duration_ms END) AS p99_ms,
  SUM(CASE WHEN status BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2,
  SUM(CASE WHEN status BETWEEN 300 AND 399 THEN 1 ELSE 0 END) AS s3,
  SUM(CASE WHEN status BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS s4,
  SUM(CASE WHEN status BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5
FROM (
  SELECT *,
    NTILE(100) OVER (PARTITION BY route_pattern ORDER BY duration_ms) AS bucket
  FROM request_events
  WHERE ts >= ? AND ts < ?
) e
GROUP BY hour, route_pattern
ON DUPLICATE KEY UPDATE
  visits = VALUES(visits),
  unique_ips = VALUES(unique_ips),
  bot_visits = VALUES(bot_visits),
  cache_hits = VALUES(cache_hits),
  bytes_out = VALUES(bytes_out),
  p50_ms = VALUES(p50_ms),
  p95_ms = VALUES(p95_ms),
  p99_ms = VALUES(p99_ms),
  status_2xx = VALUES(status_2xx),
  status_3xx = VALUES(status_3xx),
  status_4xx = VALUES(status_4xx),
  status_5xx = VALUES(status_5xx);
```

## 16. Appendix B — example dashboard queries

**Top 10 routes last 24 h:**

```sql
SELECT route_pattern, SUM(visits) AS visits,
       SUM(bytes_out) AS bytes,
       AVG(p95_ms)    AS avg_p95,
       AVG(cache_hits / NULLIF(visits, 0)) AS cache_ratio
FROM route_stats_hourly
WHERE hour >= NOW() - INTERVAL 24 HOUR
GROUP BY route_pattern
ORDER BY visits DESC
LIMIT 10;
```

**Caching benefit ranking:**

```sql
SELECT route_pattern,
       SUM(visits)                       AS visits,
       AVG(p95_ms)                       AS p95,
       SUM(visits) * AVG(p95_ms)         AS benefit_ms,
       AVG(cache_hits / NULLIF(visits, 0)) AS current_hit_ratio
FROM route_stats_hourly
WHERE hour >= NOW() - INTERVAL 7 DAY
GROUP BY route_pattern
HAVING current_hit_ratio < 0.5
ORDER BY benefit_ms DESC
LIMIT 20;
```

**Suspect IPs in last 24 h:**

```sql
SELECT ip_hash, ua_family, classification, score,
       total_requests, distinct_routes_24h,
       rate_limit_hits_24h, failed_logins_24h,
       country, asn, last_seen
FROM bot_signatures
WHERE classification IN ('suspicious', 'abusive')
  AND last_seen >= NOW() - INTERVAL 24 HOUR
ORDER BY score DESC, last_seen DESC
LIMIT 50;
```

---

*End of design.* Comments and red-lines welcome on this branch before any
code is committed.
