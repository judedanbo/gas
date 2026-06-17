import type { H3Event } from 'h3'
import { getDatabase, schema } from '../database'
import { getClientIP } from './rateLimiter'
import { logError } from './logger'

export type AuditAction = 'create' | 'update' | 'delete' | 'restore' | 'login' | 'logout' | 'export'

export interface AuditChanges {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Log an audit action to the database
 */
export async function logAuditAction(
  event: H3Event,
  action: AuditAction,
  entityType: string,
  entityId: number | null,
  changes?: AuditChanges
): Promise<void> {
  try {
    const db = getDatabase()
    const auth = event.context.auth
    const clientIP = getClientIP(event)
    const userAgent = getHeader(event, 'user-agent') || null

    await db.insert(schema.auditLogs).values({
      userId: auth?.user.id || null,
      action,
      entityType,
      entityId,
      changes: changes || null,
      ipAddress: clientIP,
      userAgent
    })
  } catch (error) {
    // Log error but don't throw - audit logging should not break the main operation
    logError('AuditLogger', error)
  }
}

/**
 * Create a simplified changes object for audit logging
 * Only includes changed fields between before and after
 */
export function createChangesObject(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): AuditChanges {
  const changes: AuditChanges = { before: {}, after: {} }

  // Find changed fields
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of allKeys) {
    // Skip internal fields
    if (['createdAt', 'updatedAt', 'deletedAt', 'passwordHash'].includes(key)) {
      continue
    }

    const beforeVal = JSON.stringify(before[key])
    const afterVal = JSON.stringify(after[key])

    if (beforeVal !== afterVal) {
      changes.before![key] = before[key]
      changes.after![key] = after[key]
    }
  }

  return changes
}

/**
 * Sanitize an object for audit logging
 * Removes sensitive fields like passwords
 */
export function sanitizeForAudit(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['password', 'passwordHash', 'token', 'secret']
  const sanitized = { ...obj }

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }

  return sanitized
}
