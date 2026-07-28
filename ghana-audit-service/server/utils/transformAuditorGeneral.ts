import type { AuditorGeneralMessage } from '~/types'

type SupportedLocale = 'en' | 'ak'

interface DbAuditorGeneralMessage {
  id: number
  photo: string | null
  isActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

interface AuditorGeneralMessageWithTranslations extends DbAuditorGeneralMessage {
  translations: Record<
    string,
    { name: string; title: string; excerpt: string; fullMessage: string }
  >
}

/**
 * Transform the Auditor-General message singleton to public API format.
 * Falls back to English when the requested locale has no translation.
 * Returns null when the record is inactive or has no English translation.
 */
export function transformAuditorGeneralMessage(
  message: AuditorGeneralMessageWithTranslations,
  locale: SupportedLocale = 'en'
): AuditorGeneralMessage | null {
  if (!message.isActive) return null

  const translation = message.translations[locale] || message.translations.en
  if (!translation) return null

  return {
    id: message.id,
    photo: message.photo || undefined,
    name: translation.name,
    title: translation.title,
    excerpt: translation.excerpt,
    fullMessage: translation.fullMessage
  }
}
