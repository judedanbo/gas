/**
 * Admin API for a language's interface translations — the mapping from each
 * English message to its text in that language.
 *
 *   GET — every message key with its English text, the bundled translation
 *         (if the language ships a file) and the translation entered here
 *   PUT — apply a batch of edits: `{ translations: { 'nav.home': 'Fie', … } }`.
 *         A string stores the translation; null removes it, so the message
 *         falls back to the bundled text or English.
 */
import type { H3Event } from 'h3'
import { requirePermission, getCurrentUser } from '../../../../utils/adminHelpers'
import { logAuditAction } from '../../../../utils/auditLogger'
import {
  createValidationError,
  translationsUpdateSchema,
  validateBody
} from '../../../../utils/validation'
import { safeError } from '../../../../utils/errors'
import {
  SOURCE_MESSAGES,
  findLanguageRow,
  listAdminLanguages,
  loadTranslationEntries,
  saveTranslations
} from '../../../../utils/languageStore'
import { messageSyntaxProblem } from '../../../../../utils/i18nMessages'

export default defineEventHandler(async (event) => {
  if (event.method === 'GET') return handleGet(event)
  if (event.method === 'PUT') return handleUpdate(event)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function buildResponse(code: string) {
  const [{ languages }, entries] = await Promise.all([
    listAdminLanguages(),
    loadTranslationEntries(code)
  ])
  const language = languages.find((entry) => entry.code === code)
  if (!language || language.isDefault) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Language not found'
    })
  }
  return { language, entries }
}

async function handleGet(event: H3Event) {
  requirePermission(event, 'read')

  try {
    return await buildResponse(getRouterParam(event, 'code') || '')
  } catch (error) {
    throw safeError('admin:translations', error)
  }
}

async function handleUpdate(event: H3Event) {
  requirePermission(event, 'update')

  const user = getCurrentUser(event)
  const code = getRouterParam(event, 'code') || ''
  const { translations } = validateBody(translationsUpdateSchema, await readBody(event))

  const changes: Record<string, string | null> = {}
  const errors: Record<string, string> = {}
  for (const [key, raw] of Object.entries(translations)) {
    const source = SOURCE_MESSAGES[key]
    if (source === undefined) {
      errors[key] = 'This message no longer exists on the site.'
      continue
    }
    const value = raw === null ? '' : raw.trim()
    if (!value) {
      changes[key] = null
      continue
    }
    const problem = messageSyntaxProblem(value, source)
    if (problem) errors[key] = problem
    else changes[key] = value
  }
  if (Object.keys(errors).length > 0) throw createValidationError(errors)

  try {
    if (!(await findLanguageRow(code))) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: 'Language not found'
      })
    }

    const { set, cleared } = await saveTranslations(code, changes, user.id)
    if (set.length > 0 || cleared.length > 0) {
      await logAuditAction(event, 'update', 'translations', null, {
        code,
        set: Object.fromEntries(set.map((key) => [key, changes[key]])),
        cleared
      })
    }

    return { ...(await buildResponse(code)), saved: set.length, cleared: cleared.length }
  } catch (error) {
    throw safeError('admin:translations', error)
  }
}
