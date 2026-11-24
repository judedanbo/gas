import {
  mysqlTable,
  int,
  varchar,
  datetime,
  text,
  boolean,
  json,
  mysqlEnum,
  index,
  uniqueIndex
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * Audit Service apps and websites (CitizensEye, the Recommendations Tracker,
 * …), managed at /admin/apps. Each one gets a landing page at the top-level
 * address `/<slug>` (pages/[slug].vue) and a card on the /apps hub. The shape
 * of the text and page sections is in utils/serviceApps.ts.
 *
 * Deleting an app removes the row (the audit log keeps a copy), so its address
 * is free to reuse straight away.
 */
export const serviceApps = mysqlTable(
  'service_apps',
  {
    id: int('id').primaryKey().autoincrement(),
    // Page address on this site: /<slug>. See appSlugProblem() for the rules.
    slug: varchar('slug', { length: 60 }).notNull(),
    // Where the app itself lives (opened in a new tab).
    url: varchar('url', { length: 500 }).notNull(),
    // Uploaded logo; null shows the GAS logo (DEFAULT_APP_LOGO).
    logoUrl: varchar('logo_url', { length: 500 }),
    // Optional screenshot shown on the landing page (the logo shows otherwise).
    imageUrl: varchar('image_url', { length: 500 }),
    // The app's privacy notice: a page on this site or an external URL.
    privacyUrl: varchar('privacy_url', { length: 500 }),
    sortOrder: int('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: int('updated_by').references(() => users.id, { onDelete: 'set null' })
  },
  (table) => [
    uniqueIndex('idx_service_apps_slug').on(table.slug),
    index('idx_service_apps_listing').on(table.isActive, table.sortOrder)
  ]
)

/**
 * Text of an app per language. English is required; anything another language
 * leaves empty shows the English (see mergeAppTranslation()).
 */
export const serviceAppTranslations = mysqlTable(
  'service_app_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    appId: int('app_id')
      .notNull()
      .references(() => serviceApps.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    tagline: varchar('tagline', { length: 255 }),
    summary: varchar('summary', { length: 500 }).notNull(),
    headline: varchar('headline', { length: 255 }),
    // Rich text (HTML from the admin editor), sanitized when rendered.
    body: text('body'),
    launchLabel: varchar('launch_label', { length: 100 }),
    imageAlt: varchar('image_alt', { length: 500 }),
    ctaTitle: varchar('cta_title', { length: 255 }),
    ctaText: varchar('cta_text', { length: 500 }),
    // Page sections (features, steps, audiences, highlights, faqs) — AppContent.
    content: json('content')
  },
  (table) => [uniqueIndex('idx_service_app_locale').on(table.appId, table.locale)]
)

// Type exports
export type ServiceAppRow = typeof serviceApps.$inferSelect
export type NewServiceAppRow = typeof serviceApps.$inferInsert
export type ServiceAppTranslationRow = typeof serviceAppTranslations.$inferSelect
export type NewServiceAppTranslationRow = typeof serviceAppTranslations.$inferInsert
