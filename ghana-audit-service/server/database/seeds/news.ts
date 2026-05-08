/**
 * Seed script for news articles
 * Run with: npx tsx server/database/seeds/news.ts
 * Use --force to clear existing data and reseed:
 *   npx tsx server/database/seeds/news.ts --force
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { sql } from 'drizzle-orm'
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

interface SeedNewsItem {
  slug: string
  author: string | null
  thumbnail: string | null
  category: string
  publishedAt: string
  isPublished: boolean
  translations: {
    en: { title: string; excerpt: string; content: string }
  }
  tags: string[]
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
    const dataPath = join(__dirname, 'data/news.json')
    const newsData: SeedNewsItem[] = JSON.parse(readFileSync(dataPath, 'utf-8'))
    console.log(`Loaded ${newsData.length} news articles from seed data`)

    const existing = await db.select().from(schema.newsArticles)
    if (existing.length > 0) {
      if (!force) {
        console.log(`Found ${existing.length} existing news articles.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(`Clearing ${existing.length} existing news articles (--force)...`)
      await db.execute(sql`DELETE FROM ${schema.newsArticleTranslations}`)
      await db.execute(sql`DELETE FROM ${schema.newsArticleTags}`)
      await db.execute(sql`DELETE FROM ${schema.newsArticles}`)
    }

    console.log('Seeding news articles...')

    for (const article of newsData) {
      const [result] = await db.insert(schema.newsArticles).values({
        slug: article.slug,
        author: article.author,
        thumbnail: article.thumbnail,
        category: article.category,
        publishedAt: new Date(article.publishedAt),
        isPublished: article.isPublished
      })

      const articleId = result.insertId

      await db.insert(schema.newsArticleTranslations).values({
        newsArticleId: articleId,
        locale: 'en',
        title: article.translations.en.title,
        excerpt: article.translations.en.excerpt,
        content: article.translations.en.content
      })

      console.log(`  - Created: ${article.translations.en.title.slice(0, 70)}`)
    }

    console.log(`\nSeed completed successfully!`)
    console.log(`  - ${newsData.length} news articles created`)
  } catch (error) {
    console.error('Error seeding news:', error)
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
