import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, getCurrentUser } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject } from '../../../utils/auditLogger'
import { serviceAppSchema, validateBody, createValidationError } from '../../../utils/validation'
import { safeError } from '../../../utils/errors'
import {
  findServiceAppBySlug,
  invalidateServiceAppCache,
  loadServiceApps,
  writeServiceAppTranslations
} from '../../../utils/serviceAppStore'
import { transformAdminServiceApp } from '../../../utils/transformServiceApp'
import { isDuplicateSlugError } from '../../../utils/serviceAppAdmin'

export default defineEventHandler(async (event) => {
  const method = event.method
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid ID' })

  if (method === 'GET') return handleGet(event, id)
  if (method === 'PUT') return handleUpdate(event, id)
  if (method === 'DELETE') return handleDelete(event, id)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function findApp(id: number) {
  let app
  try {
    ;[app] = await loadServiceApps({ ids: [id] })
  } catch (error) {
    throw safeError('admin:apps', error)
  }
  if (!app) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'App not found' })
  }
  return transformAdminServiceApp(app)
}

async function handleGet(event: H3Event, id: number) {
  requirePermission(event, 'read')
  return findApp(id)
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  const user = getCurrentUser(event)
  const existing = await findApp(id)
  const input = validateBody(serviceAppSchema, await readBody(event))

  if (await findServiceAppBySlug(input.slug, id)) {
    throw createValidationError({ slug: `Another app already uses /${input.slug}` })
  }

  try {
    await getDatabase().transaction(async (tx) => {
      await tx
        .update(schema.serviceApps)
        .set({
          slug: input.slug,
          url: input.url,
          logoUrl: input.logoUrl ?? null,
          imageUrl: input.imageUrl ?? null,
          privacyUrl: input.privacyUrl ?? null,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
          updatedBy: user.id
        })
        .where(eq(schema.serviceApps.id, id))
      await writeServiceAppTranslations(tx, id, input.translations)
    })
    invalidateServiceAppCache()

    const updated = await findApp(id)

    await logAuditAction(
      event,
      'update',
      'service_app',
      id,
      createChangesObject(
        existing as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>
      )
    )

    return updated
  } catch (error) {
    if (isDuplicateSlugError(error)) {
      throw createValidationError({ slug: `Another app already uses /${input.slug}` })
    }
    throw safeError('admin:apps', error)
  }
}

async function handleDelete(event: H3Event, id: number) {
  requirePermission(event, 'delete')

  const existing = await findApp(id)

  try {
    // Translations go with it (ON DELETE CASCADE); the audit log keeps a copy.
    await getDatabase().delete(schema.serviceApps).where(eq(schema.serviceApps.id, id))
    invalidateServiceAppCache()

    await logAuditAction(event, 'delete', 'service_app', id, {
      before: existing as unknown as Record<string, unknown>
    })

    return { success: true }
  } catch (error) {
    throw safeError('admin:apps', error)
  }
}
