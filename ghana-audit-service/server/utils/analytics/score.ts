/**
 * Pure scoring + classification for (ipHash, uaHash) signatures.
 *
 * Rules track design doc §6.1 with a Phase 4 subset: signals that we can
 * compute from data already captured. Header-anomaly signals (missing
 * Accept-Language / Accept-Encoding, HTTP/1.0) and ASN/geo heuristics will
 * land with the Phase 5 enrichment work.
 *
 * The function is deterministic — same input, same output — and stateless.
 * That makes it cheap to test and easy to reason about in production.
 */

import type { UaFamily } from './fingerprint'
import { isHostingAsn } from './geoip'

export type Classification = 'clean' | 'crawler' | 'suspicious' | 'abusive' | 'safe-allowlist'

export interface ScoreSnapshot {
  uaFamily: UaFamily
  totalRequests24h: number
  distinctRoutes24h: number
  rateLimitHits24h: number
  probingHits24h: number
  failedLogins24h: number
  downloads24h: number
  /** Optional ASN (autonomous system number) for the source IP. When set,
   *  matching against a known cloud/hosting ASN list adds +5. */
  asn?: number | null
  /** Header-anomaly signals (Phase 5d). True means "this signature has
   *  been observed with the anomaly at least once in the window" — i.e.
   *  a single offending request is enough to flag the (ip,ua) pair.
   *  Real browsers send Accept-Language / Accept-Encoding on every
   *  request; bots routinely skip them. HTTP/1.0 in 2026 is almost
   *  exclusively scripted clients. */
  missingAcceptLanguage?: boolean
  missingAcceptEncoding?: boolean
  httpVersion10?: boolean
  /** Phase 5f: fuzz_attempt incident count in the 24h window. Any value
   *  > 0 is a near-conclusive signal — fuzzing is unambiguous attack
   *  behaviour. Mirrors probingHits24h in weight (+50). */
  fuzzAttempts24h?: number
}

export interface ScoreResult {
  score: number
  classification: Exclude<Classification, 'safe-allowlist'>
  reasons: string[]
}

/**
 * Apply the bucket override rules:
 * - 'safe-allowlist' wins over everything (admin opt-out for known-good
 *   IPs / ASNs / corp networks behind NAT)
 * - 'abusive' as a manual override forces tight quotas
 * - Otherwise return the auto-computed bucket
 */
export function effectiveClassification(
  override: Classification | null | undefined,
  computed: ScoreResult['classification']
): Classification {
  if (override === 'safe-allowlist') return 'safe-allowlist'
  if (override === 'abusive') return 'abusive'
  return computed
}

export function scoreSignature(snapshot: ScoreSnapshot): ScoreResult {
  let score = 0
  const reasons: string[] = []

  switch (snapshot.uaFamily) {
    case 'crawler':
      // Legitimate bots (Googlebot, ClaudeBot, etc.) — tag, don't punish.
      score += 10
      reasons.push('known_crawler_ua:+10')
      break
    case 'script':
      score += 30
      reasons.push('scripted_ua:+30')
      break
    case 'empty':
      score += 25
      reasons.push('empty_ua:+25')
      break
    default:
      // browser / unknown contribute nothing on UA alone.
      break
  }

  if (snapshot.distinctRoutes24h > 50) {
    score += 25
    reasons.push(`crawl_signature(${snapshot.distinctRoutes24h}_routes):+25`)
  }
  if (snapshot.rateLimitHits24h > 0) {
    // Rate-limit hits are themselves an aggregate of bursts; one hit
    // doesn't always mean abuse, but it warrants reinforcement.
    score += 20
    reasons.push(`rate_limit_hits(${snapshot.rateLimitHits24h}):+20`)
  }
  if (snapshot.probingHits24h > 0) {
    score += 50
    reasons.push(`probing_path_hit(${snapshot.probingHits24h}):+50`)
  }
  if (snapshot.failedLogins24h >= 5) {
    score += 40
    reasons.push(`credential_pressure(${snapshot.failedLogins24h}_failed):+40`)
  }
  if (snapshot.downloads24h > 10) {
    score += 20
    reasons.push(`download_burst(${snapshot.downloads24h}):+20`)
  }
  if (isHostingAsn(snapshot.asn)) {
    // Real users almost never arrive from cloud-provider ASNs on a
    // public-information government site. Weak signal on its own (+5) but
    // useful in combination with other rules.
    score += 5
    reasons.push(`hosting_asn(${snapshot.asn}):+5`)
  }
  if (snapshot.missingAcceptLanguage) {
    score += 5
    reasons.push('missing_accept_language:+5')
  }
  if (snapshot.missingAcceptEncoding) {
    score += 5
    reasons.push('missing_accept_encoding:+5')
  }
  if (snapshot.httpVersion10) {
    score += 10
    reasons.push('http_1_0:+10')
  }
  if ((snapshot.fuzzAttempts24h ?? 0) > 0) {
    // Fuzzing is unambiguously hostile. +50 puts a clean signature into
    // the suspicious bucket on its own and into abusive when paired with
    // any other signal.
    score += 50
    reasons.push(`fuzz_attempt(${snapshot.fuzzAttempts24h}):+50`)
  }

  let classification: ScoreResult['classification']
  if (score >= 60) classification = 'abusive'
  else if (score >= 35) classification = 'suspicious'
  else if (score >= 10) classification = 'crawler'
  else classification = 'clean'

  return { score, classification, reasons }
}
