/**
 * Loads which languages are switched on in the admin panel (/admin/languages)
 * into `useSiteLanguages`.
 *
 * The list is fetched during SSR and carried in the payload, so hydration
 * uses exactly what the server rendered. Public pages are served from a page
 * cache for up to an hour, so in the browser it is refreshed once after
 * mount — a language switched on or off shows up within about 30 seconds.
 */
export default defineNuxtPlugin({
  name: 'site-languages',
  async setup(nuxtApp) {
    const { refresh } = useSiteLanguages()

    if (import.meta.client && nuxtApp.payload.serverRendered) {
      nuxtApp.hook('app:mounted', () => {
        void refresh()
      })
    } else {
      await refresh()
    }
  }
})
