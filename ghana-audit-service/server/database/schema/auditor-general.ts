import {
  mysqlTable,
  int,
  varchar,
  datetime,
  text,
  boolean,
  mysqlEnum,
  index,
  uniqueIndex,
  foreignKey
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

/**
 * Auditor-General message table - Singleton content block for the home page
 * "Message from the Auditor-General" section and the /about/auditor-general
 * full-message page.
 *
 * A single row is created by the seed (edit-only) — there is no create/delete.
 */
export const auditorGeneralMessage = mysqlTable('auditor_general_message', {
  id: int('id').primaryKey().autoincrement(),
  photo: varchar('photo', { length: 500 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: datetime('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
})

/**
 * Auditor-General message translations table
 */
export const auditorGeneralMessageTranslations = mysqlTable(
  'auditor_general_message_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    messageId: int('message_id').notNull(),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    // Short quote shown in the home page blockquote (plain text)
    excerpt: text('excerpt').notNull(),
    // Full message shown on /about/auditor-general (TipTap HTML)
    fullMessage: text('full_message').notNull()
  },
  (table) => [
    uniqueIndex('idx_ag_message_locale').on(table.messageId, table.locale),
    index('idx_ag_message_translations_locale').on(table.locale),
    // Explicit short name — the drizzle-generated default exceeds MySQL's
    // 64-character identifier limit for these table names.
    foreignKey({
      name: 'ag_message_trans_message_id_fk',
      columns: [table.messageId],
      foreignColumns: [auditorGeneralMessage.id]
    }).onDelete('cascade')
  ]
)

// Type exports
export type AuditorGeneralMessageRow = typeof auditorGeneralMessage.$inferSelect
export type NewAuditorGeneralMessage = typeof auditorGeneralMessage.$inferInsert
export type AuditorGeneralMessageTranslation = typeof auditorGeneralMessageTranslations.$inferSelect
export type NewAuditorGeneralMessageTranslation =
  typeof auditorGeneralMessageTranslations.$inferInsert
