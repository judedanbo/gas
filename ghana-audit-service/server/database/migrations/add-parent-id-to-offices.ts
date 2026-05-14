/**
 * Migration: Add parent_id to offices, rename section→sector, expand management_team role enum
 *
 * Run with: npx tsx server/database/migrations/add-parent-id-to-offices.ts
 */

import 'dotenv/config'
import mysql from 'mysql2/promise'

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

async function migrate() {
  console.log(`Connecting to ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}...`)
  const connection = await mysql.createConnection(dbConfig)

  try {
    // 1. Add parent_id column to offices (if not exists)
    const [cols] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'offices' AND COLUMN_NAME = 'parent_id'`,
      [dbConfig.database]
    )

    if (cols.length === 0) {
      console.log('Adding parent_id column to offices...')
      await connection.execute(
        `ALTER TABLE offices ADD COLUMN parent_id INT NULL AFTER type_id`
      )
      await connection.execute(
        `ALTER TABLE offices ADD CONSTRAINT fk_offices_parent FOREIGN KEY (parent_id) REFERENCES offices(id) ON DELETE SET NULL`
      )
      await connection.execute(
        `CREATE INDEX idx_offices_parent_id ON offices(parent_id)`
      )
      console.log('Added parent_id column with FK and index.')
    } else {
      console.log('parent_id column already exists, skipping.')
    }

    // 2. Rename office type section → sector
    const [sectionType] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM office_types WHERE slug = 'section'`
    )

    if (sectionType.length > 0) {
      console.log('Renaming office type section → sector...')
      await connection.execute(
        `UPDATE office_types SET slug = 'sector', name = 'Sector' WHERE slug = 'section'`
      )
      console.log('Renamed section → sector.')
    } else {
      console.log('No section office type found (may already be renamed), skipping.')
    }

    // 3. Expand management_team role enum
    console.log('Expanding management_team role enum...')
    await connection.execute(
      `ALTER TABLE management_team MODIFY COLUMN role ENUM('auditor-general', 'deputy-auditor-general', 'regional-auditor', 'district-auditor', 'sector-head', 'branch-head') NOT NULL`
    )
    console.log('Expanded role enum to 6 values.')

    // 4. Backfill parent_id for district offices
    console.log('Backfilling parent_id for district offices...')
    const [districtTypeRow] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM office_types WHERE slug = 'district-office'`
    )
    const [regionalTypeRow] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM office_types WHERE slug = 'regional-office'`
    )

    if (districtTypeRow.length > 0 && regionalTypeRow.length > 0) {
      const districtTypeId = districtTypeRow[0].id
      const regionalTypeId = regionalTypeRow[0].id

      const [updated] = await connection.execute<mysql.ResultSetHeader>(
        `UPDATE offices d
         JOIN offices r ON d.region = r.region AND r.type_id = ?
         SET d.parent_id = r.id
         WHERE d.type_id = ? AND d.parent_id IS NULL`,
        [regionalTypeId, districtTypeId]
      )
      console.log(`Backfilled parent_id for ${updated.affectedRows} district offices.`)
    }

    console.log('Migration complete.')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

migrate()
