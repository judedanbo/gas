import { mysqlTable, int, varchar, datetime, boolean, index } from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * Site pop-ups — an image (optionally linked) shown in a modal when a public
 * page loads. Managed at /admin/popups, served by /api/announcement.
 *
 * A pop-up is live when it is active, not deleted, and "now" falls inside its
 * schedule; a null bound is open-ended (startsAt null = from now on, endsAt
 * null = until switched off). It stays on screen for `displaySeconds` and can
 * only be closed earlier when `isDismissible` is set.
 *
 * English only, no translations: the message is in the image itself.
 */
export const popups = mysqlTable(
  'popups',
  {
    id: int('id').primaryKey().autoincrement(),
    // Admin label; also the dialog's accessible name
    title: varchar('title', { length: 255 }).notNull(),
    imageUrl: varchar('image_url', { length: 500 }).notNull(),
    // Text alternative for the image (falls back to the title when empty)
    altText: varchar('alt_text', { length: 500 }),
    linkUrl: varchar('link_url', { length: 500 }),
    openInNewTab: boolean('open_in_new_tab').notNull().default(false),
    startsAt: datetime('starts_at'),
    endsAt: datetime('ends_at'),
    displaySeconds: int('display_seconds').notNull().default(30),
    isDismissible: boolean('is_dismissible').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: datetime('deleted_at')
  },
  (table) => [index('idx_popups_live').on(table.isActive, table.startsAt, table.endsAt)]
)

// Type exports
export type Popup = typeof popups.$inferSelect
export type NewPopup = typeof popups.$inferInsert
