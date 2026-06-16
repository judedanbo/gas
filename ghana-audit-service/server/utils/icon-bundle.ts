import heroicons from '@iconify-json/heroicons/icons.json'
import simpleIcons from '@iconify-json/simple-icons/icons.json'

// Static imports (not createRequire) so Nitro inlines the collection JSON into
// .output/server. The previous dynamic require was never bundled and threw at
// runtime in the slim production image, which ships only .output (no
// node_modules) — so /api/_nuxt_icon failed and any icon not in the client
// bundle (e.g. admin/DB-sourced names) could not resolve. Static imports also
// resolve correctly during prerender, the reason this custom bundle exists.
export const collections: Record<string, () => unknown> = {
  heroicons: () => heroicons,
  'simple-icons': () => simpleIcons
}
