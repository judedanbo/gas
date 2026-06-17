/**
 * Seed script for department data
 * Run with: npx tsx server/database/seeds/departments.ts
 * Use --force to clear existing data and reseed:
 *   npx tsx server/database/seeds/departments.ts --force
 * Must run BEFORE management-team.ts seed
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

const departmentsData = [
  {
    slug: 'central-government-audit',
    displayOrder: 0,
    translations: {
      en: {
        name: 'Central Government Audit Department',
        description:
          'Responsible for the audit of central government ministries, departments, and agencies to ensure accountability and transparency in the management of public resources.'
      }
    }
  },
  {
    slug: 'commercial-audit',
    displayOrder: 1,
    translations: {
      en: {
        name: 'Commercial Audit Department',
        description:
          'Oversees audits of state-owned enterprises, joint ventures, and commercial entities to ensure proper stewardship of public investments.'
      }
    }
  },
  {
    slug: 'performance-special-audit',
    displayOrder: 2,
    translations: {
      en: {
        name: 'Performance and Special Audit Department',
        description:
          'Conducts value-for-money audits, performance evaluations, and special investigations to assess the efficiency and effectiveness of government programmes.'
      }
    }
  },
  {
    slug: 'finance-admin-hr',
    displayOrder: 3,
    translations: {
      en: {
        name: 'Finance, Administration and Human Resource Department',
        description:
          'Manages the internal operations of the Audit Service including financial administration, human resource development, and corporate services.'
      }
    }
  },
  {
    slug: 'eida-southern-zone',
    displayOrder: 4,
    translations: {
      en: {
        name: 'Educational Institutions and District Assemblies - Southern Zone',
        description:
          'Audits educational institutions and district assemblies in the southern sector of Ghana, including universities, polytechnics, and metropolitan/municipal/district assemblies.'
      }
    }
  },
  {
    slug: 'eida-northern-zone',
    displayOrder: 5,
    translations: {
      en: {
        name: 'Educational Institutions and District Assemblies - Northern Zone',
        description:
          'Audits educational institutions and district assemblies in the northern zone of Ghana, covering the northern, upper east, upper west, savannah, north east, and Oti regions.'
      }
    }
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
    const existing = await db.select().from(schema.departments)
    if (existing.length > 0) {
      if (!force) {
        console.log(`Found ${existing.length} existing departments.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(`Clearing ${existing.length} existing departments (--force)...`)
      await db.execute(sql`DELETE FROM ${schema.departmentTranslations}`)
      await db.execute(sql`DELETE FROM ${schema.departments}`)
    }

    console.log('Seeding department data...')

    for (const dept of departmentsData) {
      const [result] = await db.insert(schema.departments).values({
        slug: dept.slug,
        displayOrder: dept.displayOrder
      })

      const deptId = result.insertId

      await db.insert(schema.departmentTranslations).values({
        departmentId: deptId,
        locale: 'en',
        name: dept.translations.en.name,
        description: dept.translations.en.description
      })

      console.log(`  - Created: ${dept.translations.en.name}`)
    }

    console.log(`\nSeed completed successfully!`)
    console.log(`  - ${departmentsData.length} departments created`)
  } catch (error) {
    logError('seed:departments', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

seed().catch((error) => {
  logError('seed:departments', error)
  process.exit(1)
})
