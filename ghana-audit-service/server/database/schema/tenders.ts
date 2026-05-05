import {
  mysqlTable,
  int,
  varchar,
  datetime,
  text,
  mysqlEnum,
  index,
  uniqueIndex
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * Tenders table - Procurement opportunities
 */
export const tenders = mysqlTable(
  'tenders',
  {
    id: int('id').primaryKey().autoincrement(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    referenceNumber: varchar('reference_number', { length: 100 }).notNull().unique(),
    category: varchar('category', { length: 100 }).notNull(), // Goods, Services, Works
    submissionDeadline: datetime('submission_deadline').notNull(),
    openingDate: datetime('opening_date'),
    documentUrl: varchar('document_url', { length: 500 }),
    publishedAt: datetime('published_at').notNull(),
    status: mysqlEnum('status', ['open', 'closed', 'awarded', 'cancelled'])
      .notNull()
      .default('open'),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: datetime('deleted_at')
  },
  (table) => [
    index('idx_tenders_slug').on(table.slug),
    index('idx_tenders_ref_number').on(table.referenceNumber),
    index('idx_tenders_status').on(table.status),
    index('idx_tenders_deadline').on(table.submissionDeadline),
    index('idx_tenders_category').on(table.category)
  ]
)

/**
 * Tender translations table
 */
export const tenderTranslations = mysqlTable(
  'tender_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    tenderId: int('tender_id')
      .notNull()
      .references(() => tenders.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description').notNull()
  },
  (table) => [
    uniqueIndex('idx_tender_locale').on(table.tenderId, table.locale),
    index('idx_tender_translations_locale').on(table.locale)
  ]
)

// Type exports
export type Tender = typeof tenders.$inferSelect
export type NewTender = typeof tenders.$inferInsert
export type TenderTranslation = typeof tenderTranslations.$inferSelect
export type NewTenderTranslation = typeof tenderTranslations.$inferInsert
