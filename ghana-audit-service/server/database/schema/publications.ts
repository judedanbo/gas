import {
  mysqlTable,
  int,
  varchar,
  datetime,
  date,
  boolean,
  text,
  longtext,
  mysqlEnum,
  index,
  uniqueIndex
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * Publications table - Press statements, bulletins, guidelines, manuals, etc.
 */
export const publications = mysqlTable(
  'publications',
  {
    id: int('id').primaryKey().autoincrement(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    type: mysqlEnum('type', [
      'press-statement',
      'bulletin',
      'guideline',
      'manual',
      'strategy',
      'law'
    ]).notNull(),
    publishedAt: date('published_at').notNull(),
    fileUrl: varchar('file_url', { length: 500 }),
    fileSize: varchar('file_size', { length: 50 }),
    thumbnail: varchar('thumbnail', { length: 500 }),
    isPublished: boolean('is_published').notNull().default(false),
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
    index('idx_publications_slug').on(table.slug),
    index('idx_publications_type').on(table.type),
    index('idx_publications_published').on(table.publishedAt),
    index('idx_publications_is_published').on(table.isPublished)
  ]
)

/**
 * Publication translations table - Multilingual content
 */
export const publicationTranslations = mysqlTable(
  'publication_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    publicationId: int('publication_id')
      .notNull()
      .references(() => publications.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    excerpt: text('excerpt'),
    content: longtext('content')
  },
  (table) => [
    uniqueIndex('idx_publication_locale').on(table.publicationId, table.locale),
    index('idx_publication_translations_locale').on(table.locale)
  ]
)

// Type exports
export type Publication = typeof publications.$inferSelect
export type NewPublication = typeof publications.$inferInsert
export type PublicationTranslation = typeof publicationTranslations.$inferSelect
export type NewPublicationTranslation = typeof publicationTranslations.$inferInsert
