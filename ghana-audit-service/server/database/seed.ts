/**
 * Database Seed Script
 *
 * Creates the initial admin user from environment variables.
 * Run with: npm run db:seed
 */

import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import * as schema from './schema/index'

const SALT_ROUNDS = 12

async function seed() {
  // Check required environment variables
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  const adminName = process.env.ADMIN_NAME || 'Administrator'

  if (!adminEmail || !adminPassword) {
    console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required')
    console.error('Please set them in your .env file:')
    console.error('  ADMIN_EMAIL=admin@audit.gov.gh')
    console.error('  ADMIN_PASSWORD=your-secure-password')
    process.exit(1)
  }

  // Database configuration
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ghana_audit_service'
  }

  console.log(`Connecting to database at ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}...`)

  // Create connection
  const connection = await mysql.createConnection(dbConfig)
  const db = drizzle(connection, { schema, mode: 'default' })

  try {
    // Check if admin user already exists
    const [existingUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, adminEmail.toLowerCase()))
      .limit(1)

    if (existingUser) {
      console.log(`Admin user with email ${adminEmail} already exists.`)
      console.log('Skipping user creation.')
    } else {
      // Hash password
      console.log('Hashing password...')
      const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS)

      // Create admin user
      console.log('Creating admin user...')
      const [result] = await db.insert(schema.users).values({
        email: adminEmail.toLowerCase(),
        passwordHash,
        name: adminName,
        role: 'admin',
        isActive: true
      })

      console.log(`Admin user created successfully!`)
      console.log(`  ID: ${result.insertId}`)
      console.log(`  Email: ${adminEmail}`)
      console.log(`  Name: ${adminName}`)
      console.log(`  Role: admin`)
    }

    // Log seed action
    await db.insert(schema.auditLogs).values({
      userId: null,
      action: 'create',
      entityType: 'seed',
      entityId: null,
      changes: { action: 'database_seeded', timestamp: new Date().toISOString() },
      ipAddress: '127.0.0.1',
      userAgent: 'db:seed script'
    })

    console.log('\nSeed completed successfully!')
  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

// Run seed
seed()
