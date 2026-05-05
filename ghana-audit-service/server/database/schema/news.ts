import {
  mysqlTable,
  int,
  varchar,
  datetime,
  boolean,
  text,
  longtext,
  mysqlEnum,
  index,
  uniqueIndex,
  primaryKey
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * News articles table - Blog/news posts
 */
export const newsArticles = mysqlTable(
  'news_articles',
  {
    id: int('id').primaryKey().autoincrement(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    author: varchar('author', { length: 255 }),
    thumbnail: varchar('thumbnail', { length: 500 }),
    category: varchar('category', { length: 100 }),
    publishedAt: datetime('published_at').notNull(),
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
    index('idx_news_slug').on(table.slug),
    index('idx_news_category').on(table.category),
    index('idx_news_published').on(table.publishedAt),
    index('idx_news_is_published').on(table.isPublished)
  ]
)

/**
 * News article translations table - Multilingual content
 */
export const newsArticleTranslations = mysqlTable(
  'news_article_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    newsArticleId: int('news_article_id')
      .notNull()
      .references(() => newsArticles.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    excerpt: text('excerpt').notNull(),
    content: longtext('content').notNull()
  },
  (table) => [
    uniqueIndex('idx_news_locale').on(table.newsArticleId, table.locale),
    index('idx_news_translations_locale').on(table.locale)
  ]
)

/**
 * Tags table - Reusable tags for categorizing news
 */
export const tags = mysqlTable('tags', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique()
})

/**
 * News article tags - Many-to-many relationship
 */
export const newsArticleTags = mysqlTable(
  'news_article_tags',
  {
    newsArticleId: int('news_article_id')
      .notNull()
      .references(() => newsArticles.id, { onDelete: 'cascade' }),
    tagId: int('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' })
  },
  (table) => [
    primaryKey({
      name: 'news_article_tags_news_article_id_tag_id',
      columns: [table.newsArticleId, table.tagId]
    })
  ]
)

// Type exports
export type NewsArticle = typeof newsArticles.$inferSelect
export type NewNewsArticle = typeof newsArticles.$inferInsert
export type NewsArticleTranslation = typeof newsArticleTranslations.$inferSelect
export type NewNewsArticleTranslation = typeof newsArticleTranslations.$inferInsert
export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert
