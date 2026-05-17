import { revokeSessionById } from '../../../../utils/sessions'

/**
 * Revoke a single session by its numeric id. Scoped to the authenticated
 * user, so an admin can only terminate their own sessions.
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

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid session id'
    })
  }

  const revoked = await revokeSessionById(auth.user.id, id)
  if (!revoked) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Session not found or already ended'
    })
  }

  return { success: true }
})
