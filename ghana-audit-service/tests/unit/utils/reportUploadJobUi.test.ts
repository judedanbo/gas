import { describe, it, expect } from 'vitest'
import {
  formatRelativeTime,
  uploadJobErrorMessage,
  uploadJobPageLabel,
  uploadJobResultSummary,
  uploadJobStageLabel
} from '~/utils/reportUploadJobUi'
import type { ReportUploadJob } from '~/types/admin'

function job(overrides: Partial<ReportUploadJob> = {}): ReportUploadJob {
  return {
    id: 'j',
    status: 'queued',
    active: true,
    progress: 2,
    phase: null,
    page: 0,
    totalPages: 0,
    originalName: 'a.pdf',
    filename: 'x.pdf',
    fileUrl: '/pdf/reports/x.pdf',
    mimeType: 'application/pdf',
    size: 100,
    finalSize: null,
    preset: 'ebook',
    thumbnailUrl: null,
    optimizationJobId: null,
    optimizationStatus: 'pending',
    optimizationResult: null,
    error: null,
    errorCode: null,
    reportId: null,
    reportTitle: null,
    user: null,
    dismissedAt: null,
    createdAt: '2026-09-29T12:00:00.000Z',
    updatedAt: '2026-09-29T12:00:00.000Z',
    completedAt: null,
    ...overrides
  }
}

describe('uploadJobStageLabel', () => {
  it('names each pipeline stage', () => {
    expect(uploadJobStageLabel(job({ status: 'queued' }))).toBe('Queued…')
    expect(uploadJobStageLabel(job({ status: 'storing' }))).toBe('Saving to storage…')
    expect(uploadJobStageLabel(job({ status: 'thumbnail' }))).toBe('Generating thumbnail…')
    expect(uploadJobStageLabel(job({ status: 'optimizing', phase: 'waiting' }))).toMatch(/Waiting/)
    expect(uploadJobStageLabel(job({ status: 'optimizing', phase: 'ocr' }))).toMatch(/OCR/)
    expect(uploadJobStageLabel(job({ status: 'completed', active: false }))).toBe('Upload complete')
    expect(
      uploadJobStageLabel(job({ status: 'completed', active: false, optimizationStatus: 'error' }))
    ).toMatch(/optimization skipped/)
    expect(uploadJobStageLabel(job({ status: 'failed', active: false }))).toBe('Upload failed')
  })
})

describe('uploadJobPageLabel', () => {
  it('only shows page-of-N inside the per-page optimizer phases', () => {
    expect(
      uploadJobPageLabel(job({ status: 'optimizing', phase: 'classify', page: 3, totalPages: 9 }))
    ).toBe('Page 3 of 9')
    expect(uploadJobPageLabel(job({ status: 'optimizing', phase: 'compress' }))).toBeNull()
    expect(uploadJobPageLabel(job({ status: 'storing' }))).toBeNull()
  })
})

describe('uploadJobErrorMessage', () => {
  it('maps upload failure codes to friendly copy', () => {
    expect(uploadJobErrorMessage(job({ status: 'failed', errorCode: 'STALLED' }))).toMatch(
      /upload the file again/
    )
    expect(uploadJobErrorMessage(job({ status: 'failed', errorCode: 'STORE_FAILED' }))).toMatch(
      /storage/
    )
    expect(uploadJobErrorMessage(job({ status: 'failed', error: 'x' }))).toBe('x')
  })

  it('reuses the optimization copy for completed-with-optimization-error', () => {
    expect(
      uploadJobErrorMessage(
        job({ status: 'completed', optimizationStatus: 'error', errorCode: 'HAS_BOOKMARKS' })
      )
    ).toMatch(/bookmarks/)
    expect(
      uploadJobErrorMessage(
        job({ status: 'completed', optimizationStatus: 'error', errorCode: 'INTERRUPTED' })
      )
    ).toMatch(/server restarted before optimization/)
    expect(
      uploadJobErrorMessage(job({ status: 'completed', optimizationStatus: 'success' }))
    ).toBeNull()
    expect(uploadJobErrorMessage(job({ status: 'optimizing' }))).toBeNull()
  })

  it('names the failing optimizer step when there is no dedicated copy', () => {
    expect(
      uploadJobErrorMessage(
        job({ status: 'completed', optimizationStatus: 'error', errorCode: 'SPLIT_FAILED' })
      )
    ).toBe('Optimization failed (SPLIT_FAILED). The original file is unchanged.')
    expect(uploadJobErrorMessage(job({ status: 'completed', optimizationStatus: 'error' }))).toBe(
      'Optimization failed. The original file is unchanged.'
    )
  })
})

describe('uploadJobResultSummary', () => {
  const meta = {
    preset: 'ebook' as const,
    originalSize: 2 * 1024 * 1024,
    optimizedSize: 1024 * 1024,
    savedBytes: 1024 * 1024,
    pageCount: 3,
    nativePages: 3,
    scannedPages: 0,
    ocrFailedPages: 0,
    skippedCompression: false
  }

  it('summarises savings, or the skipped case', () => {
    expect(
      uploadJobResultSummary(
        job({ status: 'completed', optimizationStatus: 'success', optimizationResult: meta })
      )
    ).toBe('Reduced 2.0 MB → 1.0 MB (saved 1.0 MB)')
    expect(
      uploadJobResultSummary(
        job({
          status: 'completed',
          optimizationStatus: 'success',
          optimizationResult: { ...meta, skippedCompression: true }
        })
      )
    ).toMatch(/already well-compressed/)
    expect(uploadJobResultSummary(job({ status: 'optimizing' }))).toBeNull()
  })
})

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-09-29T12:00:00.000Z')
  it('renders coarse relative stamps', () => {
    expect(formatRelativeTime('2026-09-29T11:59:50.000Z', now)).toBe('just now')
    expect(formatRelativeTime('2026-09-29T11:55:00.000Z', now)).toBe('5 minutes ago')
    expect(formatRelativeTime('2026-09-29T11:00:00.000Z', now)).toBe('1 hour ago')
    expect(formatRelativeTime('2026-09-27T12:00:00.000Z', now)).toBe('2 days ago')
    expect(formatRelativeTime('not a date', now)).toBe('')
  })
})
