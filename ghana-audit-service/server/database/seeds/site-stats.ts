/**
 * Seed script for site statistics (editable public figures, English only)
 * Run with: npx tsx server/database/seeds/site-stats.ts
 * Use --force to clear existing data and reseed:
 *   npx tsx server/database/seeds/site-stats.ts --force
 *
 * Values mirror the figures previously hardcoded in:
 *   - pages/index.vue (HomeStatsCounter)
 *   - pages/about/the-service.vue (UiStatGrid — Our Audit Universe)
 *   - pages/about/past-auditors-general.vue (UiStatGrid — A Legacy of Excellence)
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { sql } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import * as schema from '../schema/index'
import type { NewSiteStat } from '../schema/site-stats'
import { logError } from '../../utils/logger'

const force = process.argv.includes('--force')

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

const siteStats: NewSiteStat[] = [
  // Home — HomeStatsCounter (no icons)
  {
    section: 'home',
    statKey: 'home_years_of_service',
    label: 'Years of Service',
    suffix: '+',
    icon: null,
    displayOrder: 0,
    source: 'manual',
    manualValue: 115
  },
  {
    section: 'home',
    statKey: 'home_staff_members',
    label: 'Staff Members',
    suffix: '',
    icon: null,
    displayOrder: 1,
    // Pulled from the HR application once configured; override to force a manual value.
    source: 'hr_api',
    hrMetricKey: 'staff_total',
    manualValue: 2295
  },
  {
    section: 'home',
    statKey: 'home_regions_covered',
    label: 'Regions Covered',
    suffix: '',
    icon: null,
    displayOrder: 2,
    source: 'manual',
    manualValue: 16
  },
  {
    section: 'home',
    statKey: 'home_districts_nationwide',
    label: 'Districts Nationwide',
    suffix: '',
    icon: null,
    displayOrder: 3,
    source: 'manual',
    manualValue: 95
  },

  // About — the-service (Our Audit Universe)
  {
    section: 'about_service',
    statKey: 'service_ministries',
    label: 'Ministries',
    suffix: '+',
    icon: 'heroicons:building-library',
    displayOrder: 0,
    source: 'manual',
    manualValue: 35
  },
  {
    section: 'about_service',
    statKey: 'service_departments_agencies',
    label: 'Departments & Agencies',
    suffix: '+',
    icon: 'heroicons:building-office',
    displayOrder: 1,
    source: 'manual',
    manualValue: 200
  },
  {
    section: 'about_service',
    statKey: 'service_mmdas',
    label: 'MMDAs',
    suffix: '',
    icon: 'heroicons:building-office',
    displayOrder: 2,
    source: 'manual',
    manualValue: 261
  },
  {
    section: 'about_service',
    statKey: 'service_public_institutions',
    label: 'Public Institutions',
    suffix: '+',
    icon: 'heroicons:building-library',
    displayOrder: 3,
    source: 'manual',
    manualValue: 100
  },

  // About — past-auditors-general (A Legacy of Excellence)
  {
    section: 'about_legacy',
    statKey: 'legacy_years_of_service',
    label: 'Years of Service',
    suffix: '+',
    icon: 'heroicons:document',
    displayOrder: 0,
    source: 'manual',
    manualValue: 115
  },
  {
    section: 'about_legacy',
    statKey: 'legacy_auditors_general',
    label: 'Auditors-General',
    suffix: '',
    icon: 'heroicons:user',
    displayOrder: 1,
    source: 'manual',
    manualValue: 13
  },
  {
    section: 'about_legacy',
    statKey: 'legacy_republics_served',
    label: 'Republics Served',
    suffix: '',
    icon: 'heroicons:flag',
    displayOrder: 2,
    source: 'manual',
    manualValue: 4
  }
]

async function seed() {
  console.log('Connecting to database...')

  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 5
  })

  const db = drizzle(pool, { schema, mode: 'default' })

  try {
    const existing = await db.select().from(schema.siteStats)
    if (existing.length > 0) {
      if (!force) {
        console.log(`Found ${existing.length} existing site stats.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(`Clearing ${existing.length} existing site stats (--force)...`)
      await db.execute(sql`DELETE FROM ${schema.siteStats}`)
    }

    console.log('Seeding site statistics...')

    for (const stat of siteStats) {
      await db.insert(schema.siteStats).values(stat)
      console.log(`  - Created: [${stat.section}] ${stat.label} (${stat.source})`)
    }

    console.log('\nSeed completed successfully!')
    console.log(`  - ${siteStats.length} site stats`)
  } catch (error) {
    logError('seed:site-stats', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

seed().catch((error) => {
  logError('seed:site-stats', error)
  process.exit(1)
})
