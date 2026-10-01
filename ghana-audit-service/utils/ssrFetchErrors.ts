/**
 * Whether a `useFetch`/`useAsyncData` error recorded during SSR looks
 * transient — a 5xx, a 429, or no HTTP status at all — rather than a stable
 * answer such as a 404. Pages render fallback or empty content when that
 * happens. (429: SSR's internal API calls carry no client IP, so they all share
 * the rate limiter's `unknown` bucket and can trip it under load.)
 */
export function isTransientFetchError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { statusCode, status } = error as { statusCode?: unknown; status?: unknown }
  const code = statusCode ?? status
  return typeof code !== 'number' || code >= 500 || code === 429
}

/** Whether any entry of a Nuxt payload's `_errors` map is transient. */
export function hasTransientFetchError(errors: Record<string, unknown> | undefined): boolean {
  return Object.values(errors ?? {}).some(isTransientFetchError)
}
