import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { sql } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import * as schema from '../schema/index'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logError } from '../../utils/logger'

const force = process.argv.includes('--force')

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

interface SeedVideoItem {
  url: string
  thumbnail: string | null
  duration: string | null
  publishedAt: string
  isPublished: boolean
  translations: {
    en: { title: string; description: string | null }
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
    const dataPath = join(__dirname, 'data/videos.json')
    const videosData: SeedVideoItem[] = JSON.parse(readFileSync(dataPath, 'utf-8'))
    console.log(`Loaded ${videosData.length} videos from seed data`)

    const existing = await db.select().from(schema.videos)
    if (existing.length > 0) {
      if (!force) {
        console.log(`Found ${existing.length} existing videos.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(`Clearing ${existing.length} existing videos (--force)...`)
      await db.execute(sql`DELETE FROM ${schema.videoTranslations}`)
      await db.execute(sql`DELETE FROM ${schema.videos}`)
    }

    console.log('Seeding videos...')

    for (const video of videosData) {
      const [result] = await db.insert(schema.videos).values({
        url: video.url,
        thumbnail: video.thumbnail,
        duration: video.duration,
        publishedAt: new Date(video.publishedAt),
        isPublished: video.isPublished
      })

      const videoId = result.insertId

      await db.insert(schema.videoTranslations).values({
        videoId,
        locale: 'en',
        title: video.translations.en.title,
        description: video.translations.en.description
      })

      console.log(`  - Created: ${video.translations.en.title}`)
    }

    console.log(`\nSeed completed successfully!`)
    console.log(`  - ${videosData.length} videos created`)
  } catch (error) {
    logError('seed:videos', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

seed().catch((error) => {
  logError('seed:videos', error)
  process.exit(1)
})
