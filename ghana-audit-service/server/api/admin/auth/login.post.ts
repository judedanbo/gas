import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { getDatabase, schema } from '../../../database'
import { verifyPassword } from '../../../utils/password'
import { signToken } from '../../../utils/jwt'
import { resolveUserModules } from '../../../utils/modules'
import { createSession } from '../../../utils/sessions'
import { getSessionConfig } from '../../../utils/duration'
import { checkRateLimit, createRateLimitKey, getClientIP } from '../../../utils/rateLimiter'
import { recordIncident } from '../../../utils/analytics/recordIncident'

function recordFailedLogin(event: Parameters<typeof setHeader>[0], reason: string) {
  // Stash is populated by the capture middleware (00-analytics.ts). Fall
  // back to nulls for the rare case where the middleware didn't run.
  const stash = event.context.analytics
  recordIncident({
    kind: 'failed_login',
    severity: 'info',
    ipHash: stash?.ipHash ?? null,
    uaHash: stash?.uaHash ?? null,
    routePattern: '/api/admin/auth/login',
    routePath: '/api/admin/auth/login',
    details: { reason }
  })
}

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})

// Stricter rate limit for login attempts: 5 per 15 minutes
const LOGIN_RATE_LIMIT = {
  limit: 5,
  windowMs: 15 * 60 * 1000
}

export default defineEventHandler(async (event) => {
  const clientIP = getClientIP(event)

  // Check rate limit for login attempts
  const key = createRateLimitKey(clientIP, '/api/admin/auth/login')
  const { isLimited, remaining, resetTime } = await checkRateLimit(
    key,
    LOGIN_RATE_LIMIT.limit,
    LOGIN_RATE_LIMIT.windowMs
  )

  // Set rate limit headers
  setHeader(event, 'X-RateLimit-Limit', LOGIN_RATE_LIMIT.limit.toString())
  setHeader(event, 'X-RateLimit-Remaining', remaining.toString())
  setHeader(event, 'X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString())

  if (isLimited) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Too many login attempts. Please try again later.'
    })
  }

  // Parse and validate request body
  const body = await readBody(event)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      message: parsed.error.issues[0].message
    })
  }

  const { email, password } = parsed.data
  const db = getDatabase()

  // Find user by email
  const [user] = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.email, email.toLowerCase()),
        eq(schema.users.isActive, true),
        isNull(schema.users.deletedAt)
      )
    )
    .limit(1)

  if (!user) {
    // Log failed login attempt
    await db.insert(schema.auditLogs).values({
      userId: null,
      action: 'login',
      entityType: 'user',
      entityId: null,
      changes: { email, success: false, reason: 'user_not_found' },
      ipAddress: clientIP,
      userAgent: getHeader(event, 'user-agent') || null
    })
    recordFailedLogin(event, 'user_not_found')

    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid email or password'
    })
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.passwordHash)

  if (!isValidPassword) {
    // Log failed login attempt
    await db.insert(schema.auditLogs).values({
      userId: user.id,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      changes: { email, success: false, reason: 'invalid_password' },
      ipAddress: clientIP,
      userAgent: getHeader(event, 'user-agent') || null
    })
    recordFailedLogin(event, 'invalid_password')

    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid email or password'
    })
  }

  // Create a server-side session and pin the JWT lifetime to the
  // absolute session cap so the token and session expire together.
  const { absoluteTimeoutMs } = getSessionConfig()
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
    Math.floor(absoluteTimeoutMs / 1000)
  )

  // Update last login timestamp
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id))

  // Log successful login
  await db.insert(schema.auditLogs).values({
    userId: user.id,
    action: 'login',
    entityType: 'user',
    entityId: user.id,
    changes: { email, success: true },
    ipAddress: clientIP,
    userAgent: getHeader(event, 'user-agent') || null
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      modules: resolveUserModules(user.role, user.modules ?? null)
    },
    token,
    expiresAt: timing.expiresAt,
    session: timing
  }
})
