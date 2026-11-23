import { DEFAULT_LANGUAGE, DEFAULT_LANGUAGE_CODE, catalogLanguage } from '~/utils/languageCatalog'

/** A language the public site is currently offered in. */
export interface SiteLanguage {
  code: string
  name: string
  nativeName: string
  dir: 'ltr' | 'rtl'
  isDefault: boolean
}

const ENGLISH: SiteLanguage = {
  code: DEFAULT_LANGUAGE.code,
  name: DEFAULT_LANGUAGE.name,
  nativeName: DEFAULT_LANGUAGE.nativeName,
  dir: DEFAULT_LANGUAGE.dir,
  isDefault: true
}

/**
 * The languages switched on at /admin/languages (English is always first).
 *
 * The app is built with routes for every catalogue language, so "which locales
 * exist" (`useI18n().locales`) is not the same as "which are public" — use
 * this wherever visitors are offered a language (switcher, hreflang).
 *
 * The list is filled during SSR by plugins/site-languages.ts and travels in
 * the payload. Because public pages are served from a page cache for up to an
 * hour, the plugin refreshes it once in the browser after mount, so a language
 * switched on or off shows up within about 30 seconds.
 */
export function useSiteLanguages() {
  const languages = useState<SiteLanguage[]>('site-languages', () => [ENGLISH])

  async function refresh() {
    try {
      const response = await $fetch<{ languages: SiteLanguage[] }>('/api/i18n/languages')
      // Only languages this build has routes for can be offered.
      const known = response.languages.filter(
        (language) => language.code === DEFAULT_LANGUAGE_CODE || catalogLanguage(language.code)
      )
      if (known.some((language) => language.isDefault)) languages.value = known
    } catch {
      // Keep what we have; the switcher must never break a page.
    }
  }

  function isEnabled(code: string) {
    return languages.value.some((language) => language.code === code)
  }

  return { languages, refresh, isEnabled }
}
