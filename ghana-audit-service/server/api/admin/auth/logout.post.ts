import { getDatabase, schema } from '../../../database'
import { getClientIP } from '../../../utils/rateLimiter'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Not authenticated'
    })
  }

  const db = getDatabase()
  const clientIP = getClientIP(event)

  // Log logout action
  await db.insert(schema.auditLogs).values({
    userId: auth.user.id,
    action: 'logout',
    entityType: 'user',
    entityId: auth.user.id,
    changes: { email: auth.user.email },
    ipAddress: clientIP,
    userAgent: getHeader(event, 'user-agent') || null
  })

  return {
    success: true,
    message: 'Logged out successfully'
  }
})
