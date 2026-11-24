/**
 * Interface translations entered in the admin panel (/admin/languages).
 *
 * Listed as the last message file of every language other than English, so
 * the i18n module merges it over the language's bundled file (only Akan has
 * one) whenever it loads that language — during SSR and when a visitor
 * switches. Messages a language still lacks fall back to English.
 *
 * Answered by /api/i18n/messages/[locale] from a ~30 s per-pod cache. A
 * failure only costs the entered translations, never the page.
 */
export default defineI18nLocale(async (locale) => {
  try {
    return await $fetch<Record<string, unknown>>(`/api/i18n/messages/${locale}`)
  } catch {
    return {}
  }
})
