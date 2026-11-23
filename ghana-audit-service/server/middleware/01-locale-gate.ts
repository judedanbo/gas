import { sendRedirect } from 'h3'
import { splitLocalePrefix } from '../../utils/languageCatalog'
import { isLanguageEnabled } from '../utils/languageStore'

/**
 * Keeps languages that are not switched on out of public reach.
 *
 * Every catalogue language has routes in the build (`/ak/...`, `/ee/...`),
 * but only the ones an admin enabled at /admin/languages are served. A
 * request under any other language prefix is sent to the same page in
 * English — a temporary redirect, since the language may be enabled later.
 *
 * Runs as middleware so it sits in front of the page cache: a page cached
 * while a language was on stops being served the moment it is switched off
 * (within the language store's ~30 s cache on other pods).
 */
export default defineEventHandler(async (event) => {
  const { code, rest } = splitLocalePrefix(event.path || '/')
  if (!code) return
  if (await isLanguageEnabled(code)) return

  return sendRedirect(event, rest, 302)
})
