import { describe, it, expect } from 'vitest'
import {
  filterNotifications,
  isUploadNotificationId,
  notificationBellLabel,
  notificationDetails,
  notificationPath,
  notificationToastMessage,
  optimizationStatusToPatch,
  sortNotifications,
  uploadJobIdFromNotificationId,
  uploadJobNotificationId,
  uploadJobToNotification
} from '~/utils/adminNotifications'
import type { AdminNotification, ReportUploadJob } from '~/types/admin'
import type { OptimizationStatusResponse } from '~/composables/useReportOptimization'

function job(overrides: Partial<ReportUploadJob> = {}): ReportUploadJob {
  return {
    id: 'job-1',
    status: 'optimizing',
    active: true,
    progress: 40,
    phase: 'classify',
    page: 3,
    totalPages: 10,
    originalName: 'AG Report 2025.pdf',
    filename: 'x.pdf',
    fileUrl: '/pdf/reports/x.pdf',
    mimeType: 'application/pdf',
    size: 5 * 1024 * 1024,
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
    user: { id: 7, name: 'Ama' },
    dismissedAt: null,
    createdAt: '2026-09-29T12:00:00.000Z',
    updatedAt: '2026-09-29T12:01:00.000Z',
    completedAt: null,
    ...overrides
  }
}

const optimizationResult = {
  preset: 'ebook' as const,
  originalSize: 20 * 1024 * 1024,
  optimizedSize: 5 * 1024 * 1024,
  savedBytes: 15 * 1024 * 1024,
  pageCount: 10,
  nativePages: 8,
  scannedPages: 2,
  ocrFailedPages: 0,
  skippedCompression: false
}

function status(overrides: Partial<OptimizationStatusResponse> = {}): OptimizationStatusResponse {
  return {
    active: true,
    jobId: 'opt-1',
    status: 'running',
    fileUrl: '/pdf/reports/x.pdf',
    reportId: 42,
    error: null,
    errorCode: null,
    result: null,
    lastEvent: { phase: 'ocr', page: 5, totalPages: 10 },
    lastSeq: 9,
    startedAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

describe('uploadJobToNotification', () => {
  it('shows a running upload with its stage, page and progress', () => {
    const n = uploadJobToNotification(job())
    expect(n).toMatchObject({
      id: 'upload:job-1',
      source: 'report-upload',
      category: 'upload',
      status: 'running',
      title: 'Uploading report',
      subject: 'AG Report 2025.pdf',
      meta: '5.0 MB',
      progress: 40,
      progressLabel: 'Classifying pages…',
      progressDetail: 'Page 3 of 10',
      finishedAt: null
    })
    expect(n.actions).toEqual([])
  })

  it('shows an interrupted upload as still running, resuming after the restart', () => {
    const waiting = uploadJobToNotification(job({ interruptedAt: '2026-09-29T12:00:00.000Z' }))
    expect(waiting).toMatchObject({
      status: 'running',
      progressLabel: 'Server restarted — resuming shortly…',
      progressDetail: null
    })

    const resumed = uploadJobToNotification(job({ attempts: 2 }))
    expect(resumed.notes).toEqual([
      expect.objectContaining({ tone: 'muted', text: expect.stringMatching(/server restart/) })
    ])
  })

  it('offers to create a report from a finished, unattached upload', () => {
    const n = uploadJobToNotification(
      job({
        status: 'completed',
        active: false,
        progress: 100,
        finalSize: 5 * 1024 * 1024,
        optimizationStatus: 'success',
        optimizationResult,
        completedAt: '2026-09-29T12:05:00.000Z'
      })
    )
    expect(n.status).toBe('success')
    expect(n.title).toBe('Report upload complete')
    expect(n.progress).toBeNull()
    expect(n.finishedAt).toBe('2026-09-29T12:05:00.000Z')
    expect(n.notes).toEqual([{ text: 'Reduced 20.0 MB → 5.0 MB (saved 15.0 MB)', tone: 'success' }])
    expect(n.actions).toEqual([
      {
        label: 'Create report from this file',
        to: { path: '/admin/reports/create', query: { uploadJobId: 'job-1' } }
      }
    ])
  })

  it('links to the report once the upload is attached to one', () => {
    const n = uploadJobToNotification(job({ reportId: 42, reportTitle: 'Annual Report on MDAs' }))
    expect(n.subject).toBe('Annual Report on MDAs')
    expect(n.meta).toBe('AG Report 2025.pdf · 5.0 MB')
    expect(n.actions).toEqual([{ label: 'Open report', to: '/admin/reports/42/edit' }])
  })

  it('warns when the file was stored but optimization failed', () => {
    const n = uploadJobToNotification(
      job({
        status: 'completed',
        active: false,
        optimizationStatus: 'error',
        errorCode: 'HAS_BOOKMARKS'
      })
    )
    expect(n.status).toBe('warning')
    expect(n.title).toBe('Report uploaded — optimization skipped')
    expect(n.notes).toEqual([
      { text: 'This PDF contains bookmarks that optimization would remove.', tone: 'warning' }
    ])
  })

  it('explains a failed upload and flags OCR misses on success', () => {
    const failed = uploadJobToNotification(
      job({ status: 'failed', active: false, errorCode: 'STALLED' })
    )
    expect(failed.status).toBe('error')
    expect(failed.title).toBe('Report upload failed')
    expect(failed.notes[0].tone).toBe('error')
    expect(failed.notes[0].text).toMatch(/stopped responding/)
    expect(failed.actions).toEqual([])

    const ocr = uploadJobToNotification(
      job({
        status: 'completed',
        active: false,
        optimizationStatus: 'success',
        optimizationResult: { ...optimizationResult, ocrFailedPages: 2 }
      })
    )
    expect(ocr.notes.map((note) => note.tone)).toEqual(['success', 'warning'])
  })
})

describe('optimizationStatusToPatch', () => {
  it('maps a running job to its phase, page and progress', () => {
    const patch = optimizationStatusToPatch(status(), 42)
    expect(patch).toMatchObject({
      status: 'running',
      title: 'Optimizing PDF',
      progressLabel: 'Running OCR on scanned pages…',
      progressDetail: 'Page 5 of 10',
      actions: [{ label: 'Open report', to: '/admin/reports/42/edit' }]
    })
    expect(patch.progress).toBeGreaterThan(25)
    expect(patch.progress).toBeLessThan(60)
  })

  it('reads a queued job as waiting for a slot', () => {
    const patch = optimizationStatusToPatch(status({ status: 'queued', lastEvent: null }), null)
    expect(patch).toMatchObject({
      status: 'running',
      progress: 0,
      progressLabel: 'Waiting for a free optimizer slot…',
      progressDetail: null,
      actions: []
    })
  })

  it('summarizes success, including an already-compressed file', () => {
    const done = optimizationStatusToPatch(
      status({ status: 'success', active: false, result: optimizationResult }),
      42
    )
    expect(done.status).toBe('success')
    expect(done.title).toBe('PDF optimized')
    expect(done.progress).toBeNull()
    expect(done.notes[0]).toEqual({
      text: 'Reduced 20.0 MB → 5.0 MB (saved 15.0 MB)',
      tone: 'success'
    })

    const kept = optimizationStatusToPatch(
      status({
        status: 'success',
        active: false,
        result: { ...optimizationResult, skippedCompression: true }
      }),
      42
    )
    expect(kept.notes[0].text).toBe('File was already well-compressed; original kept.')
  })

  it('turns an error code into the friendly message', () => {
    const failed = optimizationStatusToPatch(
      status({ status: 'error', active: false, errorCode: 'TIMEOUT' }),
      42
    )
    expect(failed.status).toBe('error')
    expect(failed.title).toBe('Optimization failed')
    expect(failed.notes[0].text).toMatch(/took too long/)
  })

  it('reads a server restart as an interruption to run again, not a failure', () => {
    const interrupted = optimizationStatusToPatch(
      status({ status: 'error', active: false, errorCode: 'INTERRUPTED' }),
      42
    )
    expect(interrupted).toMatchObject({
      status: 'warning',
      title: 'Optimization interrupted',
      progress: null,
      actions: [{ label: 'Open report', to: '/admin/reports/42/edit' }]
    })
    expect(interrupted.notes).toEqual([
      {
        text: expect.stringMatching(/interrupted by a server restart.*run optimization again/),
        tone: 'warning'
      }
    ])
  })
})

describe('sortNotifications', () => {
  function n(id: string, extra: Partial<AdminNotification>): AdminNotification {
    return {
      ...uploadJobToNotification(job({ id })),
      ...extra
    }
  }

  it('lists running entries first, then outcomes by recency', () => {
    const sorted = sortNotifications([
      n('old-done', {
        status: 'success',
        createdAt: '2026-09-29T08:00:00.000Z',
        finishedAt: '2026-09-29T09:00:00.000Z'
      }),
      n('running-old', { status: 'running', createdAt: '2026-09-29T10:00:00.000Z' }),
      n('new-done', {
        status: 'error',
        createdAt: '2026-09-29T07:00:00.000Z',
        finishedAt: '2026-09-29T11:00:00.000Z'
      }),
      n('running-new', { status: 'running', createdAt: '2026-09-29T10:30:00.000Z' })
    ])
    expect(sorted.map((x) => x.id)).toEqual([
      'upload:running-new',
      'upload:running-old',
      'upload:new-done',
      'upload:old-done'
    ])
  })
})

describe('labels', () => {
  it('round-trips upload notification ids', () => {
    expect(uploadJobIdFromNotificationId(uploadJobNotificationId('abc'))).toBe('abc')
  })

  it('builds the toast line from the title and subject', () => {
    const n = uploadJobToNotification(job({ status: 'failed', active: false }))
    expect(notificationToastMessage(n)).toBe('Report upload failed: AG Report 2025.pdf')
    expect(notificationToastMessage({ ...n, subject: null })).toBe('Report upload failed')
  })

  it('describes the bell for screen readers', () => {
    expect(notificationBellLabel(0, 0)).toBe('Notifications')
    expect(notificationBellLabel(2, 0)).toBe('Notifications (2 in progress)')
    expect(notificationBellLabel(1, 3)).toBe('Notifications (1 in progress, 3 unread)')
  })
})

describe('notification pages', () => {
  it('links to an encoded per-notification page', () => {
    expect(notificationPath('upload:job-1')).toBe('/admin/notifications/upload%3Ajob-1')
    expect(isUploadNotificationId('upload:job-1')).toBe(true)
    expect(isUploadNotificationId('upload:')).toBe(false)
    expect(isUploadNotificationId('local:abc')).toBe(false)
  })

  it('filters by running, unread and needs-attention', () => {
    const items = [
      uploadJobToNotification(job({ id: 'run' })),
      uploadJobToNotification(
        job({ id: 'ok', status: 'completed', active: false, optimizationStatus: 'success' })
      ),
      uploadJobToNotification(job({ id: 'bad', status: 'failed', active: false })),
      uploadJobToNotification(
        job({ id: 'warn', status: 'completed', active: false, optimizationStatus: 'error' })
      )
    ]
    const ids = (f: Parameters<typeof filterNotifications>[1], unread: string[] = []) =>
      filterNotifications(items, f, unread).map((n) => n.id)
    expect(ids('all')).toHaveLength(4)
    expect(ids('running')).toEqual(['upload:run'])
    expect(ids('unread', ['upload:ok'])).toEqual(['upload:ok'])
    expect(ids('problems')).toEqual(['upload:bad', 'upload:warn'])
  })

  it("lists an upload's file, compression and optimization facts", () => {
    const done = job({
      status: 'completed',
      active: false,
      finalSize: 5 * 1024 * 1024,
      size: 20 * 1024 * 1024,
      optimizationStatus: 'success',
      optimizationResult: { ...optimizationResult, ocrFailedPages: 1 },
      completedAt: '2026-09-29T12:05:00.000Z'
    })
    const rows = Object.fromEntries(
      notificationDetails(uploadJobToNotification(done), done).map((r) => [r.label, r.value])
    )
    expect(rows).toMatchObject({
      Status: 'Completed',
      File: 'AG Report 2025.pdf',
      'Uploaded size': '20.0 MB',
      'Stored size': '5.0 MB',
      Compression: 'Balanced (150 DPI)',
      Pages: '10 (8 native, 2 scanned)',
      'OCR failures': '1 page(s)',
      'Space saved': '15.0 MB'
    })
    expect(rows.Finished).toBeTruthy()
    expect(rows['Error code']).toBeUndefined()
  })

  it('falls back to generic facts for local entries', () => {
    const n = { ...uploadJobToNotification(job()), source: 'local' as const, subject: 'Images' }
    const labels = notificationDetails(n).map((r) => r.label)
    expect(labels).toEqual(['Status', 'About', 'Details', 'Started'])
  })
})
