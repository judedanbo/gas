import type { H3Event } from 'h3'
import type { AuthenticatedUser } from '../middleware/adminAuth'

export { requireModuleAccess, userHasModule } from './modules'
export type { ModuleKey } from './modules'

export type Permission = 'read' | 'create' | 'update' | 'delete' | 'manage_users'

// Role permissions mapping
const rolePermissions: Record<string, Permission[]> = {
  admin: ['read', 'create', 'update', 'delete', 'manage_users'],
  editor: ['read', 'create', 'update'],
  viewer: ['read']
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = rolePermissions[role]
  if (!permissions) return false
  return permissions.includes(permission)
}

/**
 * Require a permission, throws 403 if not granted
 */
export function requirePermission(event: H3Event, permission: Permission): void {
  const auth = event.context.auth
  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required'
    })
  }

  if (!hasPermission(auth.user.role, permission)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: `You don't have permission to ${permission.replace('_', ' ')}`
    })
  }
}

/**
 * Get current authenticated user from event context
 * Throws 401 if not authenticated
 */
export function getCurrentUser(event: H3Event): AuthenticatedUser {
  const auth = event.context.auth
  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required'
    })
  }
  return auth.user
}

/**
 * Check if current user is admin
 */
export function isAdmin(event: H3Event): boolean {
  const auth = event.context.auth
  return auth?.user.role === 'admin'
}

/**
 * Require admin role, throws 403 if not admin
 */
export function requireAdmin(event: H3Event): void {
  const user = getCurrentUser(event)
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Admin access required'
    })
  }
}

/**
 * Build pagination meta object
 */
export function buildPaginationMeta(total: number, page: number, perPage: number) {
  return {
    total,
    page,
    perPage,
    lastPage: Math.ceil(total / perPage)
  }
}

/**
 * Parse pagination query parameters
 */
export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(100, Math.max(1, Number(query.perPage) || 20))
  const offset = (page - 1) * perPage

  return { page, perPage, offset }
}

/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Format date for database
 */
export function formatDateForDB(date: Date | string): string {
  const d = new Date(date)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}
