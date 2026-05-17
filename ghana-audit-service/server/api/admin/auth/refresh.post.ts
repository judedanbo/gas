import { validateSession } from '../../../utils/sessions'

/**
 * Slide the idle window forward for the current session. Backs the
 * "Stay logged in" button and silent keep-alive on user activity.
 *
 * The session is already proven alive by adminAuth middleware; `force`
 * guarantees last_activity_at is written even if the throttle would have
 * skipped it, then returns the fresh timing for the client countdown.
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

  const result = await validateSession(auth.sessionId, { force: true })
  if (!result.ok) {
    const reason = result.reason ?? 'invalid'
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Your session has expired. Please sign in again.',
      data: { code: `session_${reason}` }
    })
  }

  return {
    session: result.timing,
    expiresAt: result.timing!.expiresAt
  }
})
