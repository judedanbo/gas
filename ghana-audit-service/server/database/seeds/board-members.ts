/**
 * Seed script for board members data (English only)
 * Run with: npx tsx server/database/seeds/board-members.ts
 * Use --force to clear existing data and reseed:
 *   npx tsx server/database/seeds/board-members.ts --force
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

const boardMembers = [
  {
    slug: 'board-chairperson',
    role: 'chairperson' as const,
    name: 'Board Chairperson',
    title: 'Chairperson, Audit Service Board',
    email: 'info@audit.gov.gh',
    photo: null,
    displayOrder: 0,
    bio: `The Chairperson leads the governing board of the Ghana Audit Service, providing strategic oversight and governance.

## Responsibilities
Chairs board meetings, guides the strategic direction of the Service, and ensures the board discharges its statutory oversight duties.

## Background
A distinguished professional with extensive experience in public financial management and corporate governance.`
  },
  {
    slug: 'board-member-one',
    role: 'member' as const,
    name: 'Board Member One',
    title: 'Member, Audit Service Board',
    email: null,
    photo: null,
    displayOrder: 1,
    bio: `## Background
An experienced member of the governing board contributing expertise in accountancy and public administration.`
  },
  {
    slug: 'board-member-two',
    role: 'member' as const,
    name: 'Board Member Two',
    title: 'Member, Audit Service Board',
    email: null,
    photo: null,
    displayOrder: 2,
    bio: `## Background
A member of the governing board with a background in law and regulatory affairs.`
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
    const existing = await db.select().from(schema.boardMembers)
    if (existing.length > 0) {
      if (!force) {
        console.log(`Found ${existing.length} existing board members.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(`Clearing ${existing.length} existing board members (--force)...`)
      await db.execute(sql`DELETE FROM ${schema.boardMembers}`)
    }

    console.log('Seeding board members data...')

    for (const member of boardMembers) {
      await db.insert(schema.boardMembers).values({
        slug: member.slug,
        role: member.role,
        name: member.name,
        title: member.title,
        bio: member.bio,
        email: member.email,
        photo: member.photo,
        displayOrder: member.displayOrder,
        isActive: true
      })
      console.log(`  - Created: ${member.name} (${member.role})`)
    }

    console.log('\nSeed completed successfully!')
    console.log(`  - ${boardMembers.length} board members`)
  } catch (error) {
    logError('seed:board-members', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

seed().catch((error) => {
  logError('seed:board-members', error)
  process.exit(1)
})
