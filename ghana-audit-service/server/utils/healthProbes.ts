import { getPool } from '../database'

/**
 * Kubernetes probe endpoints (wired up in k8s/frontend/deployment.yaml).
 *
 * Both are deliberately cheap. A-G report optimization runs Ghostscript and
 * Tesseract inside this pod, sharing its CPU quota with the server, so a probe
 * that must SSR a page or wait on Redis can time out while the event loop is
 * starved. A failed liveness probe restarts the container and takes every
 * in-flight upload and optimization down with it.
 *
 * - LIVENESS_PATH (`/healthz`, liveness + startup): the process is up and its
 *   event loop answers. No I/O, so a database or Redis outage can never
 *   restart pods.
 * - READINESS_PATH (`/readyz`): additionally, this pod's MySQL pool can run a
 *   query. Failing it only takes the pod out of the Service, so a rollout whose
 *   new pods cannot reach the database stalls instead of replacing healthy pods.
 *
 * The analytics and rate-limit middleware skip both paths.
 */
export const LIVENESS_PATH = '/healthz'
export const READINESS_PATH = '/readyz'

export function isHealthProbePath(path: string): boolean {
  return path === LIVENESS_PATH || path === READINESS_PATH
}

export interface ReadinessReport {
  status: 'ready' | 'unavailable'
  checks: { database: 'up' | 'down' }
}

// Below the readiness probe's timeoutSeconds, so a wedged pool answers 503
// rather than leaving the kubelet to time the request out.
const DB_CHECK_TIMEOUT_MS = 2_000

// /readyz is public and skips rate limiting, so a burst of requests is
// answered from the last result: at most one database round-trip per second.
const RESULT_TTL_MS = 1_000

let lastResult: { up: boolean; at: number } | null = null
let pendingQuery: Promise<boolean> | null = null

export async function checkReadiness(): Promise<ReadinessReport> {
  const up = await databaseUp()
  return {
    status: up ? 'ready' : 'unavailable',
    checks: { database: up ? 'up' : 'down' }
  }
}

async function databaseUp(): Promise<boolean> {
  if (lastResult && Date.now() - lastResult.at < RESULT_TTL_MS) return lastResult.up
  const up = await withTimeout(pingDatabase(), DB_CHECK_TIMEOUT_MS, false)
  lastResult = { up, at: Date.now() }
  return up
}

// One query in flight at a time: while a check hangs on a stuck connection,
// later probes wait on that same query instead of each checking out another
// pool connection and starving the pages that need them. Deliberately no
// mysql2 `timeout` option: it only rejects early and leaves the connection
// checked out, which would let stuck connections pile up one per probe.
function pingDatabase(): Promise<boolean> {
  pendingQuery ??= Promise.resolve()
    .then(() => getPool().query('SELECT 1'))
    .then(
      () => true,
      () => false
    )
    .finally(() => {
      pendingQuery = null
    })
  return pendingQuery
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    void promise.then((value) => {
      clearTimeout(timer)
      resolve(value)
    })
  })
}

/** Test helper: forget the cached result and any outstanding query. */
export function __resetReadinessForTests(): void {
  lastResult = null
  pendingQuery = null
}
