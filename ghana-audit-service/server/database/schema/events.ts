import {
  mysqlTable,
  int,
  varchar,
  datetime,
  boolean,
  text,
  mysqlEnum,
  index,
  uniqueIndex
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * Events table - Conferences, workshops, training sessions
 */
export const events = mysqlTable(
  'events',
  {
    id: int('id').primaryKey().autoincrement(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    startDate: datetime('start_date').notNull(),
    endDate: datetime('end_date'),
    isVirtual: boolean('is_virtual').notNull().default(false),
    registrationUrl: varchar('registration_url', { length: 500 }),
    thumbnail: varchar('thumbnail', { length: 500 }),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: datetime('deleted_at')
  },
  (table) => [
    index('idx_events_slug').on(table.slug),
    index('idx_events_start_date').on(table.startDate),
    index('idx_events_is_published').on(table.isPublished)
  ]
)

/**
 * Event translations table - Multilingual content
 */
export const eventTranslations = mysqlTable(
  'event_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    eventId: int('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description').notNull(),
    location: varchar('location', { length: 500 })
  },
  (table) => [
    uniqueIndex('idx_event_locale').on(table.eventId, table.locale),
    index('idx_event_translations_locale').on(table.locale)
  ]
)

/**
 * Event images table - Photos associated with events
 */
export const eventImages = mysqlTable(
  'event_images',
  {
    id: int('id').primaryKey().autoincrement(),
    eventId: int('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 500 }).notNull(),
    alt: varchar('alt', { length: 255 }).notNull(),
    caption: varchar('caption', { length: 500 }),
    sortOrder: int('sort_order').notNull().default(0)
  },
  (table) => [
    index('idx_event_images_event').on(table.eventId),
    index('idx_event_images_sort').on(table.eventId, table.sortOrder)
  ]
)

// Type exports
export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
export type EventTranslation = typeof eventTranslations.$inferSelect
export type NewEventTranslation = typeof eventTranslations.$inferInsert
export type EventImage = typeof eventImages.$inferSelect
export type NewEventImage = typeof eventImages.$inferInsert
