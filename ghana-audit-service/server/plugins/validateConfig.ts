import { looksLikePlaceholderSecret } from '../utils/secretChecks'

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

    // Flag secrets left at their insecure example/placeholder values (or too
    // short). A predictable JWT_SECRET, in particular, lets attackers forge
    // admin sessions — generate strong values with `openssl rand -hex 32`.
    const weakSecrets = (
      [
        ['JWT_SECRET', process.env.JWT_SECRET, 32],
        ['NUXT_API_SECRET', config.apiSecret as string | undefined, 16],
        ['ANALYTICS_IP_SALT', process.env.ANALYTICS_IP_SALT, 16]
      ] as const
    )
      .filter(([, value, minLength]) => looksLikePlaceholderSecret(value, minLength))
      .map(([name]) => name)

    if (weakSecrets.length > 0) {
      console.warn(
        `[Security] Insecure placeholder/short secret(s): ${weakSecrets.join(', ')}. ` +
          'Replace with strong random values (openssl rand -hex 32) before production use.'
      )
    }

    // Check for site URL
    if (!config.public.siteUrl || config.public.siteUrl === 'https://audit.gov.gh') {
      console.warn('[Config] Using default site URL. Set NUXT_PUBLIC_SITE_URL for production.')
    }

    // Check for trusted proxies (important for rate limiting)
    if (!process.env.TRUSTED_PROXIES) {
      console.warn('[Security] No trusted proxies configured. Rate limiting may not work correctly behind a reverse proxy.')
    }

    // Redis backs shared rate limiting and analytics counters. Without it both
    // degrade to per-process fallbacks, so rate limits are NOT shared across
    // instances — a multi-replica deployment effectively multiplies the quota.
    if (!process.env.REDIS_URL) {
      console.warn('[Security] REDIS_URL is not set. Rate limiting and analytics use per-process fallbacks; set REDIS_URL for a correct multi-instance production deployment.')
    }
  }

  // Log successful startup in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Config] Server configuration validated')
  }
})
