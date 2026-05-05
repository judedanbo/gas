import type { Vacancy, PaginatedResponse } from '~/types'
import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { buildPaginationMeta } from '../../utils/adminHelpers'
import { transformVacancies } from '../../utils/transformVacancy'
import { getLocaleFromRequest } from '../../utils/locale'

export default defineEventHandler(async (event): Promise<PaginatedResponse<Vacancy>> => {
  const query = getQuery(event)
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  // Parse pagination
  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(50, Math.max(1, Number(query.perPage) || 10))
  const offset = (page - 1) * perPage

  // Build where conditions - only non-deleted vacancies
  const conditions = [isNull(schema.vacancies.deletedAt)]

  // Filter by active status
  if (query.active === 'true') {
    conditions.push(eq(schema.vacancies.isActive, true))
  } else if (query.active === 'false') {
    conditions.push(eq(schema.vacancies.isActive, false))
  }

  // Filter by type
  if (query.type && typeof query.type === 'string') {
    const validTypes = ['full-time', 'part-time', 'contract'] as const
    if (validTypes.includes(query.type as (typeof validTypes)[number])) {
      conditions.push(eq(schema.vacancies.type, query.type as (typeof validTypes)[number]))
    }
  }

  const whereClause = and(...conditions)

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.vacancies)
    .where(whereClause)

  // Fetch vacancies
  const vacancies = await db
    .select()
    .from(schema.vacancies)
    .where(whereClause)
    .orderBy(desc(schema.vacancies.publishedAt))
    .limit(perPage)
    .offset(offset)

  // Fetch departments
  const departmentIds = vacancies
    .map((v) => v.departmentId)
    .filter((id): id is number => id !== null)
  const departments =
    departmentIds.length > 0
      ? await db
          .select({
            id: schema.departments.id,
            name: schema.departmentTranslations.name
          })
          .from(schema.departments)
          .leftJoin(
            schema.departmentTranslations,
            and(
              eq(schema.departmentTranslations.departmentId, schema.departments.id),
              eq(schema.departmentTranslations.locale, locale)
            )
          )
          .where(sql`${schema.departments.id} IN (${sql.join(departmentIds, sql`, `)})`)
      : []

  const departmentMap = new Map(departments.map((d) => [d.id, d.name || 'Unknown']))

  // Fetch translations for each vacancy
  const vacancyIds = vacancies.map((v) => v.id)
  const translations =
    vacancyIds.length > 0
      ? await db
          .select()
          .from(schema.vacancyTranslations)
          .where(sql`${schema.vacancyTranslations.vacancyId} IN (${sql.join(vacancyIds, sql`, `)})`)
      : []

  // Fetch requirements and their translations
  const requirements =
    vacancyIds.length > 0
      ? await db
          .select()
          .from(schema.vacancyRequirements)
          .where(sql`${schema.vacancyRequirements.vacancyId} IN (${sql.join(vacancyIds, sql`, `)})`)
      : []

  const requirementIds = requirements.map((r) => r.id)
  const requirementTranslations =
    requirementIds.length > 0
      ? await db
          .select()
          .from(schema.vacancyRequirementTranslations)
          .where(
            sql`${schema.vacancyRequirementTranslations.requirementId} IN (${sql.join(requirementIds, sql`, `)})`
          )
      : []

  // Group translations by vacancy
  const translationsByVacancy = translations.reduce(
    (acc, t) => {
      if (!acc[t.vacancyId]) {
        acc[t.vacancyId] = {}
      }
      acc[t.vacancyId][t.locale] = {
        title: t.title,
        description: t.description
      }
      return acc
    },
    {} as Record<number, Record<string, { title: string; description: string }>>
  )

  // Group requirement translations
  const reqTranslationsMap = requirementTranslations.reduce(
    (acc, t) => {
      if (!acc[t.requirementId]) {
        acc[t.requirementId] = {}
      }
      acc[t.requirementId][t.locale] = { description: t.description }
      return acc
    },
    {} as Record<number, Record<string, { description: string }>>
  )

  // Group requirements by vacancy
  const requirementsByVacancy = requirements.reduce(
    (acc, r) => {
      if (!acc[r.vacancyId]) {
        acc[r.vacancyId] = []
      }
      acc[r.vacancyId].push({
        displayOrder: r.displayOrder,
        translations: reqTranslationsMap[r.id] || {}
      })
      return acc
    },
    {} as Record<
      number,
      Array<{ displayOrder: number; translations: Record<string, { description: string }> }>
    >
  )

  // Combine vacancies with data
  const vacanciesWithData = vacancies.map((vacancy) => ({
    ...vacancy,
    translations: translationsByVacancy[vacancy.id] || {},
    requirements: requirementsByVacancy[vacancy.id] || [],
    departmentName: vacancy.departmentId ? departmentMap.get(vacancy.departmentId) : undefined
  }))

  // Apply search filter (after combining with translations)
  let filteredVacancies = vacanciesWithData
  if (query.search && typeof query.search === 'string') {
    const searchTerm = query.search.toLowerCase()
    filteredVacancies = vacanciesWithData.filter((v) => {
      const translation = v.translations[locale] || v.translations.en || {}
      const title = (translation.title || '').toLowerCase()
      const description = (translation.description || '').toLowerCase()
      const department = (v.departmentName || '').toLowerCase()
      return (
        title.includes(searchTerm) ||
        description.includes(searchTerm) ||
        department.includes(searchTerm)
      )
    })
  }

  // Filter by department name
  if (query.department && typeof query.department === 'string') {
    const deptName = query.department.toLowerCase()
    filteredVacancies = filteredVacancies.filter((v) => {
      return (v.departmentName || '').toLowerCase() === deptName
    })
  }

  // Transform to public format
  const data = transformVacancies(filteredVacancies, locale)

  // Adjust count for filters
  const total = query.search || query.department ? filteredVacancies.length : Number(count)

  return {
    data,
    meta: buildPaginationMeta(total, page, perPage)
  }
})
