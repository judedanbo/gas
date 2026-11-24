import type { MaybeRefOrGetter } from 'vue'
import type { ServiceApp, ServiceAppSummary } from '~/types'

/**
 * Audit Service apps (CitizensEye, the Recommendations Tracker, …), managed at
 * /admin/apps. App text exists in English and, where entered, Akan; every
 * other language shows the English.
 */
function appLocaleQuery(locale: string): Record<string, string> {
  return locale === 'ak' ? { locale: 'ak' } : {}
}

/** Published apps in display order — the /apps hub and the home page. */
export function useServiceApps() {
  const { locale } = useI18n()
  return useFetch<ServiceAppSummary[]>('/api/apps', {
    query: computed(() => appLocaleQuery(locale.value)),
    default: () => []
  })
}

/**
 * One app's landing page content; a 404 error when there is no such app.
 * Pass `immediate: false` to skip the request (the result stays empty).
 */
export function useServiceApp(
  slug: MaybeRefOrGetter<string>,
  options: { immediate?: boolean } = {}
) {
  const { locale } = useI18n()
  return useFetch<ServiceApp>(() => `/api/apps/${encodeURIComponent(toValue(slug))}`, {
    query: computed(() => appLocaleQuery(locale.value)),
    immediate: options.immediate ?? true
  })
}
