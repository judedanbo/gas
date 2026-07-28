/**
 * Seed script for the Auditor-General message singleton (home page section +
 * /about/auditor-general full-message page). English only; the Akan
 * translation is added through the admin panel.
 *
 * Run with: npx tsx server/database/seeds/auditor-general.ts
 * Use --force to clear existing data and reseed:
 *   npx tsx server/database/seeds/auditor-general.ts --force
 *
 * Content mirrors what was previously hardcoded in components/home/AGMessage.vue.
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { sql } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import * as schema from '../schema/index'
import { logError } from '../../utils/logger'

const force = process.argv.includes('--force')

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

const excerpt =
  'Our role as a public service is to audit and report on the public accounts of Ghana ' +
  'and all public offices. Our work as state auditors is vital to the sustenance of the ' +
  'economy of our nation. We therefore pledge as a Service to perform our constitutional ' +
  'mandate to help protect the public purse.'

async function seed() {
  console.log('Connecting to database...')

  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 5
  })

  const db = drizzle(pool, { schema, mode: 'default' })

  try {
    const existing = await db.select().from(schema.auditorGeneralMessage)
    if (existing.length > 0) {
      if (!force) {
        console.log('Auditor-General message already seeded.')
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log('Clearing existing Auditor-General message (--force)...')
      await db.execute(sql`DELETE FROM ${schema.auditorGeneralMessage}`)
    }

    console.log('Seeding Auditor-General message...')

    const [result] = await db
      .insert(schema.auditorGeneralMessage)
      .values({ photo: '/images/ags/johnson_akuamoah_asiedu.jpg', isActive: true })
      .$returningId()

    await db.insert(schema.auditorGeneralMessageTranslations).values({
      messageId: result.id,
      locale: 'en',
      name: 'Johnson Akuamoah Asiedu',
      title: 'Auditor-General of Ghana',
      excerpt,
      fullMessage: `<p>${excerpt}</p>`
    })

    console.log('\nSeed completed successfully!')
    console.log('  - 1 Auditor-General message (en)')
  } catch (error) {
    logError('seed:auditor-general', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

seed().catch((error) => {
  logError('seed:auditor-general', error)
  process.exit(1)
})
