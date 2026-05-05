import type { H3Event } from 'h3'
import { eq, and, isNull, sql, asc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import { departmentSchema, validateBody, createValidationError } from '../../../utils/validation'

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
    conditions.push(isNull(schema.departments.deletedAt))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.departments)
    .where(whereClause)

  const departments = await db
    .select()
    .from(schema.departments)
    .where(whereClause)
    .orderBy(asc(schema.departments.displayOrder))
    .limit(perPage)
    .offset(offset)

  const deptIds = departments.map((d) => d.id)
  const translations =
    deptIds.length > 0
      ? await db
          .select()
          .from(schema.departmentTranslations)
          .where(
            sql`${schema.departmentTranslations.departmentId} IN (${sql.join(deptIds, sql`, `)})`
          )
      : []

  const translationsByDept = translations.reduce(
    (acc, t) => {
      if (!acc[t.departmentId]) acc[t.departmentId] = {}
      acc[t.departmentId][t.locale] = { name: t.name, description: t.description }
      return acc
    },
    {} as Record<number, Record<string, { name: string; description: string | null }>>
  )

  const data = departments.map((d) => ({
    ...d,
    translations: translationsByDept[d.id] || {}
  }))

  return { data, meta: buildPaginationMeta(Number(count), page, perPage) }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const body = await readBody(event)

  const input = validateBody(departmentSchema, body)
  const db = getDatabase()

  const [existing] = await db
    .select({ id: schema.departments.id })
    .from(schema.departments)
    .where(eq(schema.departments.slug, input.slug))
    .limit(1)

  if (existing) {
    throw createValidationError({ slug: 'Slug already exists' })
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.execute(
      `INSERT INTO departments (slug, head_id, display_order) VALUES (?, ?, ?)`,
      [input.slug, input.headId || null, input.displayOrder]
    )

    const deptId = (result as { insertId: number }).insertId

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        await connection.execute(
          `INSERT INTO department_translations (department_id, locale, name, description) VALUES (?, ?, ?, ?)`,
          [deptId, locale, trans.name, trans.description || null]
        )
      }
    }

    // Insert functions with translations
    if (input.functions && input.functions.length > 0) {
      for (const func of input.functions) {
        const [funcResult] = await connection.execute(
          `INSERT INTO department_functions (department_id, display_order) VALUES (?, ?)`,
          [deptId, func.displayOrder]
        )
        const funcId = (funcResult as { insertId: number }).insertId

        for (const [locale, trans] of Object.entries(func.translations)) {
          if (trans) {
            await connection.execute(
              `INSERT INTO department_function_translations (function_id, locale, description) VALUES (?, ?, ?)`,
              [funcId, locale, trans.description]
            )
          }
        }
      }
    }

    await connection.commit()

    const [dept] = await db
      .select()
      .from(schema.departments)
      .where(eq(schema.departments.id, deptId))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.departmentTranslations)
      .where(eq(schema.departmentTranslations.departmentId, deptId))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { name: t.name, description: t.description }
        return acc
      },
      {} as Record<string, { name: string; description: string | null }>
    )

    await logAuditAction(event, 'create', 'department', deptId, {
      after: sanitizeForAudit({ ...dept, translations: translationsMap })
    })

    return { ...dept, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
