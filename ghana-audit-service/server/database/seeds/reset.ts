/**
 * Database reset — truncates every application table, then reseeds everything.
 *
 * Run with:                npm run db:reset
 * Override prod guard:     npm run db:reset -- --force
 *
 * This DESTROYS all data in the configured database. It truncates every table
 * (with foreign-key checks disabled) except drizzle's migration bookkeeping
 * (`__drizzle_migrations`), so the schema/migration state is preserved, then
 * runs the master seed (`all.ts`) to repopulate.
 *
 * Safety: refuses to run when NODE_ENV=production unless --force is passed.
 */

import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const __dirname = dirname(fileURLToPath(import.meta.url))

const force = process.argv.includes('--force')

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

async function truncateAll() {
  const connection = await mysql.createConnection(dbConfig)

  try {
    // Every base table in the current database.
    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT table_name AS name
         FROM information_schema.tables
        WHERE table_schema = ?
          AND table_type = 'BASE TABLE'`,
      [dbConfig.database]
    )

    // Preserve drizzle's migration journal so we don't lose migration state.
    const tables = rows
      .map((r) => r.name as string)
      .filter((name) => !name.startsWith('__drizzle'))

    if (tables.length === 0) {
      console.log('No application tables found to truncate.')
      return
    }

    console.log(`Truncating ${tables.length} tables in ${dbConfig.database}...`)

    await connection.query('SET FOREIGN_KEY_CHECKS = 0')
    try {
      for (const table of tables) {
        await connection.query(`TRUNCATE TABLE \`${table}\``)
        console.log(`  ✓ ${table}`)
      }
    } finally {
      await connection.query('SET FOREIGN_KEY_CHECKS = 1')
    }
  } finally {
    await connection.end()
  }
}

function runSeedAll() {
  // Reseed via the master orchestrator. Tables are empty, so no --force needed.
  const result = spawnSync('npx', ['tsx', join(__dirname, 'all.ts')], {
    stdio: 'inherit',
    env: process.env
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Reseed failed with exit code ${result.status}`)
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production' && !force) {
    console.error('Refusing to reset the database with NODE_ENV=production.')
    console.error('Pass --force if you really mean to wipe production data.')
    process.exit(1)
  }

  console.log('═'.repeat(60))
  console.log(`Resetting database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`)
  console.log('═'.repeat(60))

  await truncateAll()

  console.log(`\n${'─'.repeat(60)}`)
  console.log('Tables cleared. Reseeding...')
  console.log('─'.repeat(60))

  runSeedAll()
}

main().catch((error) => {
  console.error('Reset failed:', error)
  process.exit(1)
})
