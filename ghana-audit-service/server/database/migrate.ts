import { drizzle } from 'drizzle-orm/mysql2'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import mysql from 'mysql2/promise'

async function run() {
  const host = process.env.DB_HOST
  const port = Number(process.env.DB_PORT)
  const user = process.env.DB_USER
  const password = process.env.DB_PASSWORD
  const database = process.env.DB_NAME

  if (!host || !port || !user || !password || !database) {
    console.error(
      '[migrate] Missing one of DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME'
    )
    process.exit(1)
  }

  console.log(`[migrate] Connecting to ${host}:${port}/${database} as ${user}`)

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
    console.log(`[migrate] Done in ${Date.now() - start}ms`)
  } finally {
    await connection.end()
  }
}

run().catch((err) => {
  console.error('[migrate] Failed:', err)
  process.exit(1)
})
