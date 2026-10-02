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
 * Who an audit entry is attributed to. Captured from the request up front so
 * work that outlives it (background report uploads, which may even resume on
 * another server) can still log against the admin who started it.
 */
export interface AuditActor {
  userId: number | null
  ipAddress: string | null
  userAgent: string | null
}

export function auditActorFromEvent(event: H3Event): AuditActor {
  return {
    userId: event.context.auth?.user.id || null,
    ipAddress: getClientIP(event),
    userAgent: getHeader(event, 'user-agent') || null
  }
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
    await insertAuditLog(auditActorFromEvent(event), action, entityType, entityId, changes)
  } catch (error) {
    // Log error but don't throw - audit logging should not break the main operation
    logError('AuditLogger', error)
  }
}

/** logAuditAction for work that no longer has its request (see AuditActor). */
export async function logAuditActionAs(
  actor: AuditActor,
  action: AuditAction,
  entityType: string,
  entityId: number | null,
  changes?: AuditChanges
): Promise<void> {
  try {
    await insertAuditLog(actor, action, entityType, entityId, changes)
  } catch (error) {
    logError('AuditLogger', error)
  }
}

async function insertAuditLog(
  actor: AuditActor,
  action: AuditAction,
  entityType: string,
  entityId: number | null,
  changes?: AuditChanges
): Promise<void> {
  await getDatabase()
    .insert(schema.auditLogs)
    .values({
      userId: actor.userId,
      action,
      entityType,
      entityId,
      changes: changes || null,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent
    })
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
