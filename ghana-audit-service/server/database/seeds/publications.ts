/**
 * Seed script for publications (press statements & bulletins)
 * Run with: npx tsx server/database/seeds/publications.ts
 * Use --force to clear existing data and reseed:
 *   npx tsx server/database/seeds/publications.ts --force
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

interface SeedPublicationItem {
  slug: string
  type: 'press-statement' | 'bulletin' | 'guideline' | 'manual' | 'strategy' | 'law'
  publishedAt: string
  fileUrl: string | null
  thumbnail?: string | null
  isPublished: boolean
  translations: {
    en: { title: string; excerpt: string; content: string }
  }
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
    const dataPath = join(__dirname, 'data/publications.json')
    const pubData: SeedPublicationItem[] = JSON.parse(readFileSync(dataPath, 'utf-8'))
    console.log(`Loaded ${pubData.length} publications from seed data`)

    const existing = await db.select().from(schema.publications)
    if (existing.length > 0) {
      if (!force) {
        console.log(`Found ${existing.length} existing publications.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(`Clearing ${existing.length} existing publications (--force)...`)
      await db.execute(sql`DELETE FROM ${schema.publicationTranslations}`)
      await db.execute(sql`DELETE FROM ${schema.publications}`)
    }

    console.log('Seeding publications...')

    let pressCount = 0
    let bulletinCount = 0

    for (const pub of pubData) {
      const [result] = await db.insert(schema.publications).values({
        slug: pub.slug,
        type: pub.type,
        publishedAt: new Date(pub.publishedAt),
        fileUrl: pub.fileUrl,
        thumbnail: pub.thumbnail || null,
        isPublished: pub.isPublished
      })

      const pubId = result.insertId

      await db.insert(schema.publicationTranslations).values({
        publicationId: pubId,
        locale: 'en',
        title: pub.translations.en.title,
        excerpt: pub.translations.en.excerpt,
        content: pub.translations.en.content
      })

      if (pub.type === 'press-statement') pressCount++
      else if (pub.type === 'bulletin') bulletinCount++

      console.log(`  - [${pub.type}] ${pub.translations.en.title.slice(0, 70)}`)
    }

    console.log(`\nSeed completed successfully!`)
    console.log(`  - ${pressCount} press statements created`)
    console.log(`  - ${bulletinCount} bulletins created`)
    console.log(`  - ${pubData.length} total publications`)
  } catch (error) {
    console.error('Error seeding publications:', error)
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
