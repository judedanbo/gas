/**
 * Allowlist for external download redirects.
 *
 * The publications download endpoint may 302-redirect to an absolute `fileUrl`
 * (legacy crawler-sourced PDFs live on the live site). Because `fileUrl` is
 * admin-controlled and only length-validated, redirecting to it unconditionally
 * is an open redirect. We therefore only redirect to an exact-host allowlist.
 *
 * The allowlist always includes `audit.gov.gh` (the canonical live site, where
 * the legacy PDFs are hosted) and the configured site host, and can be extended
 * with the `DOWNLOAD_REDIRECT_ALLOWED_HOSTS` env var (comma-separated hosts).
 */

const CANONICAL_HOST = 'audit.gov.gh'

function hostFromUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Build the set of lowercased hostnames the app is allowed to redirect to.
 * @param siteUrl typically `runtimeConfig.public.siteUrl`
 */
export function getRedirectAllowedHosts(siteUrl?: string | null): Set<string> {
  const hosts = new Set<string>([CANONICAL_HOST])

  const siteHost = hostFromUrl(siteUrl)
  if (siteHost) hosts.add(siteHost)

  // Additional hosts (same CSV pattern as TRUSTED_PROXIES in rateLimiter.ts).
  for (const entry of process.env.DOWNLOAD_REDIRECT_ALLOWED_HOSTS?.split(',') ?? []) {
    const host = entry.trim().toLowerCase()
    if (host) hosts.add(host)
  }

  return hosts
}

/**
 * True only when `targetUrl` is an absolute http(s) URL whose host is an exact
 * (case-insensitive) match in `allowedHosts`. Relative paths, malformed URLs and
 * non-http(s) schemes return false.
 */
export function isRedirectAllowed(targetUrl: string | null | undefined, allowedHosts: Set<string>): boolean {
  if (!targetUrl) return false
  let url: URL
  try {
    url = new URL(targetUrl)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  return allowedHosts.has(url.hostname.toLowerCase())
}
