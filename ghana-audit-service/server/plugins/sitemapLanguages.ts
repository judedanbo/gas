import { DEFAULT_LANGUAGE, LANGUAGE_CATALOG } from '../../utils/languageCatalog'
import { getSiteLanguages } from '../utils/languageStore'

/**
 * Keeps languages that are not switched on out of the sitemap.
 *
 * @nuxtjs/sitemap emits one sitemap per i18n locale and lists every locale as
 * an hreflang alternate of every URL. The build registers the whole language
 * catalogue, but only languages enabled at /admin/languages are public — the
 * rest redirect to English (server/middleware/01-locale-gate.ts) and must not
 * be advertised to search engines.
 */

// Sitemaps and hreflang values are named after the locale's BCP 47 tag.
const CODE_BY_TAG = new Map(
  [DEFAULT_LANGUAGE, ...LANGUAGE_CATALOG].map((language) => [language.language, language.code])
)

async function publicTags(): Promise<Set<string>> {
  const enabled = new Set((await getSiteLanguages()).map((language) => language.code))
  const tags = new Set<string>(['x-default'])
  for (const [tag, code] of CODE_BY_TAG) {
    if (enabled.has(code)) tags.add(tag)
  }
  return tags
}

/** A tag we don't recognise is not ours to hide. */
const isPublic = (tags: Set<string>, tag: string) => tags.has(tag) || !CODE_BY_TAG.has(tag)

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('sitemap:index-resolved', async (ctx) => {
    const tags = await publicTags()
    ctx.sitemaps = ctx.sitemaps.filter((entry) => {
      const name = /\/__sitemap__\/([^/]+)\.xml$/.exec(entry.sitemap)?.[1]
      return !name || isPublic(tags, decodeURIComponent(name))
    })
  })

  nitroApp.hooks.hook('sitemap:resolved', async (ctx) => {
    const tags = await publicTags()
    if (!isPublic(tags, ctx.sitemapName)) {
      ctx.urls = []
      return
    }
    for (const url of ctx.urls) {
      if (url.alternatives) {
        url.alternatives = url.alternatives.filter((alt) => isPublic(tags, alt.hreflang))
      }
    }
  })
})
