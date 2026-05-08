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
 * Gallery albums table - Groups of gallery images
 */
export const galleryAlbums = mysqlTable(
  'gallery_albums',
  {
    id: int('id').primaryKey().autoincrement(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    coverImageId: int('cover_image_id'),
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
    index('idx_albums_published').on(table.publishedAt),
    index('idx_albums_is_published').on(table.isPublished)
  ]
)

/**
 * Gallery album translations table
 */
export const galleryAlbumTranslations = mysqlTable(
  'gallery_album_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    albumId: int('album_id')
      .notNull()
      .references(() => galleryAlbums.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description')
  },
  (table) => [
    uniqueIndex('idx_album_locale').on(table.albumId, table.locale),
    index('idx_album_translations_locale').on(table.locale)
  ]
)

/**
 * Gallery images table - Photo gallery
 */
export const galleryImages = mysqlTable(
  'gallery_images',
  {
    id: int('id').primaryKey().autoincrement(),
    url: varchar('url', { length: 500 }).notNull(),
    category: varchar('category', { length: 100 }),
    albumId: int('album_id').references(() => galleryAlbums.id, { onDelete: 'cascade' }),
    uploadedAt: datetime('uploaded_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: datetime('deleted_at')
  },
  (table) => [
    index('idx_gallery_category').on(table.category),
    index('idx_gallery_album').on(table.albumId),
    index('idx_gallery_uploaded').on(table.uploadedAt)
  ]
)

/**
 * Gallery image translations table
 */
export const galleryImageTranslations = mysqlTable(
  'gallery_image_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    imageId: int('image_id')
      .notNull()
      .references(() => galleryImages.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    alt: varchar('alt', { length: 255 }).notNull(),
    caption: varchar('caption', { length: 500 })
  },
  (table) => [
    uniqueIndex('idx_image_locale').on(table.imageId, table.locale),
    index('idx_gallery_image_translations_locale').on(table.locale)
  ]
)

/**
 * Videos table - Video content
 */
export const videos = mysqlTable(
  'videos',
  {
    id: int('id').primaryKey().autoincrement(),
    url: varchar('url', { length: 500 }).notNull(),
    thumbnail: varchar('thumbnail', { length: 500 }),
    duration: varchar('duration', { length: 20 }),
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
    index('idx_videos_published').on(table.publishedAt),
    index('idx_videos_is_published').on(table.isPublished)
  ]
)

/**
 * Video translations table
 */
export const videoTranslations = mysqlTable(
  'video_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    videoId: int('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description')
  },
  (table) => [
    uniqueIndex('idx_video_locale').on(table.videoId, table.locale),
    index('idx_video_translations_locale').on(table.locale)
  ]
)

// Type exports
export type GalleryAlbum = typeof galleryAlbums.$inferSelect
export type NewGalleryAlbum = typeof galleryAlbums.$inferInsert
export type GalleryAlbumTranslation = typeof galleryAlbumTranslations.$inferSelect
export type NewGalleryAlbumTranslation = typeof galleryAlbumTranslations.$inferInsert
export type GalleryImage = typeof galleryImages.$inferSelect
export type NewGalleryImage = typeof galleryImages.$inferInsert
export type GalleryImageTranslation = typeof galleryImageTranslations.$inferSelect
export type NewGalleryImageTranslation = typeof galleryImageTranslations.$inferInsert
export type Video = typeof videos.$inferSelect
export type NewVideo = typeof videos.$inferInsert
export type VideoTranslation = typeof videoTranslations.$inferSelect
export type NewVideoTranslation = typeof videoTranslations.$inferInsert
