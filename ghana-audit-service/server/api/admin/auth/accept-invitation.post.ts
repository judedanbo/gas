import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { acceptInvitationSchema, validateBody } from '../../../utils/validation'
import { hashPassword } from '../../../utils/password'

/**
 * Accept an invitation. Public (the invitee authenticates with their
 * single-use token). Flips the account from 'pending' to 'active', clears the
 * token, and optionally sets a new password chosen by the user. After this the
 * user can sign in with their initial or newly-chosen password.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const input = validateBody(acceptInvitationSchema, body)
  const db = getDatabase()

  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      status: schema.users.status,
      invitationTokenExpiresAt: schema.users.invitationTokenExpiresAt
    })
    .from(schema.users)
    .where(and(eq(schema.users.invitationToken, input.token), isNull(schema.users.deletedAt)))
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

  const updateData: Record<string, unknown> = {
    status: 'active',
    invitationToken: null,
    invitationTokenExpiresAt: null
  }

  // The user may set their own password instead of using the emailed one.
  if (input.password) {
    updateData.passwordHash = await hashPassword(input.password)
  }

  await db.update(schema.users).set(updateData).where(eq(schema.users.id, user.id))

  // Note the acceptance in the audit trail.
  await db.insert(schema.auditLogs).values({
    userId: user.id,
    action: 'update',
    entityType: 'user',
    entityId: user.id,
    changes: { invitationAccepted: true, passwordChanged: Boolean(input.password) },
    ipAddress: getRequestIP(event, { xForwardedFor: true }) || null,
    userAgent: getHeader(event, 'user-agent') || null
  })

  return {
    success: true,
    email: user.email,
    message: 'Invitation accepted. You can now sign in.'
  }
})
