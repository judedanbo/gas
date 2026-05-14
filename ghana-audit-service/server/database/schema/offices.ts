import {
  mysqlTable,
  int,
  varchar,
  datetime,
  text,
  decimal,
  mysqlEnum,
  index,
  uniqueIndex,
  type AnyMySqlColumn
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

/**
 * Office types table - Classifies offices (Head Office, Regional, District, Section, Branch)
 */
export const officeTypes = mysqlTable('office_types', {
  id: int('id').primaryKey().autoincrement(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  displayOrder: int('display_order').notNull().default(0),
  createdAt: datetime('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: datetime('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
})

/**
 * Offices table - All office locations across Ghana
 */
export const offices = mysqlTable(
  'offices',
  {
    id: int('id').primaryKey().autoincrement(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    typeId: int('type_id')
      .notNull()
      .references(() => officeTypes.id),
    parentId: int('parent_id').references((): AnyMySqlColumn => offices.id, {
      onDelete: 'set null'
    }),
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
    index('idx_offices_slug').on(table.slug),
    index('idx_offices_region').on(table.region),
    index('idx_offices_type_id').on(table.typeId),
    index('idx_offices_parent_id').on(table.parentId)
  ]
)

/**
 * Office translations table
 */
export const officeTranslations = mysqlTable(
  'office_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    officeId: int('office_id')
      .notNull()
      .references(() => offices.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    address: text('address').notNull()
  },
  (table) => [
    uniqueIndex('idx_office_locale').on(table.officeId, table.locale),
    index('idx_office_translations_locale').on(table.locale)
  ]
)

// Type exports
export type OfficeType = typeof officeTypes.$inferSelect
export type NewOfficeType = typeof officeTypes.$inferInsert
export type Office = typeof offices.$inferSelect
export type NewOffice = typeof offices.$inferInsert
export type OfficeTranslation = typeof officeTranslations.$inferSelect
export type NewOfficeTranslation = typeof officeTranslations.$inferInsert
