import type { H3Event } from 'h3'
import type { VacancyType } from '~/types/admin'
import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  getCurrentUser,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import { vacancySchema, validateBody, createValidationError } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') return handleList(event)
  if (method === 'POST') return handleCreate(event)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleList(event: H3Event) {
  requirePermission(event, 'read')

  const query = getQuery(event)
  const { page, perPage, offset } = parsePagination(query as Record<string, unknown>)
  const db = getDatabase()

  const conditions = []

  if (query.includeDeleted !== 'true') {
    conditions.push(isNull(schema.vacancies.deletedAt))
  }

  if (query.isActive === 'true') {
    conditions.push(eq(schema.vacancies.isActive, true))
  } else if (query.isActive === 'false') {
    conditions.push(eq(schema.vacancies.isActive, false))
  }

  if (query.type && typeof query.type === 'string') {
    conditions.push(eq(schema.vacancies.type, query.type as VacancyType))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.vacancies)
    .where(whereClause)

  const vacancies = await db
    .select()
    .from(schema.vacancies)
    .where(whereClause)
    .orderBy(desc(schema.vacancies.publishedAt))
    .limit(perPage)
    .offset(offset)

  const vacancyIds = vacancies.map((v) => v.id)

  const translations =
    vacancyIds.length > 0
      ? await db
          .select()
          .from(schema.vacancyTranslations)
          .where(sql`${schema.vacancyTranslations.vacancyId} IN (${sql.join(vacancyIds, sql`, `)})`)
      : []

  const translationsByVacancy = translations.reduce(
    (acc, t) => {
      if (!acc[t.vacancyId]) acc[t.vacancyId] = {}
      acc[t.vacancyId][t.locale] = { title: t.title, description: t.description }
      return acc
    },
    {} as Record<number, Record<string, { title: string; description: string | null }>>
  )

  const data = vacancies.map((v) => ({
    ...v,
    translations: translationsByVacancy[v.id] || {}
  }))

  return { data, meta: buildPaginationMeta(Number(count), page, perPage) }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const user = getCurrentUser(event)
  const body = await readBody(event)

  const input = validateBody(vacancySchema, body)
  const db = getDatabase()

  const [existing] = await db
    .select({ id: schema.vacancies.id })
    .from(schema.vacancies)
    .where(eq(schema.vacancies.slug, input.slug))
    .limit(1)

  if (existing) {
    throw createValidationError({ slug: 'A vacancy with this slug already exists' })
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.execute(
      `INSERT INTO vacancies (slug, department_id, location, type, deadline, published_at, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.slug,
        input.departmentId || null,
        input.location,
        input.type,
        new Date(input.deadline),
        new Date(input.publishedAt),
        input.isActive,
        user.id
      ]
    )

    const vacancyId = (result as { insertId: number }).insertId

    // Insert vacancy translations
    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        await connection.execute(
          `INSERT INTO vacancy_translations (vacancy_id, locale, title, description)
           VALUES (?, ?, ?, ?)`,
          [vacancyId, locale, trans.title, trans.description || null]
        )
      }
    }

    // Insert requirements with translations
    if (input.requirements && input.requirements.length > 0) {
      for (const req of input.requirements) {
        const [reqResult] = await connection.execute(
          `INSERT INTO vacancy_requirements (vacancy_id, display_order) VALUES (?, ?)`,
          [vacancyId, req.displayOrder]
        )
        const reqId = (reqResult as { insertId: number }).insertId

        for (const [locale, trans] of Object.entries(req.translations)) {
          if (trans) {
            await connection.execute(
              `INSERT INTO vacancy_requirement_translations (requirement_id, locale, description)
               VALUES (?, ?, ?)`,
              [reqId, locale, trans.description]
            )
          }
        }
      }
    }

    await connection.commit()

    // Fetch created vacancy with all data
    const [vacancy] = await db
      .select()
      .from(schema.vacancies)
      .where(eq(schema.vacancies.id, vacancyId))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.vacancyTranslations)
      .where(eq(schema.vacancyTranslations.vacancyId, vacancyId))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { title: t.title, description: t.description }
        return acc
      },
      {} as Record<string, { title: string; description: string | null }>
    )

    await logAuditAction(event, 'create', 'vacancy', vacancyId, {
      after: sanitizeForAudit({ ...vacancy, translations: translationsMap })
    })

    return { ...vacancy, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
