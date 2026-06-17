import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../../database'
import { requireAdmin } from '../../../../utils/adminHelpers'
import { logAuditAction } from '../../../../utils/auditLogger'
import { prepareInvitation, dispatchInvitationEmail } from '../../../../utils/invitations'

/**
 * Resend an invitation to a still-pending user. Regenerates the initial
 * password and invitation token (invalidating any previous link) and re-sends
 * the invitation email.
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid ID' })

  const db = getDatabase()
  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      status: schema.users.status
    })
    .from(schema.users)
    .where(and(eq(schema.users.id, id), isNull(schema.users.deletedAt)))
    .limit(1)

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found' })
  }

  if (user.status !== 'pending') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Only pending users can be re-invited.'
    })
  }

  const invitation = await prepareInvitation()

  await db
    .update(schema.users)
    .set({
      passwordHash: invitation.passwordHash,
      invitationToken: invitation.token,
      invitationTokenExpiresAt: invitation.expiresAt
    })
    .where(eq(schema.users.id, id))

  const emailSent = await dispatchInvitationEmail({
    email: user.email,
    name: user.name,
    password: invitation.password,
    token: invitation.token
  })

  await logAuditAction(event, 'update', 'user', id, {
    after: { invitationResent: true }
  })

  return { success: true, emailSent, generatedPassword: invitation.password }
})
