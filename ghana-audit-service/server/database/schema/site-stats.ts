import {
  mysqlTable,
  int,
  varchar,
  datetime,
  boolean,
  mysqlEnum,
  index
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

/**
 * Site statistics table - Editable figures shown in the public stat displays
 * (home HomeStatsCounter, /about/the-service and /about/past-auditors-general
 * UiStatGrids). English only, no translations.
 *
 * Figures can be driven manually or pulled from the HR application's API. Every
 * figure supports a manual override so the site is never blocked on the HR API:
 *   useApi = source === 'hr_api' && !overrideEnabled && apiValue != null
 *   value  = useApi ? apiValue : manualValue
 *
 * The set of rows is fixed and seeded (edit-only) — there is no create/delete.
 */
export const siteStats = mysqlTable(
  'site_stats',
  {
    id: int('id').primaryKey().autoincrement(),
    // Which display the stat belongs to
    section: mysqlEnum('section', ['home', 'about_service', 'about_legacy']).notNull(),
    // Stable identifier (not user-editable), e.g. 'home_staff_members'
    statKey: varchar('stat_key', { length: 100 }).notNull().unique(),
    label: varchar('label', { length: 255 }).notNull(),
    // Value suffix, e.g. '+'
    suffix: varchar('suffix', { length: 16 }),
    // Heroicon name (e.g. 'heroicons:user'); null for home stats which show no icon
    icon: varchar('icon', { length: 255 }),
    displayOrder: int('display_order').notNull().default(0),
    // Where the displayed value comes from
    source: mysqlEnum('source', ['manual', 'hr_api']).notNull().default('manual'),
    // HR API metric name mapped to this stat when source = 'hr_api'
    hrMetricKey: varchar('hr_metric_key', { length: 100 }),
    // Manually entered value; also acts as the override value
    manualValue: int('manual_value').notNull().default(0),
    // Last value fetched from the HR API
    apiValue: int('api_value'),
    // Force manualValue even for hr_api sources
    overrideEnabled: boolean('override_enabled').notNull().default(false),
    // Timestamp of the last successful HR sync
    apiSyncedAt: datetime('api_synced_at'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
  },
  (table) => [index('idx_site_stats_section').on(table.section)]
)

// Type exports
export type SiteStat = typeof siteStats.$inferSelect
export type NewSiteStat = typeof siteStats.$inferInsert
