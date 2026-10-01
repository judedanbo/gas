import { checkReadiness } from '../utils/healthProbes'

/**
 * GET /readyz — readiness probe (k8s/frontend/deployment.yaml).
 *
 * 200 while this pod's MySQL pool answers a query, 503 otherwise; a failure
 * removes the pod from the Service without restarting it. No SSR, and the
 * database check is timeboxed and shared across concurrent requests — see
 * server/utils/healthProbes.ts.
 */
export default defineEventHandler(async (event) => {
  const report = await checkReadiness()
  setHeader(event, 'Cache-Control', 'no-store')
  if (report.status !== 'ready') {
    setResponseStatus(event, 503)
  }
  return report
})
