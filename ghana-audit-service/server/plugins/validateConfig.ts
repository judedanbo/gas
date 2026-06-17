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
        ['NUXT_API_SECRET', config.apiSecret as string | undefined, 16]
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

    // Analytics IP salt (M-3). Stored IP hashes are sha256(ip|salt); without a
    // strong salt they are trivially reversible (the IPv4 space is enumerable),
    // which defeats the guarantee that raw IPs are never recoverable. Unlike the
    // secrets above, an *unset* salt is the most common and most dangerous state,
    // so it must be checked explicitly — looksLikePlaceholderSecret() returns
    // false for unset/empty by design. Warn loudly at boot; require >=32 chars.
    const ipSalt = process.env.ANALYTICS_IP_SALT
    if (!ipSalt || looksLikePlaceholderSecret(ipSalt, 32)) {
      console.warn(
        '[Security] ANALYTICS_IP_SALT is missing, too short (<32 chars), or a placeholder. ' +
          'Stored IP hashes are reversible without a strong salt — generate one with ' +
          '`openssl rand -hex 32` and set ANALYTICS_IP_SALT before production use.'
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

    // SMTP backs transactional email (admin invitations + contact-form
    // notifications via server/utils/email.ts). getTransporter() returns null
    // unless host/user/pass are all set, in which case sends silently no-op.
    // Surface that at boot so a misconfigured deployment is visible in the logs.
    if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
      console.warn('[Config] SMTP is not fully configured (NUXT_SMTP_HOST/USER/PASS). Invitation and contact-form emails will be skipped until all three are set.')
    }
  }

  // Log successful startup in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Config] Server configuration validated')
  }
})
