import { listSessions } from '../../../utils/sessions'

/**
 * List the current admin user's active sessions (one row per device/login).
 * Used by the profile "active sessions" UI. Only ever exposes the caller's
 * own sessions; the opaque session id is never returned.
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Not authenticated'
    })
  }

  const sessions = await listSessions(auth.user.id, auth.sessionId)
  return { sessions }
})
