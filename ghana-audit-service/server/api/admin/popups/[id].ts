import type { H3Event } from 'h3'
import { and, eq, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import {
  createValidationError,
  popupImageError,
  popupSchema,
  validateBody
} from '../../../utils/validation'
import { safeError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  const method = event.method
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid ID' })

  if (method === 'GET') return handleGet(event, id)
  if (method === 'PUT') return handleUpdate(event, id)
  if (method === 'DELETE') return handleDelete(event, id)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function findPopup(id: number) {
  const [popup] = await getDatabase()
    .select()
    .from(schema.popups)
    .where(and(eq(schema.popups.id, id), isNull(schema.popups.deletedAt)))
    .limit(1)

  if (!popup)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Pop-up not found' })

  return popup
}

async function handleGet(event: H3Event, id: number) {
  requirePermission(event, 'read')
  return findPopup(id)
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  const existing = await findPopup(id)
  const input = validateBody(popupSchema, await readBody(event))
  const imageError = popupImageError(input.imageUrl, existing.imageUrl)
  if (imageError) throw createValidationError({ imageUrl: imageError })

  try {
    await getDatabase()
      .update(schema.popups)
      .set({
        title: input.title,
        imageUrl: input.imageUrl,
        altText: input.altText || null,
        linkUrl: input.linkUrl || null,
        openInNewTab: input.openInNewTab,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        displaySeconds: input.displaySeconds,
        isDismissible: input.isDismissible,
        isActive: input.isActive
      })
      .where(eq(schema.popups.id, id))

    const updated = await findPopup(id)

    await logAuditAction(
      event,
      'update',
      'popup',
      id,
      createChangesObject(
        sanitizeForAudit(existing as Record<string, unknown>) as Record<string, unknown>,
        sanitizeForAudit(updated as Record<string, unknown>) as Record<string, unknown>
      )
    )

    return updated
  } catch (error) {
    throw safeError('admin:popups', error)
  }
}

async function handleDelete(event: H3Event, id: number) {
  requirePermission(event, 'delete')

  const existing = await findPopup(id)

  try {
    await getDatabase()
      .update(schema.popups)
      .set({ deletedAt: new Date() })
      .where(eq(schema.popups.id, id))

    await logAuditAction(event, 'delete', 'popup', id, {
      before: sanitizeForAudit(existing as Record<string, unknown>)
    })

    return { success: true }
  } catch (error) {
    throw safeError('admin:popups', error)
  }
}
