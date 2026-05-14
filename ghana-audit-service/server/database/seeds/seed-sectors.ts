import 'dotenv/config'
import mysql from 'mysql2/promise'

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

async function seed() {
  const pool = mysql.createPool({ ...dbConfig, connectionLimit: 2 })
  const conn = await pool.getConnection()

  try {
    const [types] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM office_types WHERE slug = ?',
      ['sector']
    )
    const sectorTypeId = types[0]?.id
    if (!sectorTypeId) {
      console.log('No sector type found')
      process.exit(1)
    }

    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      "SELECT slug FROM offices WHERE slug LIKE 'cg-sector-%'"
    )
    if (existing.length > 0) {
      console.log('Sectors already exist, skipping.')
      return
    }

    for (let i = 1; i <= 6; i++) {
      const slug = `cg-sector-${i}`
      const [res] = await conn.execute<mysql.ResultSetHeader>(
        'INSERT INTO offices (slug, type_id, region, email, display_order) VALUES (?, ?, ?, ?, ?)',
        [slug, sectorTypeId, 'Greater Accra', 'info@audit.gov.gh', i]
      )
      await conn.execute(
        'INSERT INTO office_translations (office_id, locale, name, address) VALUES (?, ?, ?, ?)',
        [res.insertId, 'en', `Sector ${i}`, 'Head Office, Accra']
      )
      console.log(`Inserted: ${slug}`)
    }
    console.log('Done seeding 6 sectors.')
  } finally {
    conn.release()
    await pool.end()
  }
}

seed()
