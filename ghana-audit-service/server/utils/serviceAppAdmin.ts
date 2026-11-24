/** True for MySQL's duplicate-key error on the app address (idx_service_apps_slug). */
export function isDuplicateSlugError(error: unknown): boolean {
  const seen = new Set<unknown>()
  let current: unknown = error
  // Drizzle wraps the driver error in `cause`.
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const err = current as { code?: string; message?: string; cause?: unknown }
    if (err.code === 'ER_DUP_ENTRY' && String(err.message).includes('idx_service_apps_slug')) {
      return true
    }
    current = err.cause
  }
  return false
}
