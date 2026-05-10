import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { getDatabase, schema } from '../../../database'
import { verifyPassword } from '../../../utils/password'
import { signToken, getTokenExpiry } from '../../../utils/jwt'
import { checkRateLimit, createRateLimitKey, getClientIP } from '../../../utils/rateLimiter'

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

    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid email or password'
    })
  }

  // Generate JWT token
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role
  })

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

  // Calculate expiry time
  const expiresAt = getTokenExpiry(token)

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    token,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
  }
})
