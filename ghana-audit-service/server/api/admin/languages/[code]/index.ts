/**
 * Admin API for one site language (admins only).
 *
 *   PATCH  — switch it on or off, or rename it
 *   DELETE — remove it together with every translation entered for it
 *
 * English is built in and can be neither changed nor removed.
 */
import type { H3Event } from 'h3'
import { requireAdmin, getCurrentUser } from '../../../../utils/adminHelpers'
import { logAuditAction } from '../../../../utils/auditLogger'
import { languageUpdateSchema, validateBody } from '../../../../utils/validation'
import { safeError } from '../../../../utils/errors'
import {
  findLanguageRow,
  listAdminLanguages,
  removeLanguage,
  updateLanguage
} from '../../../../utils/languageStore'

export default defineEventHandler(async (event) => {
  if (event.method === 'PATCH') return handleUpdate(event)
  if (event.method === 'DELETE') return handleDelete(event)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function requireLanguage(event: H3Event) {
  const code = getRouterParam(event, 'code') || ''
  const row = await findLanguageRow(code)
  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Language not found'
    })
  }
  return row
}

async function handleUpdate(event: H3Event) {
  requireAdmin(event)

  const user = getCurrentUser(event)
  const input = validateBody(languageUpdateSchema, await readBody(event))

  try {
    const row = await requireLanguage(event)
    await updateLanguage(row.code, input, user.id)
    await logAuditAction(event, 'update', 'language', null, {
      code: row.code,
      before: { name: row.name, nativeName: row.nativeName, isEnabled: row.isEnabled },
      after: {
        name: input.name ?? row.name,
        nativeName: input.nativeName ?? row.nativeName,
        isEnabled: input.isEnabled ?? row.isEnabled
      }
    })

    return await listAdminLanguages()
  } catch (error) {
    throw safeError('admin:languages', error)
  }
}

async function handleDelete(event: H3Event) {
  requireAdmin(event)

  try {
    const row = await requireLanguage(event)
    await removeLanguage(row.code)
    await logAuditAction(event, 'delete', 'language', null, {
      before: { code: row.code, name: row.name, isEnabled: row.isEnabled }
    })

    return await listAdminLanguages()
  } catch (error) {
    throw safeError('admin:languages', error)
  }
}
