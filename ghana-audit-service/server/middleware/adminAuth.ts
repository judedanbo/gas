import { eq, and, isNull } from 'drizzle-orm'
import { verifyToken } from '../utils/jwt'
import { getDatabase, schema } from '../database'

export interface AuthenticatedUser {
  id: number
  email: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
}

export interface AuthContext {
  user: AuthenticatedUser
  token: string
}

// Extend H3Event context type
declare module 'h3' {
  interface H3EventContext {
    auth?: AuthContext
  }
}

// Routes that don't require authentication
const PUBLIC_ADMIN_ROUTES = ['/api/admin/auth/login']

export default defineEventHandler(async (event) => {
  const path = event.path || ''

  // Only protect admin routes
  if (!path.startsWith('/api/admin/')) {
    return
  }

  // Skip authentication for public admin routes
  if (PUBLIC_ADMIN_ROUTES.includes(path)) {
    return
  }

  // Extract Bearer token from Authorization header
  const authHeader = getHeader(event, 'Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Missing or invalid authorization header'
    })
  }

  const token = authHeader.substring(7)

  // Verify JWT token
  const payload = verifyToken(token)
  if (!payload) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid or expired token'
    })
  }

  // Fetch user from database to ensure they still exist and are active
  const db = getDatabase()
  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      isActive: schema.users.isActive,
      deletedAt: schema.users.deletedAt
    })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.id, payload.userId),
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

  // Attach authenticated user to event context
  event.context.auth = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    token
  }
})
