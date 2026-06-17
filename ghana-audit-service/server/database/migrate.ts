import { drizzle } from 'drizzle-orm/mysql2'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import mysql from 'mysql2/promise'
import { baselineIfNeeded, MIGRATIONS_FOLDER } from './baseline'
import { logError, logInfo } from '../utils/logger'

async function run() {
  const host = process.env.DB_HOST
  const port = Number(process.env.DB_PORT)
  const user = process.env.DB_USER
  const password = process.env.DB_PASSWORD
  const database = process.env.DB_NAME

  if (!host || !port || !user || !password || !database) {
    console.error('[migrate] Missing one of DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME')
    process.exit(1)
  }

  // Dev-only: host/db/user are sensitive infrastructure detail in prod logs.
  logInfo('migrate', `Connecting to ${host}:${port}/${database} as ${user}`)

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true
  })

  try {
    const db = drizzle(connection)
    // Squash-baseline reconciliation: if the schema already exists (e.g. created
    // via `drizzle-kit push`) but the migration ledger is empty, seed the 0000
    // baseline row so the migrator doesn't try to re-create live tables. No-op on
    // a fresh DB. See server/database/baseline.ts.
    const outcome = await baselineIfNeeded({
      query: (sql, values) => connection.query(sql, values)
    })
    if (outcome === 'baselined') {
      console.log('[migrate] Seeded squash baseline before migrating')
    }
    const start = Date.now()
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
    console.log(`[migrate] Done in ${Date.now() - start}ms`)
  } finally {
    await connection.end()
  }
}

run().catch((err) => {
  logError('migrate', err)
  process.exit(1)
})
