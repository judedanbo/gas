/**
 * Migration: Rename regional_offices → offices, add office_types table
 *
 * Run with: npx tsx server/database/migrations/migrate-offices.ts
 */

import 'dotenv/config'
import mysql from 'mysql2/promise'
import { logError, logInfo } from '../../utils/logger'

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

async function migrate() {
  logInfo(
    'migrate-offices',
    `Connecting to ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}...`
  )
  const connection = await mysql.createConnection(dbConfig)

  try {
    // 1. Create office_types table
    console.log('Creating office_types table...')
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS office_types (
        id int NOT NULL AUTO_INCREMENT,
        slug varchar(50) NOT NULL,
        name varchar(100) NOT NULL,
        display_order int NOT NULL DEFAULT 0,
        created_at datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY office_types_slug_unique (slug)
      )
    `)

    // 2. Rename regional_offices → offices (if old table exists)
    const [tables] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'regional_offices'`,
      [dbConfig.database]
    )

    if (tables.length > 0) {
      console.log('Renaming regional_offices → offices...')

      // Add type_id column before rename
      const [cols] = await connection.execute<mysql.RowDataPacket[]>(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'regional_offices' AND COLUMN_NAME = 'type_id'`,
        [dbConfig.database]
      )

      if (cols.length === 0) {
        await connection.execute(
          `ALTER TABLE regional_offices ADD COLUMN type_id int NOT NULL DEFAULT 1 AFTER slug`
        )
      }

      await connection.execute(`RENAME TABLE regional_offices TO offices`)
      console.log('Renamed regional_offices → offices')

      // Update indexes
      try {
        await connection.execute(`ALTER TABLE offices DROP INDEX idx_regional_offices_slug`)
        await connection.execute(`ALTER TABLE offices ADD INDEX idx_offices_slug (slug)`)
      } catch {
        /* index may not exist */
      }

      try {
        await connection.execute(`ALTER TABLE offices DROP INDEX idx_regional_offices_region`)
        await connection.execute(`ALTER TABLE offices ADD INDEX idx_offices_region (region)`)
      } catch {
        /* index may not exist */
      }

      // Add type_id index and FK
      try {
        await connection.execute(`ALTER TABLE offices ADD INDEX idx_offices_type_id (type_id)`)
      } catch {
        /* index may already exist */
      }

      try {
        await connection.execute(
          `ALTER TABLE offices ADD CONSTRAINT offices_type_id_office_types_id_fk FOREIGN KEY (type_id) REFERENCES office_types(id)`
        )
      } catch {
        /* FK may already exist */
      }
    }

    // 3. Rename regional_office_translations → office_translations
    const [transTable] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'regional_office_translations'`,
      [dbConfig.database]
    )

    if (transTable.length > 0) {
      console.log('Renaming regional_office_translations → office_translations...')
      await connection.execute(`RENAME TABLE regional_office_translations TO office_translations`)

      // Update FK reference
      try {
        await connection.execute(
          `ALTER TABLE office_translations DROP FOREIGN KEY regional_office_translations_office_id_regional_offices_id_fk`
        )
        await connection.execute(
          `ALTER TABLE office_translations ADD CONSTRAINT office_translations_office_id_offices_id_fk FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE CASCADE`
        )
      } catch {
        /* FK name may differ */
      }

      // Update locale index name
      try {
        await connection.execute(
          `ALTER TABLE office_translations DROP INDEX idx_regional_office_translations_locale`
        )
        await connection.execute(
          `ALTER TABLE office_translations ADD INDEX idx_office_translations_locale (locale)`
        )
      } catch {
        /* index may not exist */
      }
    }

    // 4. Rename management_team.regional_office_id → office_id
    const [mtCols] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'management_team' AND COLUMN_NAME = 'regional_office_id'`,
      [dbConfig.database]
    )

    if (mtCols.length > 0) {
      console.log('Renaming management_team.regional_office_id → office_id...')

      // Drop old FK and index first
      try {
        await connection.execute(
          `ALTER TABLE management_team DROP FOREIGN KEY management_team_regional_office_id_regional_offices_id_fk`
        )
      } catch {
        /* FK name may differ */
      }

      try {
        await connection.execute(
          `ALTER TABLE management_team DROP INDEX idx_management_team_regional_office`
        )
      } catch {
        /* index may not exist */
      }

      await connection.execute(
        `ALTER TABLE management_team CHANGE COLUMN regional_office_id office_id int NULL`
      )

      try {
        await connection.execute(
          `ALTER TABLE management_team ADD INDEX idx_management_team_office (office_id)`
        )
      } catch {
        /* index may already exist */
      }

      try {
        await connection.execute(
          `ALTER TABLE management_team ADD CONSTRAINT management_team_office_id_offices_id_fk FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE SET NULL`
        )
      } catch {
        /* FK may already exist */
      }
    }

    console.log('Migration completed successfully!')
  } catch (error) {
    logError('migrate-offices', error)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

migrate()
