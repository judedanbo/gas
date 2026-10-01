/**
 * GET /healthz — liveness and startup probe (k8s/frontend/deployment.yaml).
 *
 * Answers from the event loop alone: no SSR, database or Redis, so it stays
 * fast while PDF optimization saturates the pod's CPU, and a dependency outage
 * never restarts the container. See server/utils/healthProbes.ts.
 *
 * No method suffix on purpose: `wget --spider` (Docker HEALTHCHECK) sends HEAD.
 */
export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  })
  return 'ok'
})
