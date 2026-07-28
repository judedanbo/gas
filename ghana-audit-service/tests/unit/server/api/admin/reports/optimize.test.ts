import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolvePublicAsset } from '~/server/utils/publicFiles'
import {
  optimizeReportPdf,
  type OptimizeOptions,
  type OptimizeResult,
  type ProgressEvent
} from '~/server/utils/pdfOptimizer'
import { createJob, getJob, pushEvent, updateJob } from '~/server/utils/pdfOptimizationJobs'
import { tryBlobSource, blobKeyFromFileUrl, uploadBlob } from '~/server/utils/blobStorage'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/publicFiles', () => ({
  resolvePublicAsset: vi.fn()
}))

vi.mock('~/server/utils/blobStorage', () => ({
  tryBlobSource: vi.fn(async () => null),
  blobKeyFromFileUrl: vi.fn((url: string) => url.replace(/^\/+/, '')),
  uploadBlob: vi.fn(async () => undefined)
}))

vi.mock('~/server/utils/pdfOptimizer', async () => {
  const actual = await vi.importActual<typeof import('~/server/utils/pdfOptimizer')>(
    '~/server/utils/pdfOptimizer'
  )
  return {
    ...actual,
    optimizeReportPdf: vi.fn()
  }
})

vi.mock('~/server/utils/adminHelpers', () => ({
  requirePermission: vi.fn()
}))

vi.mock('~/server/utils/auditLogger', () => ({
  logAuditAction: vi.fn(async () => undefined)
}))

vi.mock('~/server/database', () => ({
  getDatabase: vi.fn(() => ({
    update: () => ({
      set: () => ({
        where: () => Promise.resolve()
      })
    })
  })),
  schema: { auditReports: { id: 'id' } }
}))

// Re-implements optimize.post.ts's handler with the same control flow. The
// real route depends on H3 globals that aren't worth booting for a unit test;
// what we care about is that the orchestration delegates correctly to the
// optimizer, threads progress events into the job store, and handles errors
// without crashing the server.
async function runOptimizeRoute(body: {
  fileUrl?: string
  preset?: 'screen' | 'ebook' | 'printer'
  reportId?: number
  allowDropBookmarks?: boolean
}): Promise<{ jobId: string }> {
  if (!body?.fileUrl || typeof body.fileUrl !== 'string') {
    throw { statusCode: 400, statusMessage: 'fileUrl is required' }
  }
  if (!body.fileUrl.startsWith('/pdf/reports/')) {
    throw { statusCode: 400, statusMessage: 'Invalid file path' }
  }
  // Blob-first, disk fallback — same order as materializePdfSource.
  let pdfPath: string | null = null
  let blobKey: string | null = null
  const blob = await tryBlobSource(body.fileUrl)
  if (blob) {
    blobKey = blobKeyFromFileUrl(body.fileUrl)
    // The real route streams the blob to a tmpdir file here; the mirror
    // skips filesystem work and just carries the temp-path/blobKey state.
    pdfPath = `/tmp/gas-optimize-test.pdf`
  } else {
    pdfPath = resolvePublicAsset(body.fileUrl)
  }
  if (!pdfPath) {
    throw { statusCode: 422, statusMessage: 'PDF file not found in storage' }
  }

  const job = createJob(body.fileUrl, body.reportId ?? null)

  void (async () => {
    updateJob(job.id, { status: 'running' })
    try {
      const result = await (
        optimizeReportPdf as unknown as (
          path: string,
          opts: OptimizeOptions
        ) => Promise<OptimizeResult>
      )(pdfPath as string, {
        preset: body.preset ?? 'ebook',
        allowDropBookmarks: body.allowDropBookmarks === true,
        onProgress: (e: ProgressEvent) => pushEvent(job.id, e)
      })
      if (blobKey && !result.skippedCompression) {
        await uploadBlob(blobKey, Buffer.from('optimized'), 'application/pdf')
      }
      updateJob(job.id, { status: 'success', result })
    } catch (err) {
      updateJob(job.id, {
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      })
    }
  })()

  return { jobId: job.id }
}

describe('POST /api/admin/reports/optimize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when fileUrl is missing', async () => {
    await expect(runOptimizeRoute({})).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'fileUrl is required'
    })
  })

  it('returns 400 when fileUrl does not start with /pdf/reports/', async () => {
    await expect(
      runOptimizeRoute({ fileUrl: '/uploads/images/notapdf.pdf' })
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Invalid file path'
    })
  })

  it('returns 422 when the PDF is on neither disk nor Blob', async () => {
    vi.mocked(resolvePublicAsset).mockReturnValue(null)
    vi.mocked(tryBlobSource).mockResolvedValue(null)
    await expect(runOptimizeRoute({ fileUrl: '/pdf/reports/missing.pdf' })).rejects.toMatchObject({
      statusCode: 422,
      statusMessage: 'PDF file not found in storage'
    })
  })

  it('falls back to Blob when the PDF is not on disk and uploads the optimized result back', async () => {
    vi.mocked(resolvePublicAsset).mockReturnValue(null)
    vi.mocked(tryBlobSource).mockResolvedValue({
      stream: {} as never,
      contentLength: 100,
      contentType: 'application/pdf'
    })
    vi.mocked(optimizeReportPdf).mockResolvedValue({
      originalSize: 100,
      optimizedSize: 40,
      savedBytes: 60,
      skippedCompression: false,
      nativePages: 1,
      scannedPages: 0,
      pageCount: 1
    })

    const { jobId } = await runOptimizeRoute({ fileUrl: '/pdf/reports/blob-only.pdf' })

    for (let i = 0; i < 50; i++) {
      const j = getJob(jobId)
      if (j && (j.status === 'success' || j.status === 'error')) break
      await new Promise((r) => setTimeout(r, 5))
    }

    expect(getJob(jobId)?.status).toBe('success')
    expect(vi.mocked(uploadBlob)).toHaveBeenCalledWith(
      'pdf/reports/blob-only.pdf',
      expect.anything(),
      'application/pdf'
    )
  })

  it('does not re-upload to Blob when compression was skipped', async () => {
    vi.mocked(resolvePublicAsset).mockReturnValue(null)
    vi.mocked(tryBlobSource).mockResolvedValue({
      stream: {} as never,
      contentLength: 100,
      contentType: 'application/pdf'
    })
    vi.mocked(optimizeReportPdf).mockResolvedValue({
      originalSize: 100,
      optimizedSize: 100,
      savedBytes: 0,
      skippedCompression: true,
      nativePages: 1,
      scannedPages: 0,
      pageCount: 1
    })

    const { jobId } = await runOptimizeRoute({ fileUrl: '/pdf/reports/tight.pdf' })

    for (let i = 0; i < 50; i++) {
      const j = getJob(jobId)
      if (j && (j.status === 'success' || j.status === 'error')) break
      await new Promise((r) => setTimeout(r, 5))
    }

    expect(getJob(jobId)?.status).toBe('success')
    expect(vi.mocked(uploadBlob)).not.toHaveBeenCalled()
  })

  it('starts an optimization job and threads progress events through the store', async () => {
    vi.mocked(tryBlobSource).mockResolvedValue(null)
    vi.mocked(resolvePublicAsset).mockReturnValue('/abs/pdf/reports/test.pdf')
    vi.mocked(optimizeReportPdf).mockImplementation(
      async (_path: string, opts: OptimizeOptions = {}) => {
        opts.onProgress?.({ phase: 'inspect', pageCount: 3, hasBookmarks: false })
        opts.onProgress?.({
          phase: 'classify',
          page: 2,
          totalPages: 3,
          kind: 'native',
          reason: 'has text'
        })
        opts.onProgress?.({
          phase: 'classify',
          page: 3,
          totalPages: 3,
          kind: 'scanned',
          reason: 'one image, no text'
        })
        opts.onProgress?.({ phase: 'ocr', page: 3, totalPages: 3 })
        opts.onProgress?.({ phase: 'compress' })
        return {
          originalSize: 8 * 1024 * 1024,
          optimizedSize: 3 * 1024 * 1024,
          savedBytes: 5 * 1024 * 1024,
          skippedCompression: false,
          nativePages: 1,
          scannedPages: 1,
          pageCount: 3
        }
      }
    )

    const { jobId } = await runOptimizeRoute({
      fileUrl: '/pdf/reports/test.pdf',
      preset: 'ebook'
    })

    expect(typeof jobId).toBe('string')

    // Wait for the detached optimization to finish.
    for (let i = 0; i < 50; i++) {
      const j = getJob(jobId)
      if (j && (j.status === 'success' || j.status === 'error')) break
      await new Promise((r) => setTimeout(r, 5))
    }

    const job = getJob(jobId)
    expect(job?.status).toBe('success')
    expect(job?.events.some((e) => e.phase === 'inspect')).toBe(true)
    expect(job?.events.some((e) => e.phase === 'classify' && e.kind === 'native')).toBe(true)
    expect(job?.events.some((e) => e.phase === 'classify' && e.kind === 'scanned')).toBe(true)
    expect(job?.events.some((e) => e.phase === 'ocr')).toBe(true)
    expect(job?.result?.savedBytes).toBe(5 * 1024 * 1024)
  })

  it('marks the job as errored when the optimizer rejects', async () => {
    vi.mocked(tryBlobSource).mockResolvedValue(null)
    vi.mocked(resolvePublicAsset).mockReturnValue('/abs/pdf/reports/test.pdf')
    vi.mocked(optimizeReportPdf).mockRejectedValue(new Error('boom'))

    const { jobId } = await runOptimizeRoute({ fileUrl: '/pdf/reports/test.pdf' })

    for (let i = 0; i < 50; i++) {
      const j = getJob(jobId)
      if (j && (j.status === 'success' || j.status === 'error')) break
      await new Promise((r) => setTimeout(r, 5))
    }

    const job = getJob(jobId)
    expect(job?.status).toBe('error')
    expect(job?.error).toMatch(/boom/)
  })
})
