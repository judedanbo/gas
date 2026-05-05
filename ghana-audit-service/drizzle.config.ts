import type { Config } from 'drizzle-kit'

export default {
  schema: './server/database/schema/index.ts',
  out: './server/database/migrations',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ghana_audit_service'
  },
  verbose: true,
  strict: true
} satisfies Config
