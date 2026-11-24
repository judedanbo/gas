import {
  mysqlTable,
  int,
  varchar,
  text,
  boolean,
  datetime,
  uniqueIndex
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * Site languages other than English, managed at /admin/languages.
 *
 * A row means the language has been added; `isEnabled` decides whether
 * visitors can reach it (`/<code>/...` and the language switcher). Languages
 * start disabled. English is the built-in default and has no row. `code` must
 * be one of the codes in utils/languageCatalog.ts — locale routes are built
 * with the app, so only catalogue languages can be served.
 */
export const languages = mysqlTable('languages', {
  code: varchar('code', { length: 10 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  nativeName: varchar('native_name', { length: 100 }).notNull(),
  isEnabled: boolean('is_enabled').notNull().default(false),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: datetime('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: datetime('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
  updatedBy: int('updated_by').references(() => users.id, { onDelete: 'set null' })
})

/**
 * Interface text translations entered in the admin panel: one row per
 * (language, message key), where the key is a dotted path into
 * i18n/locales/en.json (e.g. `nav.home`). A row takes precedence over the
 * language's bundled file (only Akan ships one); a key with neither falls back
 * to English.
 */
export const uiTranslations = mysqlTable(
  'ui_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    locale: varchar('locale', { length: 10 })
      .notNull()
      .references(() => languages.code, { onDelete: 'cascade' }),
    messageKey: varchar('message_key', { length: 191 }).notNull(),
    value: text('value').notNull(),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
    updatedBy: int('updated_by').references(() => users.id, { onDelete: 'set null' })
  },
  (table) => [uniqueIndex('idx_ui_translations_key').on(table.locale, table.messageKey)]
)

export type LanguageRow = typeof languages.$inferSelect
export type UiTranslationRow = typeof uiTranslations.$inferSelect
