/**
 * Minimal, dependency-free logger for server code.
 *
 * Goals (information-disclosure hardening):
 * - Never log raw error objects — they can carry stack traces, SQL fragments,
 *   connection strings, or other internals into centralized log aggregation.
 * - Only include stack traces in development.
 * - `logInfo` is a no-op in production so dev/startup diagnostics don't leak.
 *
 * Uses `process.env.NODE_ENV` (not `import.meta.dev`) so it works both inside
 * Nitro and in plain `tsx` scripts (seeds/migrations).
 */

const isProd = process.env.NODE_ENV === 'production'

/** Extract a safe, human-readable summary from an unknown thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return String(err)
  } catch {
    return 'Unknown error'
  }
}

/**
 * Log an error without leaking internals to logs. Prints `[scope] <message>`;
 * the stack trace is appended only outside production.
 */
export function logError(scope: string, err: unknown): void {
  console.error(`[${scope}] ${errorMessage(err)}`)
  if (!isProd && err instanceof Error && err.stack) {
    console.error(err.stack)
  }
}

/** Warn-level log (always on). Pass a plain message — never a raw error/object. */
export function logWarn(scope: string, message: string): void {
  console.warn(`[${scope}] ${message}`)
}

/** Info-level log. Suppressed in production (dev/startup diagnostics only). */
export function logInfo(scope: string, message: string): void {
  if (isProd) return
  console.log(`[${scope}] ${message}`)
}
