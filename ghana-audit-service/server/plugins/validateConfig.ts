/**
 * Nitro plugin to validate required configuration on startup
 * Warns about missing security-critical configuration in production
 */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()

  if (process.env.NODE_ENV === 'production') {
    // Check for API secret
    if (!config.apiSecret) {
      console.warn('[Security] API secret is not configured. Set NUXT_API_SECRET environment variable.')
    }

    // Check for site URL
    if (!config.public.siteUrl || config.public.siteUrl === 'https://audit.gov.gh') {
      console.warn('[Config] Using default site URL. Set NUXT_PUBLIC_SITE_URL for production.')
    }

    // Check for trusted proxies (important for rate limiting)
    if (!process.env.TRUSTED_PROXIES) {
      console.warn('[Security] No trusted proxies configured. Rate limiting may not work correctly behind a reverse proxy.')
    }
  }

  // Log successful startup in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Config] Server configuration validated')
  }
})
