import { createError, isError } from 'h3'
import { logError } from './logger'

const GENERIC_500_MESSAGE = 'Something went wrong. Please try again.'

/**
 * Build a sanitized 500 error to throw back to the client.
 *
 * Logs the real error server-side (via `logError`) and returns an H3 error whose
 * only client-visible text is a generic, friendly `message` — no SQL fragments,
 * stack traces, or file paths. The admin UI reads `err.data.message`, so the
 * generic string is what users see.
 *
 * Throwing this (rather than a raw error) also keeps the error *handled*: Nitro
 * only dumps the full error + stack to the console for *unhandled* errors, so a
 * sanitized H3 error keeps SQL/internal details out of the logs too.
 *
 * Usage: `throw internalError('admin:reports', err)`
 */
export function internalError(scope: string, err: unknown, message = GENERIC_500_MESSAGE) {
  logError(scope, err)
  return createError({ statusCode: 500, statusMessage: 'Internal Server Error', message })
}

/**
 * Drop-in replacement for `throw error` in catch blocks.
 *
 * Intentional H3 errors (validation 4xx, auth 401/403, not-found, rate-limit)
 * are passed through unchanged so their deliberate messages still reach the
 * client. Anything else — a raw DB/SQL error, a thrown string, etc. — is logged
 * server-side and replaced with a generic 500, so technical detail never reaches
 * the frontend or the console.
 *
 * Usage: `throw safeError('admin:events', error)`
 */
export function safeError(scope: string, error: unknown) {
  if (isError(error)) return error
  return internalError(scope, error)
}
