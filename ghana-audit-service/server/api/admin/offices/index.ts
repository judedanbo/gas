import type { H3Event } from 'h3'
import { eq, and, isNull, sql, asc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import { officeSchema, validateBody, createValidationError } from '../../../utils/validation'
import { decimalToNumber } from '../../../utils/decimal'
import { safeError } from '../../../utils/errors'

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
  if (query.includeDeleted !== 'true') conditions.push(isNull(schema.offices.deletedAt))

  if (query.typeSlug && typeof query.typeSlug === 'string') {
    const typeResult = await db
      .select({ id: schema.officeTypes.id })
      .from(schema.officeTypes)
      .where(eq(schema.officeTypes.slug, query.typeSlug))
      .limit(1)
    if (typeResult.length > 0) {
      conditions.push(eq(schema.offices.typeId, typeResult[0].id))
    }
  }

  if (query.parentId && typeof query.parentId === 'string') {
    conditions.push(eq(schema.offices.parentId, Number(query.parentId)))
  }

  const isDropdownMode = !!query.typeSlug || !!query.parentId
  const limit = isDropdownMode ? 1000 : perPage
  const queryOffset = isDropdownMode ? 0 : offset

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.offices)
    .where(whereClause)

  const offices = await db
    .select()
    .from(schema.offices)
    .where(whereClause)
    .orderBy(asc(schema.offices.displayOrder))
    .limit(limit)
    .offset(queryOffset)

  const officeIds = offices.map((o) => o.id)
  const translations =
    officeIds.length > 0
      ? await db
          .select()
          .from(schema.officeTranslations)
          .where(sql`${schema.officeTranslations.officeId} IN (${sql.join(officeIds, sql`, `)})`)
      : []

  const typeIds = [...new Set(offices.map((o) => o.typeId))]
  const types =
    typeIds.length > 0
      ? await db
          .select()
          .from(schema.officeTypes)
          .where(sql`${schema.officeTypes.id} IN (${sql.join(typeIds, sql`, `)})`)
      : []
  const typeMap = Object.fromEntries(types.map((t) => [t.id, t.name]))
  const typeSlugMap = Object.fromEntries(types.map((t) => [t.id, t.slug]))

  const translationsByOffice = translations.reduce(
    (acc, t) => {
      if (!acc[t.officeId]) acc[t.officeId] = {}
      acc[t.officeId][t.locale] = { name: t.name, address: t.address }
      return acc
    },
    {} as Record<number, Record<string, { name: string; address: string | null }>>
  )

  const data = offices.map((o) => ({
    ...o,
    latitude: decimalToNumber(o.latitude),
    longitude: decimalToNumber(o.longitude),
    typeName: typeMap[o.typeId] || '',
    typeSlug: typeSlugMap[o.typeId] || '',
    translations: translationsByOffice[o.id] || {}
  }))

  return {
    data,
    meta: isDropdownMode
      ? buildPaginationMeta(data.length, 1, data.length || 1)
      : buildPaginationMeta(Number(count), page, perPage)
  }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const body = await readBody(event)
  const input = validateBody(officeSchema, body)
  const db = getDatabase()

  const [existing] = await db
    .select({ id: schema.offices.id })
    .from(schema.offices)
    .where(eq(schema.offices.slug, input.slug))
    .limit(1)

  if (existing) throw createValidationError({ slug: 'Slug already exists' })

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.execute(
      `INSERT INTO offices (slug, type_id, parent_id, region, phone, email, latitude, longitude, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.slug,
        input.typeId,
        input.parentId || null,
        input.region,
        input.phone || null,
        input.email || null,
        input.latitude || null,
        input.longitude || null,
        input.displayOrder
      ]
    )

    const officeId = (result as { insertId: number }).insertId

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        await connection.execute(
          `INSERT INTO office_translations (office_id, locale, name, address) VALUES (?, ?, ?, ?)`,
          [officeId, locale, trans.name, trans.address || null]
        )
      }
    }

    await connection.commit()

    const [office] = await db
      .select()
      .from(schema.offices)
      .where(eq(schema.offices.id, officeId))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.officeTranslations)
      .where(eq(schema.officeTranslations.officeId, officeId))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { name: t.name, address: t.address }
        return acc
      },
      {} as Record<string, { name: string; address: string | null }>
    )

    await logAuditAction(event, 'create', 'office', officeId, {
      after: sanitizeForAudit({ ...office, translations: translationsMap })
    })

    return {
      ...office,
      latitude: decimalToNumber(office.latitude),
      longitude: decimalToNumber(office.longitude),
      translations: translationsMap
    }
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:offices', error)
  } finally {
    connection.release()
  }
}
