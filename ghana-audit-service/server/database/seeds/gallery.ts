import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { sql, eq } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import * as schema from '../schema/index'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const force = process.argv.includes('--force')

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

interface SeedGalleryAlbum {
  slug: string
  publishedAt: string
  isPublished: boolean
  translations: {
    en: { title: string; description: string | null }
  }
  images: Array<{
    url: string
    translations: {
      en: { alt: string; caption: string | null }
    }
  }>
}

async function seed() {
  console.log('Connecting to database...')

  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 5
  })

  const db = drizzle(pool, { schema, mode: 'default' })

  try {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const dataPath = join(__dirname, 'data/gallery.json')
    const galleryData: SeedGalleryAlbum[] = JSON.parse(readFileSync(dataPath, 'utf-8'))
    console.log(`Loaded ${galleryData.length} gallery albums from seed data`)

    const existingAlbums = await db.select().from(schema.galleryAlbums)
    if (existingAlbums.length > 0) {
      if (!force) {
        console.log(`Found ${existingAlbums.length} existing gallery albums.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(`Clearing existing gallery data (--force)...`)
      await db.execute(sql`DELETE FROM ${schema.galleryImageTranslations}`)
      await db.execute(sql`DELETE FROM ${schema.galleryAlbumTranslations}`)
      await db.execute(sql`UPDATE gallery_albums SET cover_image_id = NULL`)
      await db.execute(sql`DELETE FROM ${schema.galleryImages}`)
      await db.execute(sql`DELETE FROM ${schema.galleryAlbums}`)
    }

    console.log('Seeding gallery albums...')
    let totalImages = 0

    for (const album of galleryData) {
      const [albumResult] = await db.insert(schema.galleryAlbums).values({
        slug: album.slug,
        publishedAt: new Date(album.publishedAt),
        isPublished: album.isPublished
      })

      const albumId = albumResult.insertId

      await db.insert(schema.galleryAlbumTranslations).values({
        albumId,
        locale: 'en',
        title: album.translations.en.title,
        description: album.translations.en.description
      })

      let firstImageId: number | null = null

      for (const img of album.images) {
        const [imgResult] = await db.insert(schema.galleryImages).values({
          url: img.url,
          albumId
        })

        const imageId = imgResult.insertId
        if (!firstImageId) firstImageId = imageId

        await db.insert(schema.galleryImageTranslations).values({
          imageId,
          locale: 'en',
          alt: img.translations.en.alt,
          caption: img.translations.en.caption
        })

        totalImages++
      }

      if (firstImageId) {
        await db
          .update(schema.galleryAlbums)
          .set({ coverImageId: firstImageId })
          .where(eq(schema.galleryAlbums.id, albumId))
      }

      console.log(`  - Created: ${album.translations.en.title} (${album.images.length} images)`)
    }

    console.log(`\nSeed completed successfully!`)
    console.log(`  - ${galleryData.length} albums created`)
    console.log(`  - ${totalImages} images created`)
  } catch (error) {
    console.error('Error seeding gallery:', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
