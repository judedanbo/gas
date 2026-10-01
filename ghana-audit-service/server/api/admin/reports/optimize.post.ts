import type { H3Event } from 'h3'
import { requirePermission } from '../../../utils/adminHelpers'
import { auditActorFromEvent } from '../../../utils/auditLogger'
import { materializePdfSource } from '../../../utils/pdfSource'
import type { CompressionPreset } from '../../../utils/pdfOptimizer'
import {
  isAcceptingOptimizations,
  startExplicitOptimization
} from '../../../utils/explicitOptimizations'
import { getActiveJobForFile, getActiveJobIdLocal } from '../../../utils/pdfOptimizationScheduler'
import { signSseTicket } from '../../../utils/sseTicket'

const ALLOWED_PRESETS: CompressionPreset[] = ['screen', 'ebook', 'printer']

interface OptimizeBody {
  fileUrl?: string
  preset?: CompressionPreset
  reportId?: number
  allowDropBookmarks?: boolean
}

/** This pod is shutting down; the retry reaches a live replica. */
function serverRestarting(event: H3Event) {
  setResponseHeader(event, 'Retry-After', 5)
  return createError({
    statusCode: 503,
    statusMessage: 'The server is restarting. Please try again in a moment.',
    data: { code: 'SERVER_RESTARTING' }
  })
}

export default defineEventHandler(async (event) => {
  requirePermission(event, 'update')

  // A pod that is shutting down must not start an optimization it would only
  // interrupt (see explicitOptimizations.ts).
  if (!isAcceptingOptimizations()) throw serverRestarting(event)

  const body = await readBody<OptimizeBody>(event)
  const fileUrl = body?.fileUrl
  const preset: CompressionPreset =
    body?.preset && ALLOWED_PRESETS.includes(body.preset) ? body.preset : 'ebook'
  const reportId = typeof body?.reportId === 'number' ? body.reportId : null
  const allowDropBookmarks = body?.allowDropBookmarks === true

  if (!fileUrl || typeof fileUrl !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'fileUrl is required' })
  }

  if (!fileUrl.startsWith('/pdf/reports/')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file path' })
  }

  // Mint a short-lived SSE ticket so the EventSource auth travels as a ~2min
  // aud-scoped ticket rather than the long-lived session JWT in the URL.
  const auth = event.context.auth!
  const sseTicket = signSseTicket({ userId: auth.user.id, sid: auth.sessionId })

  // Same-file dedup: if an optimization is already queued/running for this
  // file (on any replica), attach the caller to it instead of starting a
  // duplicate — checked before materializing so we don't download a blob
  // just to attach.
  const existingJobId = await getActiveJobForFile(fileUrl)
  if (existingJobId) {
    return { jobId: existingJobId, sseTicket, attached: true }
  }

  const source = await materializePdfSource(fileUrl)
  if (!source) {
    throw createError({ statusCode: 422, statusMessage: 'PDF file not found in storage' })
  }

  // Re-check after the async materialize: a concurrent same-file POST on this
  // pod may have claimed the file meanwhile. From here to the start there is
  // no await, so the claim itself is race-free in-process.
  const raceWinner = getActiveJobIdLocal(fileUrl)
  if (raceWinner) {
    await source.cleanup()
    return { jobId: raceWinner, sseTicket, attached: true }
  }

  // Run the optimizer detached from the request lifetime, throttled by the
  // scheduler (bounded concurrency + FIFO queue). The SSE endpoint
  // (optimize-stream.get.ts) streams the job's events to the admin UI.
  const job = startExplicitOptimization({
    source,
    fileUrl,
    preset,
    allowDropBookmarks,
    actor: auditActorFromEvent(event),
    reportId
  })
  if (!job) {
    // The pod started shutting down while the PDF was being fetched.
    await source.cleanup()
    throw serverRestarting(event)
  }

  return { jobId: job.id, sseTicket }
})
