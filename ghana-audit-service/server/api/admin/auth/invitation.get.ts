import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'

/**
 * Validate an invitation token. Public (the invitee is not yet authenticated).
 * Returns the invitee's name/email so the accept page can greet them, or a
 * 400/410 if the token is unknown or expired.
 */
export default defineEventHandler(async (event) => {
  const token = getQuery(event).token

  if (typeof token !== 'string' || !token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invitation token is required'
    })
  }

  const db = getDatabase()
  const [user] = await db
    .select({
      name: schema.users.name,
      email: schema.users.email,
      status: schema.users.status,
      invitationTokenExpiresAt: schema.users.invitationTokenExpiresAt
    })
    .from(schema.users)
    .where(and(eq(schema.users.invitationToken, token), isNull(schema.users.deletedAt)))
    .limit(1)

  if (!user || user.status !== 'pending') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'This invitation is invalid or has already been accepted.'
    })
  }

  if (user.invitationTokenExpiresAt && user.invitationTokenExpiresAt.getTime() < Date.now()) {
    throw createError({
      statusCode: 410,
      statusMessage: 'Gone',
      message: 'This invitation has expired. Please ask an administrator to resend it.'
    })
  }

  return { valid: true, name: user.name, email: user.email }
})
