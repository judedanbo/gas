import { drizzle } from 'drizzle-orm/mysql2'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import mysql from 'mysql2/promise'

// DEV-ONLY: drops the configured database, recreates it, and re-runs migrations.
// Destructive and irreversible. Guarded so it cannot touch production or a
// remote host by accident. Seeding is intentionally a separate step
// (`npm run db:seed`). The prod K8s Job runs migrate.ts, never this file.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

async function run() {
  const host = process.env.DB_HOST
  const port = Number(process.env.DB_PORT)
  const user = process.env.DB_USER
  const password = process.env.DB_PASSWORD
  const database = process.env.DB_NAME

  if (!host || !port || !user || !password || !database) {
    console.error('[reset] Missing one of DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME')
    process.exit(1)
  }

  // --- Safety guards: all must pass, otherwise refuse. ---
  if (process.env.NODE_ENV === 'production') {
    console.error('[reset] Refusing: NODE_ENV=production.')
    process.exit(1)
  }

  if (process.env.DB_RESET_ALLOW !== 'yes') {
    console.error(
      '[reset] Refusing: this drops the entire database. Re-run with an explicit opt-in:\n' +
        '          DB_RESET_ALLOW=yes npm run db:reset'
    )
    process.exit(1)
  }

  if (!LOCAL_HOSTS.has(host) && process.env.DB_RESET_ALLOW_REMOTE !== 'yes') {
    console.error(
      `[reset] Refusing: DB_HOST="${host}" is not a local host. ` +
        'If you really mean to reset a remote database, set DB_RESET_ALLOW_REMOTE=yes.'
    )
    process.exit(1)
  }

  // DDL identifiers cannot be parameterized; the name is interpolated into the
  // DROP/CREATE statement, so reject anything that isn't a plain identifier.
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    console.error(
      `[reset] Refusing: DB_NAME="${database}" is not a simple identifier ([A-Za-z0-9_]).`
    )
    process.exit(1)
  }

  console.log(`[reset] Dropping and recreating ${host}:${port}/${database} as ${user}`)

  // Connect WITHOUT selecting a database so we can drop/recreate it.
  const admin = await mysql.createConnection({ host, port, user, password })
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``)
    await admin.query(`CREATE DATABASE \`${database}\``)
    console.log('[reset] Database recreated. Running migrations...')
  } finally {
    await admin.end()
  }

  // Re-run migrations against the fresh database (same folder/logic as migrate.ts).
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
    const start = Date.now()
    await migrate(db, { migrationsFolder: './server/database/migrations' })
    console.log(`[reset] Done in ${Date.now() - start}ms`)
  } finally {
    await connection.end()
  }
}

run().catch((err) => {
  console.error('[reset] Failed:', err)
  process.exit(1)
})
