import { eq, and, isNull } from 'drizzle-orm'
import { verifyToken } from '../utils/jwt'
import { validateSession, type SessionTiming } from '../utils/sessions'
import { moduleForPath, resolveUserModules, type ModuleKey } from '../utils/modules'
import { getDatabase, schema } from '../database'

export interface AuthenticatedUser {
  id: number
  email: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
  modules: ModuleKey[]
}

export interface AuthContext {
  user: AuthenticatedUser
  token: string
  sessionId: string
  sessionTiming: SessionTiming
}

const SESSION_ERROR_MESSAGES: Record<string, string> = {
  invalid: 'Your session is no longer valid. Please sign in again.',
  revoked: 'Your session has been signed out. Please sign in again.',
  idle: 'Your session expired due to inactivity. Please sign in again.',
  absolute: 'Your session has expired. Please sign in again.'
}

// Extend H3Event context type
declare module 'h3' {
  interface H3EventContext {
    auth?: AuthContext
  }
}

// Routes that don't require authentication
const PUBLIC_ADMIN_ROUTES = [
  '/api/admin/auth/login',
  // PDF-token exchange authenticates via a single-use signed token in the
  // body, minted server-side by the report.pdf endpoint after the admin's
  // Bearer JWT was already validated.
  '/api/admin/auth/exchange-pdf-token',
  // Invitation acceptance: the invitee is not yet authenticated and proves
  // identity via the single-use invitation token in the request.
  '/api/admin/auth/invitation',
  '/api/admin/auth/accept-invitation'
]

// SSE endpoints — EventSource cannot set custom headers, so for these routes
// only we additionally accept the Bearer token via a `token` query parameter.
// Keep this list small and append-only.
const QUERY_TOKEN_ROUTES = ['/api/admin/reports/optimize-stream']

export default defineEventHandler(async (event) => {
  const path = event.path || ''

  // Only protect admin routes
  if (!path.startsWith('/api/admin/')) {
    return
  }

  // Compare against the pathname only — some public routes (e.g. invitation
  // validation) carry query strings that `event.path` would include.
  const pathname = path.split('?')[0]

  // Skip authentication for public admin routes
  if (PUBLIC_ADMIN_ROUTES.includes(pathname)) {
    return
  }

  // Extract Bearer token from Authorization header, or — for SSE routes where
  // EventSource cannot set headers — from a `token` query parameter.
  let token: string | undefined
  const authHeader = getHeader(event, 'Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  } else if (QUERY_TOKEN_ROUTES.includes(path)) {
    const queryToken = getQuery(event).token
    if (typeof queryToken === 'string' && queryToken) token = queryToken
  }

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Missing or invalid authorization header'
    })
  }

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
      modules: schema.users.modules,
      isActive: schema.users.isActive,
      status: schema.users.status,
      deletedAt: schema.users.deletedAt
    })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.id, payload.userId),
        eq(schema.users.isActive, true),
        eq(schema.users.status, 'active'),
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

  // Validate the server-side session. The JWT only carries an opaque
  // session id; the session row decides whether it is still alive and
  // slides the idle window forward on activity.
  const sessionId = payload.sid
  if (!sessionId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: SESSION_ERROR_MESSAGES.invalid,
      data: { code: 'session_invalid' }
    })
  }

  const session = await validateSession(sessionId, { touch: true })
  if (!session.ok || session.userId !== user.id) {
    const reason = session.reason ?? 'invalid'
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: SESSION_ERROR_MESSAGES[reason] ?? SESSION_ERROR_MESSAGES.invalid,
      data: { code: `session_${reason}` }
    })
  }

  // Resolve functional module scope (admins implicitly get all modules) and
  // gate the request on the module its path belongs to. Paths not in the
  // map (auth, upload, users) are not module-gated here.
  const resolvedModules = resolveUserModules(user.role, user.modules ?? null)
  const moduleKey = moduleForPath(path)
  if (moduleKey && user.role !== 'admin' && !resolvedModules.includes(moduleKey)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: `You don't have access to the ${moduleKey} module`
    })
  }

  // Attach authenticated user to event context
  event.context.auth = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      modules: resolvedModules
    },
    token,
    sessionId,
    sessionTiming: session.timing!
  }
})
