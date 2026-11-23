/**
 * vue-i18n runtime options.
 *
 * Languages are translated incrementally in the admin panel
 * (/admin/languages), so any message a language doesn't have yet is shown in
 * English rather than as its raw key. The fallback is expected, not a bug —
 * the missing/fallback console warnings are switched off.
 */
export default defineI18nConfig(() => ({
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false
}))
