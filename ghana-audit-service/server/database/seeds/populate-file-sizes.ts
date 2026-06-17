/**
 * Populate file sizes for reports where fileSize is "0" or empty.
 * Reads local files via fs.stat, fetches remote file sizes via HEAD request.
 *
 * Run with: npx tsx server/database/seeds/populate-file-sizes.ts
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { eq, or, isNull } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import { stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import * as schema from '../schema/index'
import { logError } from '../../utils/logger'

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

function resolveLocalPdf(fileUrl: string): string | null {
  if (fileUrl.startsWith('http')) return null
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

async function getRemoteFileSize(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) })
    if (!response.ok) return null
    const length = response.headers.get('content-length')
    return length ? parseInt(length, 10) : null
  } catch {
    return null
  }
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
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
        fileSize: schema.auditReports.fileSize
      })
      .from(schema.auditReports)
      .where(
        or(
          isNull(schema.auditReports.fileSize),
          eq(schema.auditReports.fileSize, ''),
          eq(schema.auditReports.fileSize, '0')
        )
      )

    console.log(`Found ${reports.length} reports with missing file sizes\n`)

    if (reports.length === 0) {
      console.log('Nothing to do.')
      return
    }

    let updated = 0
    let skipped = 0

    for (const report of reports) {
      const label = report.slug || `id:${report.id}`

      if (!report.fileUrl) {
        console.log(`  SKIP  ${label} — no fileUrl`)
        skipped++
        continue
      }

      let sizeBytes: number | null = null

      const localPath = resolveLocalPdf(report.fileUrl)
      if (localPath) {
        const fileStat = await stat(localPath)
        sizeBytes = fileStat.size
      } else if (report.fileUrl.startsWith('http')) {
        sizeBytes = await getRemoteFileSize(report.fileUrl)
      }

      if (!sizeBytes) {
        console.log(`  SKIP  ${label} — could not determine size`)
        skipped++
        continue
      }

      await db
        .update(schema.auditReports)
        .set({ fileSize: String(sizeBytes) })
        .where(eq(schema.auditReports.id, report.id))

      console.log(`  OK    ${label} → ${formatBytes(sizeBytes)} (${sizeBytes} bytes)`)
      updated++
    }

    console.log(`\nDone: ${updated} updated, ${skipped} skipped`)
  } catch (error) {
    logError('seed:file-sizes', error)
    throw error
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  logError('seed:file-sizes', error)
  process.exit(1)
})
