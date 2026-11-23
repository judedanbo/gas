import {
  mysqlTable,
  int,
  date,
  datetime,
  json,
  mysqlEnum,
  index,
  uniqueIndex
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * Home page carousel settings — singleton (id = 1), managed at /admin/carousel.
 *
 * The carousel is an automatic feed (the latest N news articles, the next N
 * upcoming events, the latest N A-G reports) adjusted by the per-item
 * overrides in `carousel_items`.
 *
 * The row is only written the first time an admin saves. Until then the
 * built-in defaults apply (server/utils/carousel.ts), which reproduce what the
 * home page showed before the carousel became configurable.
 */
export const carouselSettings = mysqlTable('carousel_settings', {
  id: int('id').primaryKey(),
  newsCount: int('news_count').notNull().default(2),
  eventsCount: int('events_count').notNull().default(2),
  reportsCount: int('reports_count').notNull().default(2),
  updatedBy: int('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: datetime('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
})

/**
 * Per-item carousel overrides. `refId` points at a news article, event, audit
 * report or gallery album depending on `itemType` (no FK — one column, four
 * targets; rows whose target is gone or unpublished are simply skipped).
 *
 *  - mode 'pinned': the item is shown whether or not it is among the latest,
 *    through `pinnedUntil` (inclusive, UTC date) or indefinitely when null.
 *    Once the date passes the row is inert and the item is treated like any
 *    other again. Gallery albums are always pinned — there is no automatic
 *    gallery feed.
 *  - mode 'hidden': the item is kept out of the automatic feed.
 *
 * Gallery only: `imageCount` is how many of the album's photos become slides
 * and `imageIds` the photos the admin chose, in order. If fewer are chosen
 * than `imageCount`, the album's earliest remaining photos fill the gap.
 */
export const carouselItems = mysqlTable(
  'carousel_items',
  {
    id: int('id').primaryKey().autoincrement(),
    itemType: mysqlEnum('item_type', ['news', 'event', 'report', 'gallery']).notNull(),
    refId: int('ref_id').notNull(),
    mode: mysqlEnum('mode', ['pinned', 'hidden']).notNull().default('pinned'),
    pinnedUntil: date('pinned_until', { mode: 'string' }),
    imageCount: int('image_count'),
    imageIds: json('image_ids').$type<number[]>(),
    displayOrder: int('display_order').notNull().default(0),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`)
  },
  (table) => [
    uniqueIndex('idx_carousel_items_ref').on(table.itemType, table.refId),
    index('idx_carousel_items_order').on(table.displayOrder)
  ]
)

// Type exports
export type CarouselSettingsRow = typeof carouselSettings.$inferSelect
export type CarouselItemRow = typeof carouselItems.$inferSelect
export type NewCarouselItem = typeof carouselItems.$inferInsert
