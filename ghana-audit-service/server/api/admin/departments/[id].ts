import type { H3Event } from 'h3'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, isAdmin } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { departmentSchema, validateBody, createValidationError } from '../../../utils/validation'

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

  const conditions = [eq(schema.departments.id, id)]
  if (!isAdmin(event)) conditions.push(isNull(schema.departments.deletedAt))

  const [dept] = await db
    .select()
    .from(schema.departments)
    .where(and(...conditions))
    .limit(1)

  if (!dept)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Department not found'
    })

  const translations = await db
    .select()
    .from(schema.departmentTranslations)
    .where(eq(schema.departmentTranslations.departmentId, id))

  const functions = await db
    .select()
    .from(schema.departmentFunctions)
    .where(eq(schema.departmentFunctions.departmentId, id))

  const funcIds = functions.map((f) => f.id)
  const funcTranslations =
    funcIds.length > 0
      ? await db
          .select()
          .from(schema.departmentFunctionTranslations)
          .where(inArray(schema.departmentFunctionTranslations.functionId, funcIds))
      : []

  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = { name: t.name, description: t.description }
      return acc
    },
    {} as Record<string, { name: string; description: string | null }>
  )

  const funcTransByFunc = funcTranslations.reduce(
    (acc, t) => {
      if (!acc[t.functionId]) acc[t.functionId] = {}
      acc[t.functionId][t.locale] = { description: t.description }
      return acc
    },
    {} as Record<number, Record<string, { description: string }>>
  )

  const functionsWithTrans = functions.map((f) => ({
    id: f.id,
    displayOrder: f.displayOrder,
    translations: funcTransByFunc[f.id] || {}
  }))

  return { ...dept, translations: translationsMap, functions: functionsWithTrans }
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.departments)
    .where(and(eq(schema.departments.id, id), isNull(schema.departments.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Department not found'
    })

  const existingTranslations = await db
    .select()
    .from(schema.departmentTranslations)
    .where(eq(schema.departmentTranslations.departmentId, id))

  const existingTransMap = existingTranslations.reduce(
    (acc, t) => {
      acc[t.locale] = { id: t.id, name: t.name, description: t.description }
      return acc
    },
    {} as Record<string, { id: number; name: string; description: string | null }>
  )

  const input = validateBody(departmentSchema, body)

  if (input.slug !== existing.slug) {
    const [duplicate] = await db
      .select({ id: schema.departments.id })
      .from(schema.departments)
      .where(eq(schema.departments.slug, input.slug))
      .limit(1)
    if (duplicate) throw createValidationError({ slug: 'Slug already exists' })
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE departments SET slug = ?, head_id = ?, display_order = ? WHERE id = ?`,
      [input.slug, input.headId || null, input.displayOrder, id]
    )

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        const existingTrans = existingTransMap[locale]
        if (existingTrans) {
          await connection.execute(
            `UPDATE department_translations SET name = ?, description = ? WHERE id = ?`,
            [trans.name, trans.description || null, existingTrans.id]
          )
        } else {
          await connection.execute(
            `INSERT INTO department_translations (department_id, locale, name, description) VALUES (?, ?, ?, ?)`,
            [id, locale, trans.name, trans.description || null]
          )
        }
      }
    }

    // Delete existing functions and recreate
    await connection.execute(`DELETE FROM department_functions WHERE department_id = ?`, [id])

    if (input.functions && input.functions.length > 0) {
      for (const func of input.functions) {
        const [funcResult] = await connection.execute(
          `INSERT INTO department_functions (department_id, display_order) VALUES (?, ?)`,
          [id, func.displayOrder]
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

    const [updated] = await db
      .select()
      .from(schema.departments)
      .where(eq(schema.departments.id, id))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.departmentTranslations)
      .where(eq(schema.departmentTranslations.departmentId, id))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { name: t.name, description: t.description }
        return acc
      },
      {} as Record<string, { name: string; description: string | null }>
    )

    const before = sanitizeForAudit({ ...existing, translations: existingTransMap })
    const after = sanitizeForAudit({ ...updated, translations: translationsMap })
    await logAuditAction(
      event,
      'update',
      'department',
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
    .from(schema.departments)
    .where(and(eq(schema.departments.id, id), isNull(schema.departments.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Department not found'
    })

  await db
    .update(schema.departments)
    .set({ deletedAt: new Date() })
    .where(eq(schema.departments.id, id))

  await logAuditAction(event, 'delete', 'department', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'Department deleted successfully' }
}
