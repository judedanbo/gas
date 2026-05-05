import type { MySql2Database } from 'drizzle-orm/mysql2'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema/index'

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

// Connection pool
let pool: ReturnType<typeof mysql.createPool> | null = null
let db: MySql2Database<typeof schema> | null = null

/**
 * Get or create database connection pool
 * Uses singleton pattern to reuse connection
 */
export function getDatabase() {
  if (!db) {
    // Create MySQL connection pool
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    })

    // Create Drizzle ORM instance
    db = drizzle(pool, { schema, mode: 'default' })

    console.log(
      `[Database] Connected to MySQL database at ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
    )
  }

  return db
}

/**
 * Get the raw MySQL connection pool
 * Useful for running raw queries or transactions
 */
export function getPool() {
  if (!pool) {
    getDatabase() // Initialize pool if not already done
  }
  return pool!
}

/**
 * Close database connection pool
 * Call this on server shutdown
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end()
    pool = null
    db = null
    console.log('[Database] Connection pool closed')
  }
}

/**
 * Check database connection health
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const connection = await getPool().getConnection()
    await connection.ping()
    connection.release()
    return true
  } catch {
    return false
  }
}

// Export schema for use in queries
export { schema }
