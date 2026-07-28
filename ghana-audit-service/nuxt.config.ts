// https://nuxt.com/docs/api/configuration/nuxt-config
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = process.env.NODE_ENV !== 'production'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // DevTools only in dev — it ships debugging surface area otherwise.
  devtools: { enabled: isDev },

  // Don't emit source maps to the browser in production (would expose readable
  // source). Server maps are also disabled to keep source out of the image;
  // set `server: true` if you want line-accurate server stack traces in logs.
  sourcemap: { client: false, server: false },

  // Enable TypeScript
  typescript: {
    strict: true,
    // Run `npm run typecheck` separately — keeping vue-tsc out of `nuxt build`
    // avoids a 5-10 min penalty on every deploy (especially on WSL2).
    typeCheck: false
  },

  // Global CSS
  css: ['~/assets/css/variables.css', '~/assets/css/tailwind.css'],

  // Modules
  modules: [
    '@vueuse/nuxt',
    '@nuxtjs/google-fonts',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/i18n',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxtjs/color-mode',
    '@nuxtjs/sitemap',
    '@vite-pwa/nuxt',
    'nuxt-security'
  ],

  // PWA configuration
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Ghana Audit Service',
      short_name: 'GAS',
      description: 'Official website of the Ghana Audit Service - Protecting the Public Purse',
      theme_color: '#006B3F',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: '/pwa-icons/icon-192x192.svg',
          sizes: '192x192',
          type: 'image/svg+xml'
        },
        {
          src: '/pwa-icons/icon-512x512.svg',
          sizes: '512x512',
          type: 'image/svg+xml'
        },
        {
          src: '/pwa-icons/icon-512x512.svg',
          sizes: '512x512',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api\//],
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
      // Some report cover images exceed workbox's 2 MiB default and would
      // abort the service-worker build; raise the precache size ceiling.
      maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'gstatic-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        }
      ]
    },
    client: {
      installPrompt: true
    },
    devOptions: {
      enabled: false,
      type: 'module'
    }
  },

  // Sitemap configuration
  site: {
    url: 'https://audit.gov.gh'
  },

  // Color mode (dark mode) configuration
  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
    storageKey: 'gas-color-mode'
  },

  // Image optimization
  image: {
    quality: 80,
    format: ['webp', 'jpg', 'png'],
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      '2xl': 1536
    }
  },

  // Icon configuration
  icon: {
    size: '24px',
    class: 'icon',
    // Resolve icons through the same-origin server endpoint (/api/_nuxt_icon),
    // backed by the local server bundle below. This is the universal resolver
    // for dynamic / DB-sourced icon names (e.g. organization.icon) that the
    // client-bundle scanner cannot see as static literals.
    provider: 'server',
    serverBundle: 'local',
    // Ship icons in the client JS so client-rendered pages (e.g. ssr:false
    // /admin/**) never reach for the Iconify CDN, which CSP `connect-src 'self'`
    // blocks. scan picks up literal `prefix:name` strings; .ts/.js are added to
    // the default globs because utils/iconMap.ts holds icon aliases as plain TS.
    clientBundle: {
      scan: {
        globInclude: ['**/*.{vue,jsx,tsx,ts,js,md,mdc,mdx}']
      },
      // Safety net for any name the scanner cannot see as a plain literal.
      icons: [],
      sizeLimitKb: 512 // headroom above the 256 default; current usage is far less
    },
    // Never fall back to the remote Iconify API — a missing icon should render
    // nothing rather than violate CSP. All collections are bundled locally.
    fallbackToApi: false
  },

  // Override the icon server-bundle alias so prerendering resolves icons via
  // process.cwd() instead of the virtual import.meta.url that Nitro injects.
  hooks: {
    'nitro:config'(nitroConfig) {
      nitroConfig.alias = nitroConfig.alias || {}
      nitroConfig.alias['#nuxt-icon-server-bundle'] = resolve(__dirname, 'server/utils/icon-bundle')
    }
  },

  // i18n Configuration
  i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json', iso: 'en-GH' },
      { code: 'ak', name: 'Akan', file: 'ak.json', iso: 'ak-GH' }
    ],
    defaultLocale: 'en',
    bundle: {
      fullInstall: false
    },
    langDir: 'locales',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'gas_locale',
      redirectOn: 'root'
    },
    // SEO - hreflang tags
    baseUrl: 'https://audit.gov.gh'
  },

  // TailwindCSS Configuration
  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
    configPath: 'tailwind.config.ts',
    exposeConfig: false,
    viewer: process.env.NODE_ENV !== 'production'
  },

  // Google Fonts - Modern government typography
  // Using variable fonts to reduce HTTP requests and file size
  googleFonts: {
    families: {
      'Open+Sans': {
        wght: '400..700' // Variable font weight range
      },
      'Plus+Jakarta+Sans': {
        wght: '500..800' // Variable font for headings (medium to extrabold)
      }
    },
    display: 'swap',
    prefetch: true,
    preconnect: true,
    subsets: ['latin', 'latin-ext']
  },

  // App configuration
  app: {
    head: {
      // Note: lang attribute is managed by @nuxtjs/i18n based on current locale
      title: 'Ghana Audit Service',
      titleTemplate: '%s | Ghana Audit Service',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'The Ghana Audit Service - Constitutional mandate to audit public accounts and protect the public purse of Ghana.'
        },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'theme-color', content: '#006B3F' },
        // Open Graph
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Ghana Audit Service' },
        { property: 'og:locale', content: 'en_GH' },
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }
      ]
    }
  },

  // Runtime config
  runtimeConfig: {
    // Private keys (server-side only)
    apiSecret: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    // No default sender: an unconfigured From has no safe value (providers like
    // M365 reject a From the auth mailbox can't send as). Set NUXT_SMTP_FROM to
    // an authorized address; until then email is skipped (see server/utils/email.ts).
    smtpFrom: '',
    // HR application API — supplies staff-related site statistics. Left empty
    // by default; when unset the HR integration is a graceful no-op and figures
    // fall back to their manual values. Filled from NUXT_HR_API_BASE_URL /
    // NUXT_HR_API_KEY. Keep server-side only (never expose the key to clients).
    hrApiBaseUrl: '',
    hrApiKey: '',
    // Public keys (exposed to client)
    public: {
      siteUrl: 'https://audit.gov.gh',
      siteName: 'Ghana Audit Service',
      contactEmail: 'info@audit.gov.gh',
      contactPhone: '+233 (302) 664929'
    }
  },

  // Nitro server configuration
  nitro: {
    // Keep report PDFs (136MB+) out of .output/public. They are never served
    // from the build output: production excludes public/pdf via .dockerignore
    // (downloads stream from Azure Blob / the API), and local dev resolves
    // them from cwd public/ (resolvePublicAsset). Without this, every build
    // spent minutes brotli-compressing them at max quality only for the
    // postbuild strip script to delete the artifacts.
    // After `pdf:migrate-blob public/uploads` has run in production,
    // public/uploads/publications can join this list for the same win.
    //
    // The pattern must be ABSOLUTE: Nitro resolves relative ignore patterns
    // against its srcDir (which Nuxt sets to server/), then silently drops
    // any pattern that escapes the public dir — a relative 'public/pdf/**'
    // becomes '../server/public/pdf/**' and is discarded without effect.
    ignore: [resolve(__dirname, 'public/pdf') + '/**'],
    compressPublicAssets: true,
    experimental: {
      // Enable Nitro tasks (server/tasks/**) so the analytics rollup +
      // retention jobs can run on the schedule below.
      tasks: true
    },
    scheduledTasks: {
      // Roll up the previous hour into route_stats_hourly at :05 every hour.
      '5 * * * *': ['analytics:rollup-hourly'],
      // Refresh bot_signatures every 5 minutes from the last 24h of events.
      '*/5 * * * *': ['analytics:detect-bots'],
      // Trim raw request_events past ANALYTICS_RETENTION_DAYS once a day.
      '0 3 * * *': ['analytics:retention-raw'],
      // Trim abuse_incidents per severity tier (info=90d, warn/critical=365d).
      '15 3 * * *': ['analytics:retention-incidents'],
      // Decay scores on bot_signatures not seen in a week.
      '30 3 * * *': ['analytics:bot-decay'],
      // Refresh HR-backed site statistics from the HR API daily at 04:00.
      // No-op until NUXT_HR_API_BASE_URL / NUXT_HR_API_KEY are configured.
      '0 4 * * *': ['hr:refresh-stats']
    },
    prerender: {
      // Only fully static pages are prerendered at build time. DB-backed pages
      // moved to ISR (see routeRules) so `nuxt build` needs no MySQL and the
      // crawler can't wander into data routes (e.g. /publications/[slug]) and
      // fail. crawlLinks is off to keep prerendering to this explicit list.
      crawlLinks: false,
      routes: [
        '/about',
        // '/about/the-service' and '/about/past-auditors-general' are NOT
        // prerendered: they now render DB-backed site statistics (useSiteStats),
        // so they must render at runtime where MySQL exists. See their ISR
        // routeRules below.
        '/about/departmental-profile',
        '/privacy-policy',
        '/terms',
        '/accessibility',
        '/search'
      ],
      ignore: ['/admin', '/admin/**', '/ak/admin', '/ak/admin/**', '/_ipx/**', '/api/downloads/**']
    },
    // Route rules
    routeRules: {
      // ── Page rendering (ISR) ──────────────────────────────────────────
      // DB-backed content pages render on demand and are cached + revalidated
      // (incremental static regeneration). Unlike build-time prerender, the
      // first request happens at runtime where MySQL exists — so `nuxt build`
      // needs no database, and content refreshes every TTL instead of being
      // frozen at deploy. TTLs are seconds; tune to how often each changes.
      '/': { isr: 600 },
      '/reports': { isr: 600 },
      '/reports/**': { isr: 600 },
      '/publications': { isr: 600 },
      '/publications/**': { isr: 3600 },
      '/media': { isr: 600 },
      '/media/**': { isr: 600 },
      '/careers': { isr: 600 },
      '/careers/**': { isr: 600 },
      '/contact': { isr: 3600 },
      // DB-backed site statistics (useSiteStats) — regenerate at runtime so
      // admin edits appear; these were removed from prerender.routes above.
      '/about/the-service': { isr: 3600 },
      '/about/auditor-general': { isr: 3600 },
      '/about/past-auditors-general': { isr: 3600 },
      '/about/management-team': { isr: 3600 },
      '/about/management-team/**': { isr: 3600 },
      '/about/board-members': { isr: 3600 },
      '/about/board-members/**': { isr: 3600 },
      // Akan locale variants (i18n prefix_except_default) — mirror the TTLs above.
      '/ak': { isr: 600 },
      '/ak/reports': { isr: 600 },
      '/ak/reports/**': { isr: 600 },
      '/ak/publications': { isr: 600 },
      '/ak/publications/**': { isr: 3600 },
      '/ak/media': { isr: 600 },
      '/ak/media/**': { isr: 600 },
      '/ak/careers': { isr: 600 },
      '/ak/careers/**': { isr: 600 },
      '/ak/contact': { isr: 3600 },
      '/ak/about/the-service': { isr: 3600 },
      '/ak/about/auditor-general': { isr: 3600 },
      '/ak/about/past-auditors-general': { isr: 3600 },
      '/ak/about/management-team': { isr: 3600 },
      '/ak/about/management-team/**': { isr: 3600 },
      '/ak/about/board-members': { isr: 3600 },
      '/ak/about/board-members/**': { isr: 3600 },

      // Exclude image optimization and download routes from prerendering —
      // the crawler discovers every srcset breakpoint, adding 90+ routes at
      // ~1s each. Images are generated on-demand at runtime instead.
      '/_ipx/**': { prerender: false },
      '/api/downloads/**': { prerender: false },

      // PWA service worker - prevent Vue Router warning in dev
      '/sw.js': { prerender: false },
      '/workbox-*.js': { prerender: false },

      // Public API caching - disabled in dev, SWR in production.
      // /api/reports (list) is wrapped with defineAnalyticsCachedHandler
      // so its cache hits land in request_events.cache_hit; the route-rule
      // cache must be off for that one path, otherwise the outer rule
      // serves cached without giving the wrapper a chance to flag the hit.
      // /api/reports/** (detail + deeper) still uses route-rule caching
      // until those handlers are migrated too.
      // Health probe (uptime monitors, k8s checks) — must always reflect live
      // state; a cached "ok" would mask an outage. The handler also sets
      // Cache-Control: no-store.
      '/api/health': { cache: false },
      '/api/reports': { cache: false },
      '/api/reports/**': { cache: isDev ? false : { maxAge: 300, staleMaxAge: 600 } },
      '/api/news/**': { cache: isDev ? false : { maxAge: 300, staleMaxAge: 600 } },
      '/api/publications/**': { cache: isDev ? false : { maxAge: 300, staleMaxAge: 600 } },
      '/api/events/**': { cache: isDev ? false : { maxAge: 300, staleMaxAge: 600 } },
      '/api/slideshow': { cache: isDev ? false : { maxAge: 300, staleMaxAge: 600 } },
      // Live-broadcast status must feel current — keep this TTL short (the
      // handler has its own 60s in-process cache on top; see
      // server/utils/liveEvents.ts for the quota math).
      '/api/live-events': { cache: isDev ? false : { maxAge: 60, staleMaxAge: 120 } },
      '/api/team/**': { cache: isDev ? false : { maxAge: 3600, staleMaxAge: 7200 } },
      '/api/gallery/**': { cache: isDev ? false : { maxAge: 600, staleMaxAge: 1200 } },
      '/api/offices/**': { cache: isDev ? false : { maxAge: 3600, staleMaxAge: 7200 } },
      '/api/management-team/**': { cache: isDev ? false : { maxAge: 3600, staleMaxAge: 7200 } },
      '/api/board-members': { cache: isDev ? false : { maxAge: 3600, staleMaxAge: 7200 } },
      '/api/board-members/**': { cache: isDev ? false : { maxAge: 3600, staleMaxAge: 7200 } },
      // /api/site-stats and /api/auditor-general are intentionally NOT
      // edge-cached: both are tiny indexed SELECTs consumed by ISR pages, so
      // full loads are already shielded by page ISR. An edge cache here would
      // only add a staleness layer the admin cannot purge on edit (and
      // /api/auditor-general varies by Accept-Language, which the route-rule
      // cache does not key on), so admin changes surface promptly instead.

      // Admin routes - hidden from SEO, cached only in production
      '/admin/**': {
        ssr: false,
        prerender: false,
        headers: { 'X-Robots-Tag': 'noindex, nofollow' },
        cache: isDev ? false : { maxAge: 60, staleMaxAge: 120 }
      },
      '/ak/admin/**': {
        ssr: false,
        prerender: false,
        headers: { 'X-Robots-Tag': 'noindex, nofollow' },
        cache: isDev ? false : { maxAge: 60, staleMaxAge: 120 }
      },
      '/api/admin/**': {
        cache: false // No caching for admin API (real-time data needed)
      },
      // PDF optimization SSE stream — must not be buffered or compressed.
      '/api/admin/reports/optimize-stream': {
        cache: false,
        headers: { 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' }
      },

      // Security headers for all routes
      '/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
          'X-DNS-Prefetch-Control': 'off'
          // Content-Security-Policy is managed by nuxt-security (see `security` config
          // below) so it can attach a per-request nonce and drop script-src 'unsafe-inline'
          // / 'unsafe-eval'. A static header here cannot carry a nonce.
        }
      }
    }
  },

  // Security (nuxt-security) — scoped to nonce-based CSP only.
  // All other security headers stay in the routeRules `/**` block above, so the
  // header-management features here are disabled to avoid duplicate/conflicting headers,
  // and the request-handling features are disabled because the app already provides them
  // (rate limiting, CSRF) or they would break legitimate flows (large PDF uploads, admin
  // rich-text). See SECURITY-ASSESSMENT.md finding M-1.
  security: {
    nonce: true,
    removeLoggers: false, // preserve existing console.* logging (e.g. analytics salt warning)
    sri: false,
    rateLimiter: false, // app has its own server/utils/rateLimiter.ts
    requestSizeLimiter: false, // report uploads are up to 100MB (validated in fileUpload.ts)
    xssValidator: false, // admin TipTap rich-text would otherwise be rejected
    corsHandler: false, // same-origin app; do not introduce CORS headers
    allowedMethodsRestricter: false,
    headers: {
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'nonce-{{nonce}}'"], // no 'unsafe-inline' / no 'unsafe-eval'
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        // data: is required by @nuxt/icon — icons render in CSS mode as data:image/svg+xml URIs.
        // Removing it blocks ~40 icons site-wide (see SECURITY-ASSESSMENT.md L-4). Guarded by
        // tests/e2e/csp.spec.ts. Negligible XSS risk: data: in img-src is not a script vector;
        // script execution is constrained by the nonce-only script-src above.
        'img-src': ["'self'", 'https:', 'data:'],
        'connect-src': ["'self'"],
        'frame-src': ["'self'", 'https://www.youtube.com', 'https://audit.gov.gh'],
        'base-uri': ["'self'"],
        'object-src': ["'none'"]
      },
      // Headers below are owned by the routeRules `/**` block; disable here to avoid
      // duplicates. COEP/COOP/CORP defaults would also break YouTube embeds + Google Fonts.
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
      strictTransportSecurity: false,
      xFrameOptions: false,
      xContentTypeOptions: false,
      referrerPolicy: false,
      permissionsPolicy: false,
      xXSSProtection: false,
      xDNSPrefetchControl: false,
      originAgentCluster: false
    }
  },

  // Build optimization
  build: {
    transpile: []
  },

  // Experimental features
  experimental: {
    payloadExtraction: true,
    renderJsonPayloads: true
  },

  // Features configuration
  features: {
    inlineStyles: true
  }
})
