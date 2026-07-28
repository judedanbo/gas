import { buildHealthReport } from '../utils/health'

/**
 * GET /api/health
 * Public liveness/health probe for external uptime monitors and k8s checks.
 * 200 with { status: 'ok' | 'degraded' } while the site can serve traffic;
 * 503 with { status: 'error' } when the database is unreachable.
 * See server/utils/health.ts for the status semantics.
 */
export default defineEventHandler(async (event) => {
  const report = await buildHealthReport()

  setHeader(event, 'Cache-Control', 'no-store')
  if (report.status === 'error') {
    setResponseStatus(event, 503)
  }

  return report
})
