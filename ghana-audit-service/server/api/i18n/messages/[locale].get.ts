import { getMessageOverrides } from '../../../utils/languageStore'
import type { NestedMessages } from '../../../../utils/i18nMessages'

/**
 * Interface translations entered in the admin panel for one language, nested
 * like a locale file. The i18n-overrides plugin merges them over the bundled
 * messages. Empty for English and for languages that are not enabled.
 */
export default defineEventHandler(async (event): Promise<NestedMessages> => {
  const locale = getRouterParam(event, 'locale') || ''
  if (!/^[a-z]{2,3}$/.test(locale)) return {}
  return getMessageOverrides(locale)
})
