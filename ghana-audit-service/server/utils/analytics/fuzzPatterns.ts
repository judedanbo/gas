/**
 * Fuzz-attack pattern detection for user-controlled inputs.
 *
 * Mirrors the structure of probingPaths.ts: a curated regex set + a thin
 * analyser. Triggered from the capture middleware (query strings) and
 * the public form handlers (body fields). Every match is fire-and-forget
 * recorded as a `fuzz_attempt` abuse incident; the request itself
 * completes normally per the design doc's flag-only policy (§1.3).
 *
 * Pattern philosophy: prefer combined / contextual matches over
 * single-character ones to keep false positives near zero. Real users
 * routinely send apostrophes ("John's report", "We can't ship") and
 * hyphens ("re-issue"), so the SQL family only fires on patterns that
 * can't be confused with prose.
 *
 * Add to a family as we observe new payloads in the wild — keep the
 * lists explicit rather than relying on heuristics that creep over time.
 */

export type FuzzKind =
  | 'sqli'
  | 'xss'
  | 'path_traversal'
  | 'ssrf'
  | 'length_anomaly'
  | 'encoded_payload'

export interface FuzzMatch {
  kind: FuzzKind
  field: string
  /** Truncated to 200 chars for the abuse_incidents.details JSON. */
  sample: string
}

/** Detection severity per family. Used by the middleware to choose
 *  the abuse_incidents.severity value at record time. */
export function severityFor(kind: FuzzKind): 'info' | 'warning' | 'critical' {
  switch (kind) {
    case 'sqli':
    case 'path_traversal':
      return 'critical'
    case 'xss':
    case 'ssrf':
    case 'encoded_payload':
      return 'warning'
    case 'length_anomaly':
    default:
      return 'info'
  }
}

// ─────────────────────────────────────────────────────────────────────
// Pattern families
// ─────────────────────────────────────────────────────────────────────

// SQL injection — combined patterns only. A bare apostrophe doesn't
// fire; "' OR 1=1" does.
const SQLI_PATTERNS: RegExp[] = [
  /'\s*(or|and)\s+\S+\s*=/i, // ' OR 1=1, ' AND col=val
  /\bunion\s+(all\s+)?select\b/i, // UNION SELECT, UNION ALL SELECT
  /;\s*(drop|delete|update|insert|truncate|alter|create)\s+/i, // ; DROP TABLE
  /\bxp_cmdshell\b/i,
  /'\s*;\s*--/, // '; --
  /\b(sleep|benchmark|pg_sleep)\s*\(/i, // time-based blind SQLi
  /\binformation_schema\b/i, // schema enumeration
  /\b(load_file|outfile)\s*\(/i // file-read SQLi
]

const XSS_PATTERNS: RegExp[] = [
  /<\s*script[\s>]/i,
  /<\s*\/\s*script\s*>/i,
  /javascript\s*:/i,
  /\bon(error|load|click|mouseover|focus|submit|abort)\s*=/i,
  /<\s*iframe[\s>]/i,
  /<\s*svg[\s>][^>]*on\w+\s*=/i, // <svg onload=...>
  /\bdocument\.cookie\b/i,
  /\bwindow\.location\b/i
]

const PATH_TRAVERSAL_PATTERNS: RegExp[] = [
  /\.\.[\\/]/, // ../ or ..\
  /\/etc\/passwd\b/i,
  /[a-z]:[\\/]windows\b/i, // c:\windows, c:/windows
  /\/proc\/self\b/i,
  /boot\.ini\b/i
]

const SSRF_PATTERNS: RegExp[] = [
  /^\s*(file|gopher|dict|ldap|tftp):\/\//i,
  /\b169\.254\.169\.254\b/, // AWS / GCP metadata IP
  /\bmetadata\.google\.internal\b/i
]

// Encoded-payload heuristic: regex-based detection of percent-encoded
// SQL injection / XSS bytes near matching keywords. Single benign tokens
// like %20 (space) don't trip these — we require an encoded apostrophe /
// angle bracket sitting next to a relevant keyword.
//
// Note: we use letter-only lookarounds `(?<![a-z])` / `(?![a-z])` instead
// of `\b`. The percent-encoded space `%20` ends in a digit, and JS treats
// digits as word chars — so `\bor\b` would fail to match `OR` between
// `%20` and `%20`. Letter-boundary lookarounds also cleanly exclude the
// false positive of "report" / "horror" / etc. containing the keyword
// letters mid-word.
const ENCODED_PAYLOAD_PATTERNS: RegExp[] = [
  /%27.{0,40}(?<![a-z])(or|and|union|select|drop|delete|insert|update)(?![a-z])/i,
  /%3c.{0,20}(script|iframe|svg|img|onerror|onload|onclick)/i, // %3c < near tag/handler
  /%2d%2d/i, // -- comment
  /%00/ // null byte injection
]

// Length anomaly threshold for free-text inputs. 1024 chars is well past
// the longest legitimate report search query observed; deliberate
// overflow probes typically run into the thousands.
const LENGTH_ANOMALY_THRESHOLD = 1024

// ─────────────────────────────────────────────────────────────────────
// Analyser
// ─────────────────────────────────────────────────────────────────────

function truncate(s: string, n = 200): string {
  return s.length <= n ? s : s.slice(0, n)
}

function detectEncodedPayload(input: string): boolean {
  for (const re of ENCODED_PAYLOAD_PATTERNS) {
    if (re.test(input)) return true
  }
  return false
}

/**
 * Inspect a single value. Returns the highest-severity match if any,
 * otherwise null. We only return one match per value — the first family
 * to fire wins, in priority order (sqli > path_traversal > xss > ssrf >
 * encoded_payload > length_anomaly). The detector doesn't need the full
 * list per value, just the top signal.
 */
export function analyseInput(input: string, field: string): FuzzMatch | null {
  if (!input) return null
  // Skip very short inputs: not enough signal, mostly noise.
  if (input.length < 4) return null

  // SQL — high priority.
  for (const re of SQLI_PATTERNS) {
    if (re.test(input)) return { kind: 'sqli', field, sample: truncate(input) }
  }
  // Path traversal.
  for (const re of PATH_TRAVERSAL_PATTERNS) {
    if (re.test(input)) {
      return { kind: 'path_traversal', field, sample: truncate(input) }
    }
  }
  // XSS.
  for (const re of XSS_PATTERNS) {
    if (re.test(input)) return { kind: 'xss', field, sample: truncate(input) }
  }
  // SSRF.
  for (const re of SSRF_PATTERNS) {
    if (re.test(input)) return { kind: 'ssrf', field, sample: truncate(input) }
  }
  // Encoded payload — distinct enough to fire on its own.
  if (detectEncodedPayload(input)) {
    return { kind: 'encoded_payload', field, sample: truncate(input) }
  }
  // Length anomaly — last (lowest-severity) check.
  if (input.length > LENGTH_ANOMALY_THRESHOLD) {
    return { kind: 'length_anomaly', field, sample: truncate(input) }
  }
  return null
}

/**
 * Scan every value in a URL query string. Returns one FuzzMatch per
 * matching field; multiple distinct fields can trip simultaneously
 * (e.g. ?search=<script>&category=' OR 1=1).
 */
export function analyseQueryString(rawPath: string): FuzzMatch[] {
  const qIndex = rawPath.indexOf('?')
  if (qIndex < 0) return []
  const qs = rawPath.slice(qIndex + 1)
  if (!qs) return []

  const matches: FuzzMatch[] = []
  let params: URLSearchParams
  try {
    params = new URLSearchParams(qs)
  } catch {
    return []
  }
  for (const [field, value] of params) {
    // Probe both the decoded value (URLSearchParams already decodes) and
    // the raw encoded form so percent-encoded payloads hidden under
    // legitimate-looking field names still fire on encoded_payload.
    const decoded = analyseInput(value, field.slice(0, 32))
    if (decoded) {
      matches.push(decoded)
      continue
    }
    const rawValue = qs
      .split('&')
      .find((kv) => kv.split('=')[0] === field)
      ?.split('=')[1]
    if (rawValue && /%[0-9a-f]{2}/i.test(rawValue)) {
      const enc = analyseInput(rawValue, field.slice(0, 32))
      if (enc) matches.push(enc)
    }
  }
  return matches
}

/**
 * Scan a parsed form body (after handler validation). Skips known
 * password-like fields so legitimate special-character passwords don't
 * trip the SQL family.
 */
const SKIP_FIELDS = new Set(['password', 'passwordHash', 'token', 'csrf'])

export function analyseBodyFields(body: Record<string, unknown>): FuzzMatch[] {
  const matches: FuzzMatch[] = []
  for (const [field, value] of Object.entries(body)) {
    if (SKIP_FIELDS.has(field)) continue
    if (typeof value !== 'string') continue
    const m = analyseInput(value, field.slice(0, 32))
    if (m) matches.push(m)
  }
  return matches
}

/**
 * Helper: when multiple matches fire at once, pick the most-severe one
 * for the abuse_incidents.severity column. The full list still goes
 * into details so admins can see everything.
 */
export function highestSeverity(matches: FuzzMatch[]): 'info' | 'warning' | 'critical' {
  let best: 'info' | 'warning' | 'critical' = 'info'
  for (const m of matches) {
    const s = severityFor(m.kind)
    if (s === 'critical') return 'critical'
    if (s === 'warning' && best === 'info') best = 'warning'
  }
  return best
}

/**
 * Stable fingerprint of the match kinds present in a fuzz incident.
 * Used as the dedup key suffix in recordIncidentDeduped so distinct
 * payload families from the same (ipHash, routePattern) still each
 * generate one incident per window (e.g. a signature that fuzzes both
 * SQLi and XSS gets two rows, not one).
 */
export function matchKindFingerprint(matches: FuzzMatch[]): string {
  return Array.from(new Set(matches.map((m) => m.kind)))
    .sort()
    .join(',')
}
