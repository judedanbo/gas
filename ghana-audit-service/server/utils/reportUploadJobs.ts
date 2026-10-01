import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import {
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
  type SQL
} from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import type { ReportUploadJob, ReportUploadJobStatus } from '../database/schema/report-upload-jobs'
import type { ReportOptimizationMeta } from '../database/schema/audit-reports'
import type { CompressionPreset } from './pdfOptimizer'
import { logError } from './logger'

/**
 * Persistent store for background A-G report uploads (see the schema file for
 * the rationale). This module owns the row lifecycle and the DTO shape the
 * admin API returns; the pipeline (reportUploadPipeline.ts) drives it.
 */

export type { ReportUploadJob, ReportUploadJobStatus }

export const ACTIVE_UPLOAD_STATUSES: readonly ReportUploadJobStatus[] = [
  'queued',
  'storing',
  'thumbnail',
  'optimizing'
]

export function isActiveUploadStatus(status: ReportUploadJobStatus): boolean {
  return ACTIVE_UPLOAD_STATUSES.includes(status)
}

/**
 * Active stages reached only after the original landed in storage (Blob or
 * the mounted share). A job in one of these can be resumed by any process
 * from the stored copy; one still queued/storing only ever existed in its
 * pod's spool file, so when that pod goes away the upload is lost.
 */
export type StoredUploadStatus = 'thumbnail' | 'optimizing'
export const STORED_UPLOAD_STATUSES: readonly StoredUploadStatus[] = ['thumbnail', 'optimizing']
const UNSTORED_UPLOAD_STATUSES: readonly ReportUploadJobStatus[] = ['queued', 'storing']

export function isStoredUploadStatus(status: ReportUploadJobStatus): status is StoredUploadStatus {
  return (STORED_UPLOAD_STATUSES as readonly ReportUploadJobStatus[]).includes(status)
}

/**
 * Pipeline runs a job may get: the original plus resumes. A PDF that keeps
 * killing its pod is given up after this rather than crash-looping replicas;
 * its file is already stored, so it completes with optimization skipped.
 */
export const MAX_UPLOAD_ATTEMPTS = 4

/**
 * The pipeline touches updatedAt this often while alive; a row silent for
 * longer than STALL_TIMEOUT_MS belongs to a producer that died without
 * handing the job off (OOM kill, node loss). The watchdog then fails it if
 * the file was never stored, or queues it for resume if it was, so the
 * admin UI never shows a spinner forever. The optimizer's own queue wait can
 * be long, but the heartbeat keeps ticking through it.
 */
export const HEARTBEAT_INTERVAL_MS = 30_000
export const STALL_TIMEOUT_MS = 5 * 60_000

// Admin-facing summaries (the UI maps the codes to friendlier copy).
const STALLED_ERROR = 'The upload stopped responding and was abandoned'
const INTERRUPTED_ERROR = 'The server restarted before the file was saved'
const EXHAUSTED_ERROR = 'Optimization was interrupted by repeated server restarts'

/** Name this process records as a job's worker: the pod name under Kubernetes. */
export function uploadWorkerId(): string {
  return hostname().slice(0, 255)
}

/** Terminal rows are kept this long for the notification history, then pruned. */
export const TERMINAL_RETENTION_MS = 14 * 24 * 60 * 60_000

/**
 * Progress budget per pipeline stage. Optimization gets most of the bar
 * because it is the long part; the optimizer's phase/page cadence refines
 * it (uploadProgressPercent).
 */
export const STAGE_PROGRESS = {
  queued: 2,
  storing: 8,
  thumbnail: 18,
  optimizingStart: 22,
  optimizingEnd: 98,
  completed: 100
} as const

// Fraction of the optimization span reached at the *end* of each optimizer
// phase. Mirrors the client composable's PHASE_PROGRESS ordering.
const OPTIMIZER_PHASE_FRACTION: Record<string, number> = {
  waiting: 0,
  inspect: 0.05,
  split: 0.1,
  classify: 0.3,
  ocr: 0.75,
  merge: 0.85,
  compress: 0.97,
  done: 1
}

/**
 * Overall 0–100 progress for an optimizing job, refined by page-of-N while
 * inside the per-page phases.
 */
export function uploadProgressPercent(
  phase: string | null | undefined,
  page = 0,
  totalPages = 0
): number {
  const span = STAGE_PROGRESS.optimizingEnd - STAGE_PROGRESS.optimizingStart
  if (!phase) return STAGE_PROGRESS.optimizingStart
  let fraction = OPTIMIZER_PHASE_FRACTION[phase] ?? 0
  if ((phase === 'classify' || phase === 'ocr') && totalPages > 0) {
    const prev =
      phase === 'classify' ? OPTIMIZER_PHASE_FRACTION.split : OPTIMIZER_PHASE_FRACTION.classify
    const pageFrac = Math.min(1, Math.max(0, page / totalPages))
    fraction = prev + (fraction - prev) * pageFrac
  }
  return Math.round(STAGE_PROGRESS.optimizingStart + span * fraction)
}

/**
 * Terminal state for a stored job whose runs kept being cut short: the
 * original is in storage, so the upload itself succeeded — only the
 * optimization is given up on (the admin can re-run it from the edit page).
 */
function exhaustedUploadPatch(
  row: ReportUploadJob,
  now: Date
): Pick<
  ReportUploadJob,
  | 'status'
  | 'progress'
  | 'phase'
  | 'finalSize'
  | 'optimizationStatus'
  | 'optimizationResult'
  | 'error'
  | 'errorCode'
  | 'interruptedAt'
  | 'completedAt'
> {
  return {
    status: 'completed',
    progress: STAGE_PROGRESS.completed,
    phase: null,
    finalSize: row.finalSize ?? row.size,
    optimizationStatus: 'error',
    optimizationResult: null,
    error: EXHAUSTED_ERROR,
    errorCode: 'INTERRUPTED',
    interruptedAt: null,
    completedAt: now
  }
}

/**
 * Apply the watchdog's rules without mutating the row, so a job whose pod
 * died reads correctly before the next sweep has persisted anything: failed
 * (STALLED) if its file was never stored; otherwise awaiting resume
 * (interruptedAt set) — or, once its attempts are spent, completed with the
 * optimization given up.
 */
export function effectiveUploadJob(
  row: ReportUploadJob,
  now: number = Date.now()
): ReportUploadJob {
  if (!isActiveUploadStatus(row.status)) return row
  const silent = now - row.updatedAt.getTime() > STALL_TIMEOUT_MS
  if (!isStoredUploadStatus(row.status)) {
    if (!silent) return row
    return { ...row, status: 'failed', error: STALLED_ERROR, errorCode: 'STALLED' }
  }
  if (!row.interruptedAt && !silent) return row
  if (row.attempts >= MAX_UPLOAD_ATTEMPTS) {
    return { ...row, ...exhaustedUploadPatch(row, new Date(now)) }
  }
  return row.interruptedAt ? row : { ...row, interruptedAt: new Date(now) }
}

export interface ReportUploadJobDTO {
  id: string
  status: ReportUploadJobStatus
  active: boolean
  progress: number
  phase: string | null
  page: number
  totalPages: number
  originalName: string
  filename: string
  fileUrl: string
  mimeType: string
  size: number
  finalSize: number | null
  preset: CompressionPreset
  thumbnailUrl: string | null
  optimizationJobId: string | null
  optimizationStatus: 'pending' | 'success' | 'error'
  optimizationResult: ReportOptimizationMeta | null
  error: string | null
  errorCode: string | null
  /** Pipeline runs so far; above 1 means it was resumed after a server restart. */
  attempts: number
  /** Set while the job waits for another server to resume it. */
  interruptedAt: string | null
  reportId: number | null
  reportTitle: string | null
  user: { id: number; name: string } | null
  dismissedAt: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface UploadJobExtras {
  reportTitle?: string | null
  userName?: string | null
}

export function toUploadJobDTO(
  raw: ReportUploadJob,
  extras: UploadJobExtras = {},
  now: number = Date.now()
): ReportUploadJobDTO {
  const row = effectiveUploadJob(raw, now)
  return {
    id: row.id,
    status: row.status,
    active: isActiveUploadStatus(row.status),
    progress: row.status === 'completed' ? 100 : row.progress,
    phase: row.phase ?? null,
    page: row.page,
    totalPages: row.totalPages,
    originalName: row.originalName,
    filename: row.filename,
    fileUrl: row.fileUrl,
    mimeType: row.mimeType,
    size: row.size,
    finalSize: row.finalSize ?? null,
    preset: row.preset,
    thumbnailUrl: row.thumbnailUrl ?? null,
    optimizationJobId: row.optimizationJobId ?? null,
    optimizationStatus: row.optimizationStatus,
    optimizationResult: row.optimizationResult ?? null,
    error: row.error ?? null,
    errorCode: row.errorCode ?? null,
    attempts: row.attempts,
    interruptedAt: row.interruptedAt ? row.interruptedAt.toISOString() : null,
    reportId: row.reportId ?? null,
    reportTitle: extras.reportTitle ?? null,
    user: row.userId ? { id: row.userId, name: extras.userName ?? 'Unknown' } : null,
    dismissedAt: row.dismissedAt ? row.dismissedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null
  }
}

// ── Persistence ─────────────────────────────────────────────────────────────

export interface CreateUploadJobInput {
  userId: number | null
  originalName: string
  filename: string
  fileUrl: string
  mimeType: string
  size: number
  preset: CompressionPreset
  allowDropBookmarks?: boolean
}

/**
 * Insert the job already owned by its first pipeline run (runId + this
 * process as worker), so the run can start the moment the row exists.
 */
export async function createUploadJob(input: CreateUploadJobInput): Promise<ReportUploadJob> {
  const now = new Date()
  const row: ReportUploadJob = {
    id: randomUUID(),
    userId: input.userId,
    reportId: null,
    status: 'queued',
    progress: STAGE_PROGRESS.queued,
    phase: null,
    page: 0,
    totalPages: 0,
    originalName: input.originalName.slice(0, 255),
    filename: input.filename,
    fileUrl: input.fileUrl,
    mimeType: input.mimeType,
    size: input.size,
    finalSize: null,
    preset: input.preset,
    allowDropBookmarks: input.allowDropBookmarks === true,
    runId: randomUUID(),
    worker: uploadWorkerId(),
    attempts: 1,
    interruptedAt: null,
    thumbnailUrl: null,
    optimizationJobId: null,
    optimizationStatus: 'pending',
    optimizationResult: null,
    error: null,
    errorCode: null,
    dismissedAt: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null
  }
  await getDatabase().insert(schema.reportUploadJobs).values(row)
  return row
}

export async function getUploadJob(id: string): Promise<ReportUploadJob | undefined> {
  const [row] = await getDatabase()
    .select()
    .from(schema.reportUploadJobs)
    .where(eq(schema.reportUploadJobs.id, id))
    .limit(1)
  return row
}

/** Most recent job for a stored file URL (any status). */
export async function findUploadJobByFileUrl(
  fileUrl: string
): Promise<ReportUploadJob | undefined> {
  const [row] = await getDatabase()
    .select()
    .from(schema.reportUploadJobs)
    .where(eq(schema.reportUploadJobs.fileUrl, fileUrl))
    .orderBy(desc(schema.reportUploadJobs.createdAt))
    .limit(1)
  return row
}

export type UploadJobPatch = Partial<Omit<ReportUploadJob, 'id' | 'createdAt' | 'updatedAt'>>

/** Conditions that fence a pipeline write to the run that owns the job. */
export interface UploadJobWriteGuard {
  /** Apply only while this run still owns the job. */
  runId: string
  /** Also require the job to still be in flight, so a handoff never reopens a finished job. */
  activeOnly?: boolean
}

function affectedRows(result: unknown): number {
  return Number((result as { affectedRows?: number } | undefined)?.affectedRows ?? 0)
}

/**
 * Patch a job. Always bumps updatedAt (the stall clock), so any progress
 * write doubles as a heartbeat. With a guard, the write only lands while
 * that run still owns the job.
 *
 * Returns false when the write certainly did not apply because no matching
 * row exists — for a guarded write, the run has lost the job and must stop.
 * Database errors are logged, never thrown, and read as true: a transient
 * failure must neither abort the pipeline nor make a live run give up.
 */
export async function updateUploadJob(
  id: string,
  patch: UploadJobPatch,
  guard?: UploadJobWriteGuard
): Promise<boolean> {
  const t = schema.reportUploadJobs
  const where = guard
    ? and(
        eq(t.id, id),
        eq(t.runId, guard.runId),
        guard.activeOnly ? inArray(t.status, [...ACTIVE_UPLOAD_STATUSES]) : undefined
      )
    : eq(t.id, id)
  try {
    const [result] = await getDatabase()
      .update(t)
      .set({ ...patch, updatedAt: new Date() })
      .where(where)
    return affectedRows(result) > 0
  } catch (err) {
    logError('reportUploadJobs', err)
    return true
  }
}

/**
 * Heartbeat only — keeps an otherwise quiet job (queue wait) from stalling.
 * Fenced like any pipeline write, so it also tells a run whether it still
 * owns its job.
 */
export async function touchUploadJob(id: string, runId: string): Promise<boolean> {
  return updateUploadJob(id, {}, { runId })
}

/**
 * Shutdown handoff for a stored job: release the run's ownership and mark
 * the job claimable, so another process resumes it from storage straight
 * away instead of after the stall timeout. `status` repairs a stage write
 * the run may have lost. False when the run no longer owned an active job.
 */
export async function releaseUploadJobForResume(
  id: string,
  runId: string,
  status: StoredUploadStatus
): Promise<boolean> {
  return updateUploadJob(
    id,
    { status, phase: null, runId: null, interruptedAt: new Date() },
    { runId, activeOnly: true }
  )
}

/**
 * The run is going away before the file reached storage: its bytes only
 * exist in this pod's spool, so fail the job now (the admin must upload it
 * again) rather than leave it to the stall timeout.
 */
export async function failInterruptedUploadJob(id: string, runId: string): Promise<boolean> {
  return updateUploadJob(
    id,
    {
      status: 'failed',
      error: INTERRUPTED_ERROR,
      errorCode: 'INTERRUPTED',
      runId: null,
      completedAt: new Date()
    },
    { runId, activeOnly: true }
  )
}

export interface ListUploadJobsOptions {
  activeOnly?: boolean
  /** Include terminal jobs created after this instant (default: last 24h). */
  since?: Date
  includeDismissed?: boolean
  limit?: number
  /** Only jobs started by this user (the notification center's feed). */
  userId?: number
}

export type UploadJobListRow = ReportUploadJob & {
  reportTitle: string | null
  userName: string | null
}

/**
 * Jobs for the admin UI: every active job, plus recent terminal ones that
 * have not been dismissed. Active first, then newest.
 */
export async function listUploadJobs(
  opts: ListUploadJobsOptions = {}
): Promise<UploadJobListRow[]> {
  const db = getDatabase()
  const since = opts.since ?? new Date(Date.now() - 24 * 60 * 60_000)
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100)
  const active = inArray(schema.reportUploadJobs.status, [...ACTIVE_UPLOAD_STATUSES])

  const recentTerminal = opts.includeDismissed
    ? gt(schema.reportUploadJobs.createdAt, since)
    : and(gt(schema.reportUploadJobs.createdAt, since), isNull(schema.reportUploadJobs.dismissedAt))

  const visible = opts.activeOnly ? active : or(active, recentTerminal)
  const where =
    opts.userId === undefined
      ? visible
      : and(eq(schema.reportUploadJobs.userId, opts.userId), visible)

  const activeFirst = sql<number>`CASE WHEN ${schema.reportUploadJobs.status} IN ('queued','storing','thumbnail','optimizing') THEN 0 ELSE 1 END`

  const rows = await db
    .select({
      job: schema.reportUploadJobs,
      userName: schema.users.name,
      reportTitle: schema.auditReportTranslations.title
    })
    .from(schema.reportUploadJobs)
    .leftJoin(schema.users, eq(schema.users.id, schema.reportUploadJobs.userId))
    .leftJoin(
      schema.auditReportTranslations,
      and(
        eq(schema.auditReportTranslations.auditReportId, schema.reportUploadJobs.reportId),
        eq(schema.auditReportTranslations.locale, 'en')
      )
    )
    .where(where)
    .orderBy(activeFirst, desc(schema.reportUploadJobs.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    ...r.job,
    reportTitle: r.reportTitle ?? null,
    userName: r.userName ?? null
  }))
}

/**
 * Attach a saved report to the job that uploaded its file. Refuses when the
 * job's file is not the one the report references, so a stale uploadJobId in
 * a form can never link the wrong file. Returns the (fresh) job, or
 * undefined when nothing was linked.
 */
export async function linkUploadJobToReport(
  jobId: string,
  reportId: number,
  expectedFileUrl: string
): Promise<ReportUploadJob | undefined> {
  const job = await getUploadJob(jobId)
  if (!job || job.fileUrl !== expectedFileUrl) return undefined
  if (job.reportId !== reportId) {
    await updateUploadJob(jobId, { reportId })
    job.reportId = reportId
  }
  return job
}

/**
 * Hide a finished job from the notification center. Active jobs cannot be dismissed
 * (there is nothing to acknowledge yet). Returns false when nothing changed.
 */
export async function dismissUploadJob(id: string): Promise<boolean> {
  const [result] = await getDatabase()
    .update(schema.reportUploadJobs)
    .set({ dismissedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(schema.reportUploadJobs.id, id),
        inArray(schema.reportUploadJobs.status, ['completed', 'failed']),
        isNull(schema.reportUploadJobs.dismissedAt)
      )
    )
  return Boolean((result as { affectedRows?: number }).affectedRows)
}

/**
 * "Clear all" for one user's notification feed: dismiss every finished job
 * they started. Running jobs are left alone. Returns the number dismissed.
 */
export async function dismissFinishedUploadJobs(userId: number): Promise<number> {
  const now = new Date()
  const [result] = await getDatabase()
    .update(schema.reportUploadJobs)
    .set({ dismissedAt: now, updatedAt: now })
    .where(
      and(
        eq(schema.reportUploadJobs.userId, userId),
        inArray(schema.reportUploadJobs.status, ['completed', 'failed']),
        isNull(schema.reportUploadJobs.dismissedAt)
      )
    )
  return Number((result as { affectedRows?: number }).affectedRows ?? 0)
}

export interface UploadJobSweepResult {
  /** Not yet stored when their run died: failed, the admin must upload again. */
  failed: number
  /** Stored: queued for another run to resume. */
  interrupted: number
}

/**
 * Persist the dead-run rule for the in-flight rows matching `deadRun`:
 * unstored ones fail with `failure`, stored ones are released for resume.
 * Every write also clears runId, fencing out the old run in case it was
 * only slow rather than dead.
 */
async function interruptOrFailRuns(
  deadRun: [SQL, ...SQL[]],
  failure: { error: string; errorCode: string },
  now: Date
): Promise<UploadJobSweepResult> {
  const t = schema.reportUploadJobs
  const db = getDatabase()
  const [failed] = await db
    .update(t)
    .set({ status: 'failed', ...failure, runId: null, completedAt: now, updatedAt: now })
    .where(and(inArray(t.status, [...UNSTORED_UPLOAD_STATUSES]), ...deadRun))
  const [interrupted] = await db
    .update(t)
    .set({ runId: null, phase: null, interruptedAt: now, updatedAt: now })
    .where(and(inArray(t.status, [...STORED_UPLOAD_STATUSES]), isNull(t.interruptedAt), ...deadRun))
  return { failed: affectedRows(failed), interrupted: affectedRows(interrupted) }
}

/**
 * Watchdog: rows whose run went quiet past STALL_TIMEOUT_MS lost their
 * producer without a handoff (OOM kill, node loss). Exported for the plugin
 * and tests.
 */
export async function sweepStalledUploadJobs(
  now: Date = new Date()
): Promise<UploadJobSweepResult> {
  const cutoff = new Date(now.getTime() - STALL_TIMEOUT_MS)
  return interruptOrFailRuns(
    [lt(schema.reportUploadJobs.updatedAt, cutoff)],
    { error: STALLED_ERROR, errorCode: 'STALLED' },
    now
  )
}

/**
 * Margin below this process's start time for "written by a previous
 * process". DATETIME columns round to the second, so a row this process
 * wrote in its first moments can read as slightly older than its start.
 */
const RECOVERY_MARGIN_MS = 2_000

/**
 * Startup recovery after a container restart (OOM kill, failed liveness
 * probe): jobs this host was running when the previous process died are
 * orphans — act on them now rather than after STALL_TIMEOUT_MS. Rows this
 * process wrote are newer than its start, so they are never touched.
 */
export async function recoverOrphanedUploadJobs(
  worker: string,
  processStartedAt: Date,
  now: Date = new Date()
): Promise<UploadJobSweepResult> {
  const t = schema.reportUploadJobs
  const before = new Date(processStartedAt.getTime() - RECOVERY_MARGIN_MS)
  return interruptOrFailRuns(
    [eq(t.worker, worker), lt(t.updatedAt, before)],
    { error: INTERRUPTED_ERROR, errorCode: 'INTERRUPTED' },
    now
  )
}

/** Stored jobs awaiting resume that still have attempts left, oldest first. */
export async function listInterruptedUploadJobs(limit: number): Promise<ReportUploadJob[]> {
  const t = schema.reportUploadJobs
  return getDatabase()
    .select()
    .from(t)
    .where(
      and(
        isNotNull(t.interruptedAt),
        inArray(t.status, [...STORED_UPLOAD_STATUSES]),
        lt(t.attempts, MAX_UPLOAD_ATTEMPTS)
      )
    )
    .orderBy(t.interruptedAt)
    .limit(limit)
}

/**
 * Take ownership of an interrupted job for a new run on this worker. The
 * conditional update is the cross-replica lock: exactly one claimant
 * matches. Returns the claimed row (new runId, attempts incremented), or
 * undefined when another process got there first.
 */
export async function claimInterruptedUploadJob(
  id: string,
  worker: string
): Promise<ReportUploadJob | undefined> {
  const t = schema.reportUploadJobs
  const runId = randomUUID()
  const [result] = await getDatabase()
    .update(t)
    .set({
      runId,
      worker,
      attempts: sql`${t.attempts} + 1`,
      interruptedAt: null,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(t.id, id),
        isNotNull(t.interruptedAt),
        isNull(t.runId),
        inArray(t.status, [...STORED_UPLOAD_STATUSES]),
        lt(t.attempts, MAX_UPLOAD_ATTEMPTS)
      )
    )
  if (affectedRows(result) === 0) return undefined
  const job = await getUploadJob(id)
  return job?.runId === runId ? job : undefined
}

/**
 * Give up on interrupted jobs whose attempts are spent: complete them with
 * the optimization skipped (their file is stored) and land what they have
 * on the report. Returns how many were finalized.
 */
export async function finalizeExhaustedUploadJobs(now: Date = new Date()): Promise<number> {
  const t = schema.reportUploadJobs
  const db = getDatabase()
  const rows = await db
    .select()
    .from(t)
    .where(
      and(
        isNotNull(t.interruptedAt),
        inArray(t.status, [...STORED_UPLOAD_STATUSES]),
        gte(t.attempts, MAX_UPLOAD_ATTEMPTS)
      )
    )
    .limit(20)

  let finalized = 0
  for (const row of rows) {
    const patch = exhaustedUploadPatch(row, now)
    const [result] = await db
      .update(t)
      .set({ ...patch, updatedAt: now })
      .where(and(eq(t.id, row.id), isNotNull(t.interruptedAt), isNull(t.runId)))
    if (affectedRows(result) === 0) continue
    finalized++
    await applyUploadJobToReport({ ...row, ...patch, updatedAt: now })
  }
  return finalized
}

/** Drop terminal rows older than the retention window. */
export async function pruneUploadJobs(now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - TERMINAL_RETENTION_MS)
  await getDatabase()
    .delete(schema.reportUploadJobs)
    .where(
      and(
        inArray(schema.reportUploadJobs.status, ['completed', 'failed']),
        lt(schema.reportUploadJobs.createdAt, cutoff)
      )
    )
}

/**
 * Copy a finished job's outputs onto the report row that uses its file:
 * thumbnail (only if the report has none), the post-optimization size, and
 * the optimization snapshot (only if none was recorded yet). Targets the
 * linked report when its fileUrl still matches, else any live report that
 * references the file (create flow saved while the job ran). Idempotent —
 * both the pipeline and the create/update handlers call it, so whichever
 * side finishes second still lands the data.
 */
export async function applyUploadJobToReport(job: ReportUploadJob): Promise<void> {
  if (job.status !== 'completed') return
  const db = getDatabase()
  const values: Record<string, unknown> = {}

  if (job.thumbnailUrl) {
    values.thumbnail = sql`COALESCE(${schema.auditReports.thumbnail}, ${job.thumbnailUrl})`
  }
  if (job.finalSize) {
    values.fileSize = String(job.finalSize)
  }
  if (job.optimizationStatus === 'success' && job.optimizationResult) {
    values.optimizedAt = sql`COALESCE(${schema.auditReports.optimizedAt}, ${job.completedAt ?? new Date()})`
    values.optimizationMeta = sql`COALESCE(${schema.auditReports.optimizationMeta}, ${JSON.stringify(job.optimizationResult)})`
  }
  if (Object.keys(values).length === 0) return

  const target = job.reportId
    ? and(eq(schema.auditReports.id, job.reportId), eq(schema.auditReports.fileUrl, job.fileUrl))
    : and(eq(schema.auditReports.fileUrl, job.fileUrl), isNull(schema.auditReports.deletedAt))

  try {
    await db.update(schema.auditReports).set(values).where(target)
  } catch (err) {
    logError('reportUploadJobs', err)
  }
}
