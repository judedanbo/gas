import {
  mysqlTable,
  int,
  varchar,
  datetime,
  date,
  boolean,
  text,
  json,
  mysqlEnum,
  index,
  uniqueIndex
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * Snapshot of the last successful PDF optimization run for a report.
 * Written by the optimize endpoint; never edited by admins directly.
 */
export interface ReportOptimizationMeta {
  preset: 'screen' | 'ebook' | 'printer'
  originalSize: number
  optimizedSize: number
  savedBytes: number
  pageCount: number
  nativePages: number
  scannedPages: number
  ocrFailedPages: number
  skippedCompression: boolean
}

/**
 * Audit reports table - Main audit report records
 */
export const auditReports = mysqlTable(
  'audit_reports',
  {
    id: int('id').primaryKey().autoincrement(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    category: mysqlEnum('category', [
      'financial',
      'compliance',
      'it',
      'performance',
      'technical',
      'follow-up',
      'special'
    ]).notNull(),
    publishedAt: date('published_at').notNull(),
    fileUrl: varchar('file_url', { length: 500 }).notNull(),
    fileSize: varchar('file_size', { length: 50 }).notNull(),
    thumbnail: varchar('thumbnail', { length: 500 }),
    isPublished: boolean('is_published').notNull().default(false),
    optimizedAt: datetime('optimized_at'),
    optimizationMeta: json('optimization_meta').$type<ReportOptimizationMeta>(),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: int('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: datetime('deleted_at')
  },
  (table) => [
    index('idx_audit_reports_slug').on(table.slug),
    index('idx_audit_reports_category').on(table.category),
    index('idx_audit_reports_published').on(table.publishedAt),
    index('idx_audit_reports_is_published').on(table.isPublished)
  ]
)

/**
 * Audit report translations table - Multilingual content
 */
export const auditReportTranslations = mysqlTable(
  'audit_report_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    auditReportId: int('audit_report_id')
      .notNull()
      .references(() => auditReports.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    summary: text('summary')
  },
  (table) => [
    uniqueIndex('idx_audit_report_locale').on(table.auditReportId, table.locale),
    index('idx_audit_report_translations_locale').on(table.locale)
  ]
)

// Type exports
export type AuditReport = typeof auditReports.$inferSelect
export type NewAuditReport = typeof auditReports.$inferInsert
export type AuditReportTranslation = typeof auditReportTranslations.$inferSelect
export type NewAuditReportTranslation = typeof auditReportTranslations.$inferInsert
