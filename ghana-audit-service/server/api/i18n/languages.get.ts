import { getSiteLanguages, type SiteLanguage } from '../../utils/languageStore'

/**
 * The languages the public site is offered in right now: English plus the
 * ones enabled at /admin/languages. Drives the language switcher, hreflang
 * tags and the client-side locale guard. Answered from a ~30 s per-pod cache
 * and never fails — it degrades to English-only.
 */
export default defineEventHandler(async (): Promise<{ languages: SiteLanguage[] }> => {
  return { languages: await getSiteLanguages() }
})
