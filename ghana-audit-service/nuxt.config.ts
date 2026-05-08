// https://nuxt.com/docs/api/configuration/nuxt-config
const isDev = process.env.NODE_ENV !== 'production'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Enable TypeScript
  typescript: {
    strict: true,
    // Disable vue-tsc checker in dev (has bundled TS missing webworker lib)
    // Run `npx vue-tsc --noEmit` or `npm run build` for type checking
    typeCheck: process.env.NODE_ENV === 'production'
  },

  // Global CSS
  css: ['~/assets/css/tailwind.css'],

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
    '@vite-pwa/nuxt'
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
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
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
    // Default icon size
    size: '24px',
    // Icon class
    class: 'icon',
    // Server-side bundle for SSR - use only locally installed icon packages
    serverBundle: 'local'
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
    compressPublicAssets: true,
    prerender: {
      crawlLinks: true,
      routes: [
        '/',
        '/about',
        '/reports',
        '/publications',
        '/publications/press-statements',
        '/publications/guidelines',
        '/publications/amis-manuals',
        '/publications/pfm-strategy',
        '/publications/applicable-laws',
        '/media',
        '/media/news',
        '/media/gallery',
        '/careers',
        '/contact',
        '/search',
        '/privacy-policy',
        '/terms',
        '/accessibility'
      ],
      // Exclude admin routes from prerendering (they require authentication)
      ignore: ['/admin', '/admin/**', '/ak/admin', '/ak/admin/**']
    },
    // Route rules
    routeRules: {
      // PWA service worker - prevent Vue Router warning in dev
      '/sw.js': { prerender: false },
      '/workbox-*.js': { prerender: false },

      // Public API caching - disabled in dev, SWR in production
      '/api/reports/**': { cache: isDev ? false : { maxAge: 300, staleMaxAge: 600 } },
      '/api/news/**': { cache: isDev ? false : { maxAge: 300, staleMaxAge: 600 } },
      '/api/publications/**': { cache: isDev ? false : { maxAge: 300, staleMaxAge: 600 } },
      '/api/events/**': { cache: isDev ? false : { maxAge: 300, staleMaxAge: 600 } },
      '/api/slideshow': { cache: isDev ? false : { maxAge: 300, staleMaxAge: 600 } },
      '/api/team/**': { cache: isDev ? false : { maxAge: 3600, staleMaxAge: 7200 } },
      '/api/gallery/**': { cache: isDev ? false : { maxAge: 600, staleMaxAge: 1200 } },
      '/api/regional-offices/**': { cache: isDev ? false : { maxAge: 3600, staleMaxAge: 7200 } },
      '/api/management-team/**': { cache: isDev ? false : { maxAge: 3600, staleMaxAge: 7200 } },

      // Admin routes - hidden from SEO, cached only in production
      '/admin/**': {
        prerender: false,
        headers: { 'X-Robots-Tag': 'noindex, nofollow' },
        cache: isDev ? false : { maxAge: 60, staleMaxAge: 120 }
      },
      '/ak/admin/**': {
        prerender: false,
        headers: { 'X-Robots-Tag': 'noindex, nofollow' },
        cache: isDev ? false : { maxAge: 60, staleMaxAge: 120 }
      },
      '/api/admin/**': {
        cache: false // No caching for admin API (real-time data needed)
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
          'X-DNS-Prefetch-Control': 'off',
          'Content-Security-Policy':
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'"
        }
      }
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
