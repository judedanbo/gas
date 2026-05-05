import {
  mysqlTable,
  int,
  varchar,
  datetime,
  text,
  decimal,
  mysqlEnum,
  index,
  uniqueIndex
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

/**
 * Regional offices table - Office locations across Ghana
 */
export const regionalOffices = mysqlTable(
  'regional_offices',
  {
    id: int('id').primaryKey().autoincrement(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    region: varchar('region', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 50 }),
    email: varchar('email', { length: 255 }),
    latitude: decimal('latitude', { precision: 10, scale: 8 }),
    longitude: decimal('longitude', { precision: 11, scale: 8 }),
    displayOrder: int('display_order').notNull().default(0),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
    deletedAt: datetime('deleted_at')
  },
  (table) => [
    index('idx_regional_offices_slug').on(table.slug),
    index('idx_regional_offices_region').on(table.region)
  ]
)

/**
 * Regional office translations table
 */
export const regionalOfficeTranslations = mysqlTable(
  'regional_office_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    officeId: int('office_id')
      .notNull()
      .references(() => regionalOffices.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    address: text('address').notNull()
  },
  (table) => [
    uniqueIndex('idx_office_locale').on(table.officeId, table.locale),
    index('idx_regional_office_translations_locale').on(table.locale)
  ]
)

// Type exports
export type RegionalOffice = typeof regionalOffices.$inferSelect
export type NewRegionalOffice = typeof regionalOffices.$inferInsert
export type RegionalOfficeTranslation = typeof regionalOfficeTranslations.$inferSelect
export type NewRegionalOfficeTranslation = typeof regionalOfficeTranslations.$inferInsert
