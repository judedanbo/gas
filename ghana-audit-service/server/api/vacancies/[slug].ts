import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { transformVacancy, getLocaleFromRequest } from '../../utils/transformVacancy'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Vacancy slug or ID is required'
    })
  }

  // Determine if slug is numeric (database ID) or string (slug)
  const isNumericId = /^\d+$/.test(slug)

  // Build where conditions
  const idCondition = isNumericId
    ? eq(schema.vacancies.id, Number(slug))
    : eq(schema.vacancies.slug, slug)

  const whereClause = and(idCondition, isNull(schema.vacancies.deletedAt))

  // Fetch vacancy
  const [vacancy] = await db.select().from(schema.vacancies).where(whereClause).limit(1)

  if (!vacancy) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Vacancy not found'
    })
  }

  // Fetch department name if exists
  let departmentName: string | undefined
  if (vacancy.departmentId) {
    const [dept] = await db
      .select({ name: schema.departmentTranslations.name })
      .from(schema.departmentTranslations)
      .where(
        and(
          eq(schema.departmentTranslations.departmentId, vacancy.departmentId),
          eq(schema.departmentTranslations.locale, locale)
        )
      )
      .limit(1)

    if (dept) {
      departmentName = dept.name
    } else {
      // Fallback to English
      const [deptEn] = await db
        .select({ name: schema.departmentTranslations.name })
        .from(schema.departmentTranslations)
        .where(
          and(
            eq(schema.departmentTranslations.departmentId, vacancy.departmentId),
            eq(schema.departmentTranslations.locale, 'en')
          )
        )
        .limit(1)
      departmentName = deptEn?.name
    }
  }

  // Fetch translations for the vacancy
  const translations = await db
    .select()
    .from(schema.vacancyTranslations)
    .where(eq(schema.vacancyTranslations.vacancyId, vacancy.id))

  // Fetch requirements and their translations
  const requirements = await db
    .select()
    .from(schema.vacancyRequirements)
    .where(eq(schema.vacancyRequirements.vacancyId, vacancy.id))

  const requirementIds = requirements.map((r) => r.id)
  const requirementTranslations =
    requirementIds.length > 0
      ? await db
          .select()
          .from(schema.vacancyRequirementTranslations)
          .where(eq(schema.vacancyRequirementTranslations.requirementId, requirementIds[0]))
          .then(async (first) => {
            if (requirementIds.length === 1) return first
            // Fetch all requirement translations
            const { sql } = await import('drizzle-orm')
            return db
              .select()
              .from(schema.vacancyRequirementTranslations)
              .where(
                sql`${schema.vacancyRequirementTranslations.requirementId} IN (${sql.join(requirementIds, sql`, `)})`
              )
          })
      : []

  // Group translations by locale
  const translationsByLocale = translations.reduce(
    (acc, t) => {
      acc[t.locale] = {
        title: t.title,
        description: t.description
      }
      return acc
    },
    {} as Record<string, { title: string; description: string }>
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

  // Combine vacancy with data
  const vacancyWithData = {
    ...vacancy,
    translations: translationsByLocale,
    requirements: requirements.map((r) => ({
      displayOrder: r.displayOrder,
      translations: reqTranslationsMap[r.id] || {}
    })),
    departmentName
  }

  // Transform to public format
  return transformVacancy(vacancyWithData, locale)
})
