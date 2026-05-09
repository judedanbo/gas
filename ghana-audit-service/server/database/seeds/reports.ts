/**
 * Seed script for audit reports
 * Run with: npx tsx server/database/seeds/reports.ts
 * Use --force to clear existing data and reseed:
 *   npx tsx server/database/seeds/reports.ts --force
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

type ReportCategory = 'financial' | 'compliance' | 'it' | 'performance' | 'technical' | 'follow-up' | 'special'

interface SeedReportItem {
  slug: string
  category: ReportCategory
  year: number
  publishedAt: string
  fileUrl: string
  fileSize: string
  thumbnail: string | null
  isPublished: boolean
  translations: {
    en: { title: string; summary: string | null }
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
    const dataPath = join(__dirname, 'data/reports.json')
    const reportsData: SeedReportItem[] = JSON.parse(readFileSync(dataPath, 'utf-8'))
    console.log(`Loaded ${reportsData.length} audit reports from seed data`)

    const existing = await db.select().from(schema.auditReports)
    if (existing.length > 0) {
      if (!force) {
        console.log(`Found ${existing.length} existing audit reports.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(`Clearing ${existing.length} existing audit reports (--force)...`)
      await db.execute(sql`DELETE FROM ${schema.auditReportTranslations}`)
      await db.execute(sql`DELETE FROM ${schema.auditReports}`)
    }

    console.log('Seeding audit reports...')

    let count = 0
    for (const report of reportsData) {
      const [result] = await db.insert(schema.auditReports).values({
        slug: report.slug,
        category: report.category,
        publishedAt: new Date(report.publishedAt),
        year: report.year,
        fileUrl: report.fileUrl,
        fileSize: report.fileSize,
        thumbnail: report.thumbnail,
        isPublished: report.isPublished
      })

      const reportId = result.insertId

      await db.insert(schema.auditReportTranslations).values({
        auditReportId: reportId,
        locale: 'en',
        title: report.translations.en.title,
        summary: report.translations.en.summary
      })

      count++
      if (count % 25 === 0) {
        console.log(`  - Seeded ${count}/${reportsData.length} reports...`)
      }
    }

    console.log(`\nSeed completed successfully!`)
    console.log(`  - ${count} audit reports created`)
  } catch (error) {
    console.error('Error seeding reports:', error)
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
