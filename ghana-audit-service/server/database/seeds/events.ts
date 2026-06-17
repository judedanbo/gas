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

interface SeedEventItem {
  slug: string
  startDate: string
  endDate: string | null
  isVirtual: boolean
  registrationUrl: string | null
  thumbnail: string | null
  isPublished: boolean
  translations: {
    en: { title: string; description: string; location: string | null }
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
    const dataPath = join(__dirname, 'data/events.json')
    const eventsData: SeedEventItem[] = JSON.parse(readFileSync(dataPath, 'utf-8'))
    console.log(`Loaded ${eventsData.length} events from seed data`)

    const existing = await db.select().from(schema.events)
    if (existing.length > 0) {
      if (!force) {
        console.log(`Found ${existing.length} existing events.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(`Clearing ${existing.length} existing events (--force)...`)
      await db.execute(sql`DELETE FROM ${schema.eventTranslations}`)
      await db.execute(sql`DELETE FROM ${schema.events}`)
    }

    console.log('Seeding events...')

    for (const evt of eventsData) {
      const [result] = await db.insert(schema.events).values({
        slug: evt.slug,
        startDate: new Date(evt.startDate),
        endDate: evt.endDate ? new Date(evt.endDate) : null,
        isVirtual: evt.isVirtual,
        registrationUrl: evt.registrationUrl,
        thumbnail: evt.thumbnail,
        isPublished: evt.isPublished
      })

      const eventId = result.insertId

      await db.insert(schema.eventTranslations).values({
        eventId,
        locale: 'en',
        title: evt.translations.en.title,
        description: evt.translations.en.description,
        location: evt.translations.en.location
      })

      console.log(`  - Created: ${evt.translations.en.title.slice(0, 70)}`)
    }

    console.log(`\nSeed completed successfully!`)
    console.log(`  - ${eventsData.length} events created`)
  } catch (error) {
    logError('seed:events', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

seed().catch((error) => {
  logError('seed:events', error)
  process.exit(1)
})
