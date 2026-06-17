import type { H3Event } from 'h3'
import type { TenderStatus } from '~/types/admin'
import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  getCurrentUser,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import { tenderSchema, validateBody, createValidationError } from '../../../utils/validation'
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

  if (query.includeDeleted !== 'true') {
    conditions.push(isNull(schema.tenders.deletedAt))
  }

  if (query.status && typeof query.status === 'string') {
    conditions.push(eq(schema.tenders.status, query.status as TenderStatus))
  }

  if (query.category && typeof query.category === 'string') {
    conditions.push(eq(schema.tenders.category, query.category))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.tenders)
    .where(whereClause)

  const tenders = await db
    .select()
    .from(schema.tenders)
    .where(whereClause)
    .orderBy(desc(schema.tenders.submissionDeadline))
    .limit(perPage)
    .offset(offset)

  const tenderIds = tenders.map((t) => t.id)
  const translations =
    tenderIds.length > 0
      ? await db
          .select()
          .from(schema.tenderTranslations)
          .where(sql`${schema.tenderTranslations.tenderId} IN (${sql.join(tenderIds, sql`, `)})`)
      : []

  const translationsByTender = translations.reduce(
    (acc, t) => {
      if (!acc[t.tenderId]) acc[t.tenderId] = {}
      acc[t.tenderId][t.locale] = { title: t.title, description: t.description }
      return acc
    },
    {} as Record<number, Record<string, { title: string; description: string | null }>>
  )

  const data = tenders.map((t) => ({
    ...t,
    translations: translationsByTender[t.id] || {}
  }))

  return { data, meta: buildPaginationMeta(Number(count), page, perPage) }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const user = getCurrentUser(event)
  const body = await readBody(event)

  const input = validateBody(tenderSchema, body)
  const db = getDatabase()

  const [existing] = await db
    .select({ id: schema.tenders.id })
    .from(schema.tenders)
    .where(eq(schema.tenders.slug, input.slug))
    .limit(1)

  if (existing) {
    throw createValidationError({ slug: 'A tender with this slug already exists' })
  }

  const [existingRef] = await db
    .select({ id: schema.tenders.id })
    .from(schema.tenders)
    .where(eq(schema.tenders.referenceNumber, input.referenceNumber))
    .limit(1)

  if (existingRef) {
    throw createValidationError({
      referenceNumber: 'A tender with this reference number already exists'
    })
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.execute(
      `INSERT INTO tenders (slug, reference_number, category, submission_deadline, opening_date, document_url, published_at, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.slug,
        input.referenceNumber,
        input.category,
        new Date(input.submissionDeadline),
        input.openingDate ? new Date(input.openingDate) : null,
        input.documentUrl || null,
        new Date(input.publishedAt),
        input.status,
        user.id
      ]
    )

    const tenderId = (result as { insertId: number }).insertId

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        await connection.execute(
          `INSERT INTO tender_translations (tender_id, locale, title, description) VALUES (?, ?, ?, ?)`,
          [tenderId, locale, trans.title, trans.description || null]
        )
      }
    }

    await connection.commit()

    const [tender] = await db
      .select()
      .from(schema.tenders)
      .where(eq(schema.tenders.id, tenderId))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.tenderTranslations)
      .where(eq(schema.tenderTranslations.tenderId, tenderId))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { title: t.title, description: t.description }
        return acc
      },
      {} as Record<string, { title: string; description: string | null }>
    )

    await logAuditAction(event, 'create', 'tender', tenderId, {
      after: sanitizeForAudit({ ...tender, translations: translationsMap })
    })

    return { ...tender, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:tenders', error)
  } finally {
    connection.release()
  }
}
