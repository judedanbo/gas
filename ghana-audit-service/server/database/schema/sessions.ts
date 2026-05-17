import { mysqlTable, int, varchar, datetime, index } from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * Admin sessions table — authoritative server-side session store.
 *
 * The admin JWT only carries an opaque `sid` that maps to a row here, so
 * sessions can be revoked instantly (logout, "log out everywhere") and
 * idle expiry is enforced server-side rather than trusted to the client.
 * Idle expiry is derived from `last_activity_at + SESSION_IDLE_TIMEOUT`
 * (not stored) so changing the env var takes effect on live sessions.
 */
export const adminSessions = mysqlTable(
  'admin_sessions',
  {
    id: int('id').primaryKey().autoincrement(),
    sessionId: varchar('session_id', { length: 64 }).notNull().unique(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    lastActivityAt: datetime('last_activity_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    absoluteExpiresAt: datetime('absolute_expires_at').notNull(),
    revokedAt: datetime('revoked_at'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 500 })
  },
  (table) => [
    index('idx_admin_sessions_user').on(table.userId),
    index('idx_admin_sessions_absolute_expires').on(table.absoluteExpiresAt)
  ]
)

export type AdminSession = typeof adminSessions.$inferSelect
export type NewAdminSession = typeof adminSessions.$inferInsert
