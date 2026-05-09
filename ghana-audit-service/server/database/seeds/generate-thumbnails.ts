/**
 * Generate thumbnails for reports that are missing them.
 * Renders the first page of each report's PDF as a JPEG thumbnail.
 *
 * Run with: npx tsx server/database/seeds/generate-thumbnails.ts
 * Requires: pdftoppm (poppler-utils)
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { eq, isNull, or } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import * as schema from '../schema/index'
import { generateThumbnailFromPdf } from '../../utils/generateThumbnail'

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

function resolveLocalPdf(fileUrl: string): string | null {
  const cleaned = fileUrl.split('?')[0].split('#')[0].replace(/^\/+/, '')
  if (!cleaned || cleaned.includes('..')) return null

  const candidates = [
    resolve(process.cwd(), 'public', cleaned),
    resolve(process.cwd(), '.output', 'public', cleaned)
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

async function run() {
  console.log('Connecting to database...')

  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 5
  })

  const db = drizzle(pool, { schema, mode: 'default' })

  try {
    const reports = await db
      .select({
        id: schema.auditReports.id,
        slug: schema.auditReports.slug,
        fileUrl: schema.auditReports.fileUrl,
        thumbnail: schema.auditReports.thumbnail
      })
      .from(schema.auditReports)
      .where(or(isNull(schema.auditReports.thumbnail), eq(schema.auditReports.thumbnail, '')))

    console.log(`Found ${reports.length} reports without thumbnails\n`)

    if (reports.length === 0) {
      console.log('Nothing to do.')
      return
    }

    let generated = 0
    let skipped = 0
    let failed = 0

    for (const report of reports) {
      const label = report.slug || `id:${report.id}`

      if (!report.fileUrl) {
        console.log(`  SKIP  ${label} — no fileUrl`)
        skipped++
        continue
      }

      const pdfPath = resolveLocalPdf(report.fileUrl)
      if (!pdfPath) {
        console.log(`  SKIP  ${label} — PDF not found on disk: ${report.fileUrl}`)
        skipped++
        continue
      }

      const thumbnailUrl = generateThumbnailFromPdf(pdfPath)
      if (!thumbnailUrl) {
        console.log(`  FAIL  ${label} — pdftoppm could not render`)
        failed++
        continue
      }

      await db
        .update(schema.auditReports)
        .set({ thumbnail: thumbnailUrl })
        .where(eq(schema.auditReports.id, report.id))

      console.log(`  OK    ${label} → ${thumbnailUrl}`)
      generated++
    }

    console.log(`\nDone: ${generated} generated, ${skipped} skipped, ${failed} failed`)
  } catch (error) {
    console.error('Error generating thumbnails:', error)
    throw error
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  console.error('Thumbnail generation failed:', error)
  process.exit(1)
})
