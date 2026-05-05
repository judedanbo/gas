import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, getCurrentUser } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { contactSubmissionUpdateSchema, validateBody } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const method = event.method
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid ID' })

  if (method === 'GET') return handleGet(event, id)
  if (method === 'PUT') return handleUpdate(event, id)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleGet(event: H3Event, id: number) {
  requirePermission(event, 'read')
  const db = getDatabase()

  const [submission] = await db
    .select()
    .from(schema.contactSubmissions)
    .where(eq(schema.contactSubmissions.id, id))
    .limit(1)

  if (!submission) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Submission not found'
    })
  }

  return submission
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  const user = getCurrentUser(event)
  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.contactSubmissions)
    .where(eq(schema.contactSubmissions.id, id))
    .limit(1)

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Submission not found'
    })
  }

  const input = validateBody(contactSubmissionUpdateSchema, body)

  const updateData: Record<string, unknown> = { status: input.status }

  // If status is 'responded', set respondedAt and respondedBy
  if (input.status === 'responded' && existing.status !== 'responded') {
    updateData.respondedAt = new Date()
    updateData.respondedBy = user.id
  }

  await db
    .update(schema.contactSubmissions)
    .set(updateData)
    .where(eq(schema.contactSubmissions.id, id))

  const [updated] = await db
    .select()
    .from(schema.contactSubmissions)
    .where(eq(schema.contactSubmissions.id, id))
    .limit(1)

  const before = sanitizeForAudit(existing as Record<string, unknown>)
  const after = sanitizeForAudit(updated as Record<string, unknown>)
  await logAuditAction(
    event,
    'update',
    'contact_submission',
    id,
    createChangesObject(before, after)
  )

  return updated
}
