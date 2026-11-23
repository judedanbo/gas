/**
 * Admin API for site languages.
 *
 *   GET  — English, the languages added so far (with translation progress)
 *          and the catalogue languages that can still be added
 *   POST — add a catalogue language (starts switched off; admins only)
 */
import type { H3Event } from 'h3'
import { requireAdmin, requirePermission, getCurrentUser } from '../../../utils/adminHelpers'
import { logAuditAction } from '../../../utils/auditLogger'
import { languageCreateSchema, validateBody } from '../../../utils/validation'
import { safeError } from '../../../utils/errors'
import { addLanguage, findLanguageRow, listAdminLanguages } from '../../../utils/languageStore'
import { catalogLanguage } from '../../../../utils/languageCatalog'

export default defineEventHandler(async (event) => {
  if (event.method === 'GET') return handleList(event)
  if (event.method === 'POST') return handleCreate(event)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleList(event: H3Event) {
  requirePermission(event, 'read')

  try {
    return await listAdminLanguages()
  } catch (error) {
    throw safeError('admin:languages', error)
  }
}

async function handleCreate(event: H3Event) {
  requireAdmin(event)

  const user = getCurrentUser(event)
  const input = validateBody(languageCreateSchema, await readBody(event))
  const catalog = catalogLanguage(input.code)
  if (!catalog) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'That language is not available on this site'
    })
  }

  try {
    if (await findLanguageRow(catalog.code)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: `${catalog.name} has already been added`
      })
    }

    await addLanguage(catalog, input, user.id)
    await logAuditAction(event, 'create', 'language', null, {
      after: { code: catalog.code, name: input.name || catalog.name, isEnabled: false }
    })

    setResponseStatus(event, 201)
    return await listAdminLanguages()
  } catch (error) {
    throw safeError('admin:languages', error)
  }
}
