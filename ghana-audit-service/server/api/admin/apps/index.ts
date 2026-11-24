import type { H3Event } from 'h3'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  getCurrentUser,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { logAuditAction } from '../../../utils/auditLogger'
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

  if (method === 'GET') return handleList(event)
  if (method === 'POST') return handleCreate(event)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleList(event: H3Event) {
  requirePermission(event, 'read')

  const query = getQuery(event)
  const { page, perPage, offset } = parsePagination(query as Record<string, unknown>)
  const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : ''

  try {
    // A handful of rows: filter in memory so the search covers the app name too.
    const apps = (await loadServiceApps())
      .map(transformAdminServiceApp)
      .filter(
        (app) =>
          !search ||
          app.slug.includes(search) ||
          app.translations.en.name.toLowerCase().includes(search) ||
          app.url.toLowerCase().includes(search)
      )

    return {
      data: apps.slice(offset, offset + perPage),
      meta: buildPaginationMeta(apps.length, page, perPage)
    }
  } catch (error) {
    throw safeError('admin:apps', error)
  }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const user = getCurrentUser(event)
  const input = validateBody(serviceAppSchema, await readBody(event))

  if (await findServiceAppBySlug(input.slug)) {
    throw createValidationError({ slug: `Another app already uses /${input.slug}` })
  }

  try {
    const appId = await getDatabase().transaction(async (tx) => {
      const [result] = await tx.insert(schema.serviceApps).values({
        slug: input.slug,
        url: input.url,
        logoUrl: input.logoUrl ?? null,
        imageUrl: input.imageUrl ?? null,
        privacyUrl: input.privacyUrl ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        createdBy: user.id,
        updatedBy: user.id
      })
      await writeServiceAppTranslations(tx, result.insertId, input.translations)
      return result.insertId
    })
    invalidateServiceAppCache()

    const [created] = await loadServiceApps({ ids: [appId] })
    const dto = transformAdminServiceApp(created)

    await logAuditAction(event, 'create', 'service_app', appId, {
      after: dto as unknown as Record<string, unknown>
    })

    return dto
  } catch (error) {
    if (isDuplicateSlugError(error)) {
      throw createValidationError({ slug: `Another app already uses /${input.slug}` })
    }
    throw safeError('admin:apps', error)
  }
}
