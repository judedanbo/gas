import { logError, logInfo } from './logger'

/**
 * Client for the HR application's metrics API.
 *
 * The HR API supplies staff-related figures (e.g. total staff) that feed the
 * public site statistics. The integration is intentionally optional: until
 * NUXT_HR_API_BASE_URL and NUXT_HR_API_KEY are configured, {@link fetchHrMetrics}
 * is a graceful no-op that returns an empty map, so the site keeps running on
 * the manual values stored against each stat.
 *
 * Expected response shape from the HR endpoint (adjust when the real contract
 * is available): a flat JSON object mapping metric keys to numbers, e.g.
 *   { "staff_total": 2310, "staff_professional": 1500 }
 */
const HR_METRICS_PATH = '/metrics'
const REQUEST_TIMEOUT_MS = 10_000

/**
 * Fetch the current HR metrics map. Returns {} when the HR API is not
 * configured or the request fails (never throws), so callers can safely fall
 * back to manual values.
 */
export async function fetchHrMetrics(): Promise<Record<string, number>> {
  const config = useRuntimeConfig()
  const baseUrl = (config.hrApiBaseUrl || '').trim()
  const apiKey = (config.hrApiKey || '').trim()

  // Disabled until configured — no-op.
  if (!baseUrl || !apiKey) {
    logInfo('hr-api', 'HR API not configured; skipping metric fetch')
    return {}
  }

  try {
    const raw = await $fetch<Record<string, unknown>>(HR_METRICS_PATH, {
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })

    // Keep only numeric metric values; ignore anything else the API returns.
    // Guard against null/'' which Number() would coerce to a misleading 0.
    const metrics: Record<string, number> = {}
    for (const [key, value] of Object.entries(raw || {})) {
      if (value === null || value === undefined || value === '') continue
      const num = typeof value === 'number' ? value : Number(value)
      if (Number.isFinite(num)) metrics[key] = num
    }
    return metrics
  } catch (error) {
    logError('hr-api', error)
    return {}
  }
}
