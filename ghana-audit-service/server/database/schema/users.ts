import {
  mysqlTable,
  int,
  varchar,
  datetime,
  boolean,
  mysqlEnum,
  json,
  index
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

/**
 * Users table - Admin users for content management
 */
export const users = mysqlTable(
  'users',
  {
    id: int('id').primaryKey().autoincrement(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    role: mysqlEnum('role', ['admin', 'editor', 'viewer']).notNull().default('viewer'),
    // Functional module scope (orthogonal to role). NULL for admins, who
    // implicitly have every module; an explicit list for editor/viewer.
    modules: json('modules').$type<string[]>(),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: datetime('last_login_at'),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
    deletedAt: datetime('deleted_at')
  },
  (table) => [index('idx_users_email').on(table.email), index('idx_users_role').on(table.role)]
)

/**
 * Audit logs table - Track all content changes
 */
export const auditLogs = mysqlTable(
  'audit_logs',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: mysqlEnum('action', [
      'create',
      'update',
      'delete',
      'restore',
      'login',
      'logout',
      'export'
    ]).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: int('entity_id'),
    changes: json('changes'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 500 }),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`)
  },
  (table) => [
    index('idx_audit_logs_user').on(table.userId),
    index('idx_audit_logs_entity').on(table.entityType, table.entityId),
    index('idx_audit_logs_created').on(table.createdAt)
  ]
)

// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
