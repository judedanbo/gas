import type { H3Event } from 'h3'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, getCurrentUser, isAdmin } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { vacancySchema, validateBody, createValidationError } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const method = event.method
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid ID' })

  if (method === 'GET') return handleGet(event, id)
  if (method === 'PUT') return handleUpdate(event, id)
  if (method === 'DELETE') return handleDelete(event, id)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleGet(event: H3Event, id: number) {
  requirePermission(event, 'read')
  const db = getDatabase()

  const conditions = [eq(schema.vacancies.id, id)]
  if (!isAdmin(event)) conditions.push(isNull(schema.vacancies.deletedAt))

  const [vacancy] = await db
    .select()
    .from(schema.vacancies)
    .where(and(...conditions))
    .limit(1)

  if (!vacancy)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Vacancy not found' })

  const translations = await db
    .select()
    .from(schema.vacancyTranslations)
    .where(eq(schema.vacancyTranslations.vacancyId, id))

  const requirements = await db
    .select()
    .from(schema.vacancyRequirements)
    .where(eq(schema.vacancyRequirements.vacancyId, id))

  const reqIds = requirements.map((r) => r.id)
  const reqTranslations =
    reqIds.length > 0
      ? await db
          .select()
          .from(schema.vacancyRequirementTranslations)
          .where(inArray(schema.vacancyRequirementTranslations.requirementId, reqIds))
      : []

  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = { title: t.title, description: t.description }
      return acc
    },
    {} as Record<string, { title: string; description: string | null }>
  )

  const reqTransByReq = reqTranslations.reduce(
    (acc, t) => {
      if (!acc[t.requirementId]) acc[t.requirementId] = {}
      acc[t.requirementId][t.locale] = { description: t.description }
      return acc
    },
    {} as Record<number, Record<string, { description: string }>>
  )

  const requirementsWithTrans = requirements.map((r) => ({
    id: r.id,
    displayOrder: r.displayOrder,
    translations: reqTransByReq[r.id] || {}
  }))

  return { ...vacancy, translations: translationsMap, requirements: requirementsWithTrans }
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  getCurrentUser(event) // Verify user is authenticated
  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.vacancies)
    .where(and(eq(schema.vacancies.id, id), isNull(schema.vacancies.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Vacancy not found' })

  const existingTranslations = await db
    .select()
    .from(schema.vacancyTranslations)
    .where(eq(schema.vacancyTranslations.vacancyId, id))

  const existingTransMap = existingTranslations.reduce(
    (acc, t) => {
      acc[t.locale] = { id: t.id, title: t.title, description: t.description }
      return acc
    },
    {} as Record<string, { id: number; title: string; description: string | null }>
  )

  const input = validateBody(vacancySchema, body)

  if (input.slug !== existing.slug) {
    const [duplicate] = await db
      .select({ id: schema.vacancies.id })
      .from(schema.vacancies)
      .where(eq(schema.vacancies.slug, input.slug))
      .limit(1)

    if (duplicate) throw createValidationError({ slug: 'Slug already exists' })
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE vacancies SET slug = ?, department_id = ?, location = ?, type = ?, deadline = ?, published_at = ?, is_active = ? WHERE id = ?`,
      [
        input.slug,
        input.departmentId || null,
        input.location,
        input.type,
        new Date(input.deadline),
        new Date(input.publishedAt),
        input.isActive,
        id
      ]
    )

    // Update translations
    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        const existingTrans = existingTransMap[locale]
        if (existingTrans) {
          await connection.execute(
            `UPDATE vacancy_translations SET title = ?, description = ? WHERE id = ?`,
            [trans.title, trans.description || null, existingTrans.id]
          )
        } else {
          await connection.execute(
            `INSERT INTO vacancy_translations (vacancy_id, locale, title, description) VALUES (?, ?, ?, ?)`,
            [id, locale, trans.title, trans.description || null]
          )
        }
      }
    }

    // Delete existing requirements and recreate
    await connection.execute(`DELETE FROM vacancy_requirements WHERE vacancy_id = ?`, [id])

    if (input.requirements && input.requirements.length > 0) {
      for (const req of input.requirements) {
        const [reqResult] = await connection.execute(
          `INSERT INTO vacancy_requirements (vacancy_id, display_order) VALUES (?, ?)`,
          [id, req.displayOrder]
        )
        const reqId = (reqResult as { insertId: number }).insertId

        for (const [locale, trans] of Object.entries(req.translations)) {
          if (trans) {
            await connection.execute(
              `INSERT INTO vacancy_requirement_translations (requirement_id, locale, description) VALUES (?, ?, ?)`,
              [reqId, locale, trans.description]
            )
          }
        }
      }
    }

    await connection.commit()

    const [updated] = await db
      .select()
      .from(schema.vacancies)
      .where(eq(schema.vacancies.id, id))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.vacancyTranslations)
      .where(eq(schema.vacancyTranslations.vacancyId, id))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { title: t.title, description: t.description }
        return acc
      },
      {} as Record<string, { title: string; description: string | null }>
    )

    const before = sanitizeForAudit({ ...existing, translations: existingTransMap })
    const after = sanitizeForAudit({ ...updated, translations: translationsMap })
    await logAuditAction(
      event,
      'update',
      'vacancy',
      id,
      createChangesObject(before as Record<string, unknown>, after as Record<string, unknown>)
    )

    return { ...updated, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function handleDelete(event: H3Event, id: number) {
  requirePermission(event, 'delete')
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.vacancies)
    .where(and(eq(schema.vacancies.id, id), isNull(schema.vacancies.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Vacancy not found' })

  await db
    .update(schema.vacancies)
    .set({ deletedAt: new Date() })
    .where(eq(schema.vacancies.id, id))

  await logAuditAction(event, 'delete', 'vacancy', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'Vacancy deleted successfully' }
}
