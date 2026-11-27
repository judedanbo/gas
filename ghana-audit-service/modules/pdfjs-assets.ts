import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { defineNuxtModule } from '@nuxt/kit'

/**
 * Serves pdf.js — the engine behind the inline report reader
 * (components/reports/PdfViewer.vue) — as versioned static files under
 * `/pdfjs/<version>/` instead of bundling it.
 *
 * pdf.js is about 2 MB of script plus wasm image decoders, standard fonts and
 * CMaps that it fetches by URL while rendering, and its parser runs in a Web
 * Worker that must be a same-origin script. Static files give every piece a
 * stable address under one prefix, which the client loads only once a visitor
 * chooses "Read online", and which the service worker's precache skips
 * (`globIgnores: ['pdfjs/**']` in nuxt.config.ts) — so opening the site costs
 * nobody 2 MB they may never use. Bundled, the same code would land in hashed
 * `_nuxt/` chunks whose names nothing can pin down.
 *
 * The files are copied out of the package into `node_modules/.cache/` when
 * dev or build starts (Nuxt empties `.nuxt/` after modules have run, so that
 * is no place for them), so what is served always matches the installed
 * package, and the client learns the address from
 * `runtimeConfig.public.pdfjsBaseUrl`. The `legacy` build is used because
 * the site's visitors include many older Android and iOS browsers.
 */
const PUBLIC_PATH = '/pdfjs'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export default defineNuxtModule({
  meta: { name: 'pdfjs-assets' },
  setup(_options, nuxt) {
    const require = createRequire(import.meta.url)
    const packageJsonPath = require.resolve('pdfjs-dist/package.json')
    const packageDir = dirname(packageJsonPath)
    const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string }

    const outDir = join(nuxt.options.rootDir, 'node_modules/.cache/pdfjs-assets')
    const versionDir = join(outDir, version)
    // Start clean so a package upgrade doesn't leave the previous version behind.
    rmSync(outDir, { recursive: true, force: true })

    const copy = (source: string, target: string, transform?: (text: string) => string) => {
      const from = join(packageDir, source)
      const to = join(versionDir, target)
      mkdirSync(dirname(to), { recursive: true })
      if (transform) writeFileSync(to, transform(readFileSync(from, 'utf8')))
      else cpSync(from, to, { recursive: true })
    }

    copy('legacy/build/pdf.min.mjs', 'build/pdf.min.mjs')
    copy('legacy/build/pdf.worker.min.mjs', 'build/pdf.worker.min.mjs')
    // The viewer components have no minified build and point at a source map
    // that isn't shipped; drop the pointer so devtools don't request it.
    copy('legacy/web/pdf_viewer.mjs', 'web/pdf_viewer.mjs', (text) =>
      text.replace(/^\/\/# sourceMappingURL=.*$/m, '')
    )
    copy('legacy/web/pdf_viewer.css', 'web/pdf_viewer.css')
    copy('legacy/web/images', 'web/images')
    // JBIG2 and JPEG 2000 decoders (scanned reports use JBIG2), with JS fallbacks.
    copy('wasm', 'wasm')
    // The 14 standard PDF fonts, for files that reference them without embedding.
    copy('standard_fonts', 'standard_fonts')
    copy('cmaps', 'cmaps')
    copy('iccs', 'iccs')

    nuxt.options.runtimeConfig.public.pdfjsBaseUrl = `${PUBLIC_PATH}/${version}`

    nuxt.hook('nitro:config', (config) => {
      config.publicAssets ||= []
      // Versioned path, so the files can be cached as immutable.
      config.publicAssets.push({ dir: outDir, baseURL: PUBLIC_PATH, maxAge: ONE_YEAR_SECONDS })
    })
  }
})
