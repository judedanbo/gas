import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runReportOptimization } from '~/server/utils/runReportOptimization'
import { optimizeReportPdf, PdfOptimizerError } from '~/server/utils/pdfOptimizer'
import { uploadBlobFromFile } from '~/server/utils/blobStorage'
import { persistOptimizationResult } from '~/server/utils/persistOptimizationResult'
import { logAuditActionAs } from '~/server/utils/auditLogger'
import { logError } from '~/server/utils/logger'
import { createJob, getJob } from '~/server/utils/pdfOptimizationJobs'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/pdfOptimizer', async () => {
  const actual = await vi.importActual<typeof import('~/server/utils/pdfOptimizer')>(
    '~/server/utils/pdfOptimizer'
  )
  return { ...actual, optimizeReportPdf: vi.fn() }
})

vi.mock('~/server/utils/blobStorage', () => ({
  uploadBlobFromFile: vi.fn(async () => undefined)
}))

vi.mock('~/server/utils/persistOptimizationResult', () => ({
  persistOptimizationResult: vi.fn(async () => undefined)
}))

vi.mock('~/server/utils/auditLogger', () => ({
  logAuditActionAs: vi.fn(async () => undefined)
}))

vi.mock('~/server/utils/logger', () => ({
  logError: vi.fn()
}))

const actor = { userId: 7, ipAddress: null, userAgent: null }
const FILE_URL = '/pdf/reports/x.pdf'

const result = {
  originalSize: 5000,
  optimizedSize: 3000,
  savedBytes: 2000,
  skippedCompression: false,
  nativePages: 3,
  scannedPages: 0,
  ocrFailedPages: 0,
  pageCount: 3
}

function setup() {
  const controller = new AbortController()
  const job = createJob(FILE_URL, null)
  const cleanup = vi.fn(async () => undefined)
  const run = () =>
    runReportOptimization({
      jobId: job.id,
      source: { path: '/tmp/gas-test-missing.pdf', blobKey: 'pdf/reports/x.pdf', cleanup },
      fileUrl: FILE_URL,
      preset: 'ebook',
      allowDropBookmarks: false,
      actor,
      reportId: null,
      signal: controller.signal
    })
  return { controller, job, cleanup, run }
}

beforeEach(() => {
  vi.mocked(optimizeReportPdf).mockResolvedValue(result)
})

describe('runReportOptimization', () => {
  it('optimizes with the signal, pushes the bytes back and logs against the actor', async () => {
    const { controller, job, cleanup, run } = setup()

    await run()

    expect(optimizeReportPdf).toHaveBeenCalledWith(
      '/tmp/gas-test-missing.pdf',
      expect.objectContaining({ preset: 'ebook', signal: controller.signal })
    )
    expect(uploadBlobFromFile).toHaveBeenCalledWith(
      'pdf/reports/x.pdf',
      '/tmp/gas-test-missing.pdf',
      'application/pdf'
    )
    expect(persistOptimizationResult).toHaveBeenCalled()
    expect(getJob(job.id)).toMatchObject({ status: 'success' })
    expect(logAuditActionAs).toHaveBeenCalledWith(
      actor,
      'update',
      'report_optimization',
      null,
      expect.objectContaining({ after: expect.objectContaining({ savedBytes: 2000 }) })
    )
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('never starts when aborted while it waited for a slot', async () => {
    const { controller, job, cleanup, run } = setup()
    controller.abort()

    await run()

    expect(optimizeReportPdf).not.toHaveBeenCalled()
    expect(getJob(job.id)).toMatchObject({ status: 'error', errorCode: 'INTERRUPTED' })
    expect(logError).not.toHaveBeenCalled()
    expect(logAuditActionAs).toHaveBeenCalledWith(actor, 'update', 'report_optimization', null, {
      after: { fileUrl: FILE_URL, preset: 'ebook', error: 'INTERRUPTED' }
    })
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('reports an interruption as INTERRUPTED, whatever the optimizer threw on its way out', async () => {
    const { controller, job, run } = setup()
    vi.mocked(optimizeReportPdf).mockImplementation(async () => {
      controller.abort()
      // e.g. Ghostscript killed mid-run surfaces as a compress failure.
      throw new PdfOptimizerError('COMPRESS_FAILED', 'gs failed: killed')
    })

    await run()

    expect(getJob(job.id)).toMatchObject({ status: 'error', errorCode: 'INTERRUPTED' })
    expect(logError).not.toHaveBeenCalled()
  })

  it('does not push optimized bytes to storage once aborted', async () => {
    const { controller, job, run } = setup()
    vi.mocked(optimizeReportPdf).mockImplementation(async () => {
      controller.abort()
      return result
    })

    await run()

    expect(uploadBlobFromFile).not.toHaveBeenCalled()
    expect(persistOptimizationResult).not.toHaveBeenCalled()
    expect(getJob(job.id)).toMatchObject({ status: 'error', errorCode: 'INTERRUPTED' })
  })

  it('keeps the optimizer’s own code for a genuine failure', async () => {
    const { job, run } = setup()
    vi.mocked(optimizeReportPdf).mockRejectedValueOnce(
      new PdfOptimizerError('HAS_BOOKMARKS', 'has bookmarks')
    )

    await run()

    expect(getJob(job.id)).toMatchObject({ status: 'error', errorCode: 'HAS_BOOKMARKS' })
    expect(logError).toHaveBeenCalled()
  })
})
