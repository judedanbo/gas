import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, getCurrentUser } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { siteStatUpdateSchema, validateBody } from '../../../utils/validation'
import { safeError } from '../../../utils/errors'

/**
 * Edit-only resource: GET a single stat and PUT updates. No create/delete —
 * the set of stats is fixed and seeded. statKey and section are immutable.
 */
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

  const [stat] = await db
    .select()
    .from(schema.siteStats)
    .where(eq(schema.siteStats.id, id))
    .limit(1)

  if (!stat)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Site stat not found'
    })

  return stat
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  getCurrentUser(event) // Verify user is authenticated
  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.siteStats)
    .where(eq(schema.siteStats.id, id))
    .limit(1)

  if (!existing)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Site stat not found'
    })

  const input = validateBody(siteStatUpdateSchema, body)

  try {
    await db
      .update(schema.siteStats)
      .set({
        label: input.label,
        suffix: input.suffix ?? null,
        icon: input.icon || null,
        source: input.source,
        hrMetricKey: input.hrMetricKey || null,
        manualValue: input.manualValue,
        overrideEnabled: input.overrideEnabled,
        displayOrder: input.displayOrder,
        isActive: input.isActive
      })
      .where(eq(schema.siteStats.id, id))

    const [updated] = await db
      .select()
      .from(schema.siteStats)
      .where(eq(schema.siteStats.id, id))
      .limit(1)

    const before = sanitizeForAudit(existing as Record<string, unknown>)
    const after = sanitizeForAudit(updated as Record<string, unknown>)
    await logAuditAction(
      event,
      'update',
      'site_stats',
      id,
      createChangesObject(before as Record<string, unknown>, after as Record<string, unknown>)
    )

    return updated
  } catch (error) {
    throw safeError('admin:site-stats', error)
  }
}
