import { revokeAllForUser } from '../../../../utils/sessions'

/**
 * Sign out every other session for the current user, keeping the one that
 * made this request. "Log out everywhere else."
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

  await revokeAllForUser(auth.user.id, auth.sessionId)
  return { success: true }
})
