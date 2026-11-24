import { splitLocalePrefix } from '~/utils/languageCatalog'

/**
 * Client-side counterpart of server/middleware/01-locale-gate.ts: in-app
 * navigation to a language that is not switched on (a stale link, a typed
 * URL) lands on the same page in English instead.
 */
export default defineNuxtRouteMiddleware((to) => {
  const { code, rest } = splitLocalePrefix(to.fullPath)
  if (!code) return

  const { isEnabled } = useSiteLanguages()
  if (!isEnabled(code)) return navigateTo(rest, { redirectCode: 302 })
})
