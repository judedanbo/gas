import type { AuditorGeneralMessage } from '~/types'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { transformAuditorGeneralMessage } from '../utils/transformAuditorGeneral'
import { getLocaleFromRequest } from '../utils/locale'

export default defineEventHandler(async (event): Promise<AuditorGeneralMessage | null> => {
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  const [message] = await db
    .select()
    .from(schema.auditorGeneralMessage)
    .orderBy(schema.auditorGeneralMessage.id)
    .limit(1)

  if (!message) return null

  const translations = await db
    .select()
    .from(schema.auditorGeneralMessageTranslations)
    .where(eq(schema.auditorGeneralMessageTranslations.messageId, message.id))

  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = {
        name: t.name,
        title: t.title,
        excerpt: t.excerpt,
        fullMessage: t.fullMessage
      }
      return acc
    },
    {} as Record<string, { name: string; title: string; excerpt: string; fullMessage: string }>
  )

  return transformAuditorGeneralMessage({ ...message, translations: translationsMap }, locale)
})
