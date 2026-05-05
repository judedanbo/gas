import type { H3Event } from 'h3'

export type SupportedLocale = 'en' | 'ak'

/**
 * Get the preferred locale from the request's Accept-Language header.
 */
export function getLocaleFromRequest(event: H3Event): SupportedLocale {
  const acceptLang = getHeader(event, 'accept-language') || ''
  if (acceptLang.toLowerCase().includes('ak')) {
    return 'ak'
  }
  return 'en'
}
