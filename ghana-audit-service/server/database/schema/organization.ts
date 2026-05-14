import {
  mysqlTable,
  int,
  varchar,
  datetime,
  text,
  boolean,
  mysqlEnum,
  index,
  uniqueIndex,
  foreignKey
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { offices } from './offices'

/**
 * Departments table - Organizational units
 */
export const departments = mysqlTable(
  'departments',
  {
    id: int('id').primaryKey().autoincrement(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    headId: int('head_id'), // Will reference team_members after it's defined
    displayOrder: int('display_order').notNull().default(0),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
    deletedAt: datetime('deleted_at')
  },
  (table) => [index('idx_departments_slug').on(table.slug)]
)

/**
 * Department translations table
 */
export const departmentTranslations = mysqlTable(
  'department_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    departmentId: int('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description')
  },
  (table) => [
    uniqueIndex('idx_department_locale').on(table.departmentId, table.locale),
    index('idx_department_translations_locale').on(table.locale)
  ]
)

/**
 * Department functions table - List of functions for each department
 */
export const departmentFunctions = mysqlTable('department_functions', {
  id: int('id').primaryKey().autoincrement(),
  departmentId: int('department_id')
    .notNull()
    .references(() => departments.id, { onDelete: 'cascade' }),
  displayOrder: int('display_order').notNull().default(0)
})

/**
 * Department function translations table
 */
export const departmentFunctionTranslations = mysqlTable(
  'department_function_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    functionId: int('function_id').notNull(),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    description: varchar('description', { length: 500 }).notNull()
  },
  (table) => [
    uniqueIndex('idx_function_locale').on(table.functionId, table.locale),
    foreignKey({
      name: 'dept_func_trans_function_id_fk',
      columns: [table.functionId],
      foreignColumns: [departmentFunctions.id]
    }).onDelete('cascade')
  ]
)

/**
 * Team members table - Staff directory
 */
export const teamMembers = mysqlTable(
  'team_members',
  {
    id: int('id').primaryKey().autoincrement(),
    departmentId: int('department_id').references(() => departments.id, { onDelete: 'set null' }),
    photo: varchar('photo', { length: 500 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    displayOrder: int('display_order').notNull().default(0),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
    deletedAt: datetime('deleted_at')
  },
  (table) => [index('idx_team_members_department').on(table.departmentId)]
)

/**
 * Team member translations table
 */
export const teamMemberTranslations = mysqlTable(
  'team_member_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    teamMemberId: int('team_member_id')
      .notNull()
      .references(() => teamMembers.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    position: varchar('position', { length: 255 }).notNull(),
    bio: text('bio')
  },
  (table) => [
    uniqueIndex('idx_member_locale').on(table.teamMemberId, table.locale),
    index('idx_team_member_translations_locale').on(table.locale)
  ]
)

/**
 * Past Auditors-General table - Historical leadership
 */
export const pastAuditorsGeneral = mysqlTable('past_auditors_general', {
  id: int('id').primaryKey().autoincrement(),
  tenureStart: varchar('tenure_start', { length: 10 }).notNull(),
  tenureEnd: varchar('tenure_end', { length: 10 }).notNull(),
  photo: varchar('photo', { length: 500 }),
  displayOrder: int('display_order').notNull().default(0),
  createdAt: datetime('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: datetime('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
  deletedAt: datetime('deleted_at')
})

/**
 * Past AG translations table
 */
export const pastAGTranslations = mysqlTable(
  'past_ag_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    pastAGId: int('past_ag_id')
      .notNull()
      .references(() => pastAuditorsGeneral.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    legacy: text('legacy')
  },
  (table) => [uniqueIndex('idx_past_ag_locale').on(table.pastAGId, table.locale)]
)

/**
 * Past AG achievements table - List of achievements for each AG
 */
export const pastAGAchievements = mysqlTable('past_ag_achievements', {
  id: int('id').primaryKey().autoincrement(),
  pastAGId: int('past_ag_id')
    .notNull()
    .references(() => pastAuditorsGeneral.id, { onDelete: 'cascade' }),
  displayOrder: int('display_order').notNull().default(0)
})

/**
 * Past AG achievement translations table
 */
export const pastAGAchievementTranslations = mysqlTable(
  'past_ag_achievement_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    achievementId: int('achievement_id').notNull(),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    description: varchar('description', { length: 500 }).notNull()
  },
  (table) => [
    uniqueIndex('idx_achievement_locale').on(table.achievementId, table.locale),
    foreignKey({
      name: 'past_ag_achiev_trans_achiev_id_fk',
      columns: [table.achievementId],
      foreignColumns: [pastAGAchievements.id]
    }).onDelete('cascade')
  ]
)

/**
 * Management team table - Auditor-General and Deputy Auditors-General
 */
export const managementTeam = mysqlTable(
  'management_team',
  {
    id: int('id').primaryKey().autoincrement(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    role: mysqlEnum('role', [
      'auditor-general',
      'deputy-auditor-general',
      'regional-auditor'
    ]).notNull(),
    officeId: int('office_id').references(() => offices.id, {
      onDelete: 'set null'
    }),
    departmentId: int('department_id').references(() => departments.id, {
      onDelete: 'set null'
    }),
    icon: varchar('icon', { length: 100 }), // e.g., 'heroicons:building-library'
    photo: varchar('photo', { length: 500 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    displayOrder: int('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
    deletedAt: datetime('deleted_at')
  },
  (table) => [
    index('idx_management_team_slug').on(table.slug),
    index('idx_management_team_role').on(table.role),
    index('idx_management_team_active').on(table.isActive),
    index('idx_management_team_office').on(table.officeId),
    index('idx_management_team_department').on(table.departmentId)
  ]
)

/**
 * Management team translations table
 */
export const managementTeamTranslations = mysqlTable(
  'management_team_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    managementTeamId: int('management_team_id').notNull(),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    bio: text('bio')
  },
  (table) => [
    uniqueIndex('idx_management_team_locale').on(table.managementTeamId, table.locale),
    index('idx_management_team_translations_locale').on(table.locale),
    foreignKey({
      name: 'mgmt_team_trans_team_id_fk',
      columns: [table.managementTeamId],
      foreignColumns: [managementTeam.id]
    }).onDelete('cascade')
  ]
)

/**
 * Management team responsibilities table - Key responsibilities for each member (mainly DAGs)
 */
export const managementTeamResponsibilities = mysqlTable(
  'management_team_responsibilities',
  {
    id: int('id').primaryKey().autoincrement(),
    managementTeamId: int('management_team_id').notNull(),
    displayOrder: int('display_order').notNull().default(0)
  },
  (table) => [
    foreignKey({
      name: 'mgmt_team_resp_team_id_fk',
      columns: [table.managementTeamId],
      foreignColumns: [managementTeam.id]
    }).onDelete('cascade')
  ]
)

/**
 * Management team responsibility translations table
 */
export const managementTeamResponsibilityTranslations = mysqlTable(
  'management_team_responsibility_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    responsibilityId: int('responsibility_id').notNull(),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    description: varchar('description', { length: 500 }).notNull()
  },
  (table) => [
    uniqueIndex('idx_responsibility_locale').on(table.responsibilityId, table.locale),
    foreignKey({
      name: 'mgmt_resp_trans_resp_id_fk',
      columns: [table.responsibilityId],
      foreignColumns: [managementTeamResponsibilities.id]
    }).onDelete('cascade')
  ]
)

// Type exports
export type Department = typeof departments.$inferSelect
export type NewDepartment = typeof departments.$inferInsert
export type DepartmentTranslation = typeof departmentTranslations.$inferSelect
export type NewDepartmentTranslation = typeof departmentTranslations.$inferInsert
export type DepartmentFunction = typeof departmentFunctions.$inferSelect
export type NewDepartmentFunction = typeof departmentFunctions.$inferInsert
export type TeamMember = typeof teamMembers.$inferSelect
export type NewTeamMember = typeof teamMembers.$inferInsert
export type TeamMemberTranslation = typeof teamMemberTranslations.$inferSelect
export type NewTeamMemberTranslation = typeof teamMemberTranslations.$inferInsert
export type PastAuditorGeneral = typeof pastAuditorsGeneral.$inferSelect
export type NewPastAuditorGeneral = typeof pastAuditorsGeneral.$inferInsert
export type PastAGTranslation = typeof pastAGTranslations.$inferSelect
export type NewPastAGTranslation = typeof pastAGTranslations.$inferInsert
export type PastAGAchievement = typeof pastAGAchievements.$inferSelect
export type NewPastAGAchievement = typeof pastAGAchievements.$inferInsert
export type ManagementTeamMember = typeof managementTeam.$inferSelect
export type NewManagementTeamMember = typeof managementTeam.$inferInsert
export type ManagementTeamTranslation = typeof managementTeamTranslations.$inferSelect
export type NewManagementTeamTranslation = typeof managementTeamTranslations.$inferInsert
export type ManagementTeamResponsibility = typeof managementTeamResponsibilities.$inferSelect
export type NewManagementTeamResponsibility = typeof managementTeamResponsibilities.$inferInsert
