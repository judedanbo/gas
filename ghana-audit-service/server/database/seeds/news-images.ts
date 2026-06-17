import 'dotenv/config'
import { createPool } from 'mysql2/promise'
import { drizzle } from 'drizzle-orm/mysql2'
import { eq } from 'drizzle-orm'
import * as schema from '../schema'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logError } from '../../utils/logger'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface GalleryAlbumSeed {
  slug: string
  translations: { en: { title: string } }
  images: { url: string; translations: { en: { alt: string; caption: string | null } } }[]
}

async function seed() {
  const pool = createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'ghana_audit_service'
  })

  const db = drizzle(pool, { schema, mode: 'default' })
  const force = process.argv.includes('--force')

  try {
    const galleryData: GalleryAlbumSeed[] = JSON.parse(
      readFileSync(join(__dirname, 'data', 'gallery.json'), 'utf-8')
    )
    const gallerySlugs = new Map(galleryData.map((a) => [a.slug, a]))

    const articles = await db.select().from(schema.newsArticles)

    if (force) {
      await db.delete(schema.newsArticleImages)
      console.log('Cleared existing article images')
    }

    let totalImages = 0
    let linkedArticles = 0

    for (const article of articles) {
      const album = gallerySlugs.get(article.slug)
      if (!album) continue

      const existing = await db
        .select()
        .from(schema.newsArticleImages)
        .where(eq(schema.newsArticleImages.newsArticleId, article.id))

      if (existing.length > 0) {
        console.log(`  Skipping "${article.slug}" - already has images`)
        continue
      }

      const imageRows = album.images.map((img, i) => ({
        newsArticleId: article.id,
        url: img.url,
        alt: img.translations.en.alt || album.translations.en.title,
        caption: img.translations.en.caption || null,
        sortOrder: i
      }))

      if (imageRows.length > 0) {
        await db.insert(schema.newsArticleImages).values(imageRows)
        totalImages += imageRows.length
        linkedArticles++
        console.log(`  Linked ${imageRows.length} images to "${article.slug}"`)
      }
    }

    console.log(`\nDone: ${totalImages} images linked to ${linkedArticles} articles`)
  } finally {
    await pool.end()
  }
}

seed().catch((err) => logError('seed:news-images', err))
