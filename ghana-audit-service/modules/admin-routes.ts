import { defineNuxtModule } from '@nuxt/kit'
import type { NuxtPage } from '@nuxt/schema'
import { CATALOG_CODES } from '../utils/languageCatalog'

/**
 * The admin panel is English-only, so it needs no `/ak/admin/...`,
 * `/ee/admin/...` copies. @nuxtjs/i18n creates one copy of every page per
 * language; with the whole language catalogue registered that is several
 * hundred admin routes shipped to every visitor for nothing.
 *
 * A local module (rather than a `hooks` entry in nuxt.config.ts) because its
 * hook must run after the i18n module has localized the pages, and modules in
 * `modules/` are installed after the ones listed in the config.
 */
export default defineNuxtModule({
  meta: { name: 'admin-routes' },
  setup(_options, nuxt) {
    const localizedAdmin = new RegExp(`^/(?:${CATALOG_CODES.join('|')})/admin(?:/|$)`)

    const prune = (pages: NuxtPage[]) => {
      for (let i = pages.length - 1; i >= 0; i--) {
        if (localizedAdmin.test(pages[i].path)) pages.splice(i, 1)
      }
    }

    nuxt.hook('pages:resolved', prune)
  }
})
