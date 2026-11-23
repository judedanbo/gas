/**
 * The languages the site can be offered in.
 *
 * Locale routes (`/ak/...`, `/ee/...`) are generated when the app is built, so
 * a language can only be switched on at runtime if it is listed here — this is
 * the menu the admin picks from at /admin/languages. Which of them are added,
 * enabled and translated lives in the database (`languages`,
 * `ui_translations`); nothing here makes a language public on its own.
 *
 * To offer a language that is not listed, add an entry and deploy. `code` is
 * the URL prefix and must be a lowercase ISO 639 code.
 *
 * Imported by nuxt.config.ts, the server and the client — keep it free of
 * runtime imports.
 */
export interface CatalogLanguage {
  /** URL prefix and i18n locale code (ISO 639-1, or 639-3 where there is none). */
  code: string
  /** English name, shown in the admin panel. */
  name: string
  /** The language's own name, shown to visitors in the language switcher. */
  nativeName: string
  /** BCP 47 tag used for `<html lang>` and hreflang. */
  language: string
  dir: 'ltr' | 'rtl'
  /** Bundled message file under i18n/locales, when one ships with the app. */
  file?: string
}

export const DEFAULT_LANGUAGE_CODE = 'en'

export const DEFAULT_LANGUAGE: CatalogLanguage = {
  code: DEFAULT_LANGUAGE_CODE,
  name: 'English',
  nativeName: 'English',
  language: 'en-GH',
  dir: 'ltr',
  file: 'en.json'
}

/** Every language other than English, in the order the admin picker lists them. */
export const LANGUAGE_CATALOG: readonly CatalogLanguage[] = [
  { code: 'ak', name: 'Akan', nativeName: 'Akan', language: 'ak-GH', dir: 'ltr', file: 'ak.json' },
  { code: 'ee', name: 'Ewe', nativeName: 'Eʋegbe', language: 'ee-GH', dir: 'ltr' },
  { code: 'gaa', name: 'Ga', nativeName: 'Gã', language: 'gaa-GH', dir: 'ltr' },
  { code: 'ada', name: 'Dangme', nativeName: 'Dangme', language: 'ada-GH', dir: 'ltr' },
  { code: 'dag', name: 'Dagbani', nativeName: 'Dagbanli', language: 'dag-GH', dir: 'ltr' },
  { code: 'dga', name: 'Dagaare', nativeName: 'Dagaare', language: 'dga-GH', dir: 'ltr' },
  { code: 'gjn', name: 'Gonja', nativeName: 'Ngbanyito', language: 'gjn-GH', dir: 'ltr' },
  { code: 'xsm', name: 'Kasem', nativeName: 'Kasem', language: 'xsm-GH', dir: 'ltr' },
  { code: 'nzi', name: 'Nzema', nativeName: 'Nzema', language: 'nzi-GH', dir: 'ltr' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa', language: 'ha-GH', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', language: 'fr', dir: 'ltr' }
]

export const CATALOG_CODES: readonly string[] = LANGUAGE_CATALOG.map((language) => language.code)

const BY_CODE = new Map(LANGUAGE_CATALOG.map((language) => [language.code, language]))

export function catalogLanguage(code: string): CatalogLanguage | undefined {
  return BY_CODE.get(code)
}

/**
 * Split a path into its catalogue locale prefix and the rest.
 *   /ak/reports?x=1 → { code: 'ak', rest: '/reports?x=1' }
 *   /ak             → { code: 'ak', rest: '/' }
 *   /reports        → { code: null, rest: '/reports' }
 * English has no prefix, so it is never returned as a code.
 */
export function splitLocalePrefix(path: string): { code: string | null; rest: string } {
  const match = /^\/([a-z]{2,3})(?=[/?#]|$)/.exec(path)
  if (!match || !BY_CODE.has(match[1])) return { code: null, rest: path }
  const rest = path.slice(match[0].length)
  return { code: match[1], rest: rest.startsWith('/') ? rest : `/${rest}` }
}
