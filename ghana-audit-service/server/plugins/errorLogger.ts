import type { H3Event } from 'h3'
import { logError } from '../utils/logger'

/**
 * Central backstop for unhandled server errors.
 *
 * Routes we didn't explicitly wrap still throw — Nitro/H3 sanitizes the *client*
 * response for unhandled 500s in production, but its default server logging dumps
 * the full error (stack, internals). This hook logs every server error through
 * `logError` so logs stay sanitized (message-only in production) and consistently
 * scoped, regardless of which route raised it.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error: Error, context: { event?: H3Event }) => {
    const scope = context.event ? `server${context.event.path}` : 'server'
    logError(scope, error)
  })
})
