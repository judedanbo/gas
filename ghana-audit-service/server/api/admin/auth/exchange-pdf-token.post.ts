import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { signToken } from '../../../utils/jwt'
import { createSession } from '../../../utils/sessions'
import { verifyAndConsumePdfToken } from '../../../utils/analytics/pdfToken'
import { getClientIP } from '../../../utils/rateLimiter'

/**
 * Exchange a single-use PDF token (minted by the report.pdf endpoint
 * server-side) for a short-lived admin session JWT. This is the only path
 * for a headless Puppeteer tab to authenticate against the report page
 * without our reusing the admin's long-lived JWT in the URL.
 *
 * Listed in PUBLIC_ADMIN_ROUTES would be ideal, but the surrounding
 * adminAuth.ts middleware short-circuits any /api/admin/ path that isn't
 * in PUBLIC_ADMIN_ROUTES — we don't add it there because we want this
 * route's auth check to live inside the handler itself (the PDF token IS
 * the credential).
 */

// Bypass the global admin auth middleware: we authenticate via the
// pdfToken body, not the Authorization header. The route lives under
// /api/admin/ for discoverability and CSP locality; the middleware's
// allow-list is at the file level so we add this path there instead.
const bodySchema = z.object({
  pdfToken: z.string().min(10).max(2048)
})

const SHORT_SESSION_TTL_SECONDS = 5 * 60

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'pdfToken is required'
    })
  }

  const decoded = await verifyAndConsumePdfToken(parsed.data.pdfToken)
  if (!decoded) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid or expired PDF token'
    })
  }

  const db = getDatabase()
  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      isActive: schema.users.isActive,
      lastLoginAt: schema.users.lastLoginAt,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt
    })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.id, decoded.userId),
        eq(schema.users.isActive, true),
        isNull(schema.users.deletedAt)
      )
    )
    .limit(1)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'User not found or inactive'
    })
  }

  const clientIP = getClientIP(event)
  const { sessionId, timing } = await createSession({
    userId: user.id,
    ipAddress: clientIP,
    userAgent: getHeader(event, 'user-agent') || null
  })

  const token = signToken(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId
    },
    SHORT_SESSION_TTL_SECONDS
  )

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    },
    token,
    expiresAt: timing.expiresAt,
    session: timing
  }
})
