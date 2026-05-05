import {
  mysqlTable,
  int,
  varchar,
  datetime,
  date,
  boolean,
  text,
  mysqlEnum,
  index,
  uniqueIndex
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { departments } from './organization'

/**
 * Vacancies table - Job openings
 */
export const vacancies = mysqlTable(
  'vacancies',
  {
    id: int('id').primaryKey().autoincrement(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    departmentId: int('department_id').references(() => departments.id, { onDelete: 'set null' }),
    location: varchar('location', { length: 255 }).notNull(),
    type: mysqlEnum('type', ['full-time', 'part-time', 'contract']).notNull(),
    deadline: date('deadline').notNull(),
    publishedAt: datetime('published_at').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: datetime('deleted_at')
  },
  (table) => [
    index('idx_vacancies_slug').on(table.slug),
    index('idx_vacancies_deadline').on(table.deadline),
    index('idx_vacancies_active').on(table.isActive),
    index('idx_vacancies_department').on(table.departmentId)
  ]
)

/**
 * Vacancy translations table
 */
export const vacancyTranslations = mysqlTable(
  'vacancy_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    vacancyId: int('vacancy_id')
      .notNull()
      .references(() => vacancies.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description').notNull()
  },
  (table) => [
    uniqueIndex('idx_vacancy_locale').on(table.vacancyId, table.locale),
    index('idx_vacancy_translations_locale').on(table.locale)
  ]
)

/**
 * Vacancy requirements table - List of requirements for each vacancy
 */
export const vacancyRequirements = mysqlTable('vacancy_requirements', {
  id: int('id').primaryKey().autoincrement(),
  vacancyId: int('vacancy_id')
    .notNull()
    .references(() => vacancies.id, { onDelete: 'cascade' }),
  displayOrder: int('display_order').notNull().default(0)
})

/**
 * Vacancy requirement translations table
 */
export const vacancyRequirementTranslations = mysqlTable(
  'vacancy_requirement_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    requirementId: int('requirement_id')
      .notNull()
      .references(() => vacancyRequirements.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    description: varchar('description', { length: 500 }).notNull()
  },
  (table) => [uniqueIndex('idx_requirement_locale').on(table.requirementId, table.locale)]
)

// Type exports
export type Vacancy = typeof vacancies.$inferSelect
export type NewVacancy = typeof vacancies.$inferInsert
export type VacancyTranslation = typeof vacancyTranslations.$inferSelect
export type NewVacancyTranslation = typeof vacancyTranslations.$inferInsert
export type VacancyRequirement = typeof vacancyRequirements.$inferSelect
export type NewVacancyRequirement = typeof vacancyRequirements.$inferInsert
