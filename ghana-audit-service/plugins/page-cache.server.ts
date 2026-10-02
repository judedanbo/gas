import { hasTransientFetchError } from '~/utils/ssrFetchErrors'

/**
 * Keeps degraded renders out of the public page cache. When a data fetch fails
 * transiently during SSR (e.g. MySQL briefly unreachable), the page still
 * renders — with fallback or empty content — and would otherwise be served to
 * every visitor for the whole TTL, or replace a good cached copy on refresh.
 * server/plugins/pageCache.ts reads the flag and skips storing the render.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hooks.hook('app:rendered', ({ ssrContext }) => {
    if (ssrContext && hasTransientFetchError(nuxtApp.payload._errors)) {
      ssrContext.event.context.ssrFetchFailed = true
    }
  })
})
