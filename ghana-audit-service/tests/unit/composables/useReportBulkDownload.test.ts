import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, readonly, ref, type Ref } from 'vue'
import type { AuditReport } from '~/types'
import { BULK_REPORT_MAX_BYTES, BULK_REPORT_MAX_FILES } from '~/utils/bulkReportDownload'
import { useReportBulkDownload } from '../../../composables/useReportBulkDownload'

// Nuxt auto-imports. useState is one shared ref per key, as in the app.
const state = new Map<string, Ref<unknown>>()
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('useState', (key: string, init: () => unknown) => {
  if (!state.has(key)) state.set(key, ref(init()))
  return state.get(key)
})

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

function report(id: number, fileSize = '2.0 MB'): AuditReport {
  return {
    id: String(id),
    title: `Report ${id}`,
    slug: `report-${id}`,
    category: 'financial',
    publishedAt: '2024-01-01',
    year: 2024,
    fileUrl: `/api/downloads/reports/${id}`,
    fileSize
  }
}

const reports = (count: number, from = 1) =>
  Array.from({ length: count }, (_, i) => report(from + i))

function summary(count: number, unavailable: number[] = []) {
  return {
    count,
    totalBytes: count * 2_000_000,
    zipBytes: count * 2_000_100,
    fileName: 'auditor-general-reports-2026-11-23.zip',
    unavailable
  }
}

function setup() {
  const save = vi.fn()
  return { save, bulk: useReportBulkDownload({ save }) }
}

describe('useReportBulkDownload', () => {
  beforeEach(() => {
    state.clear()
    mockFetch.mockReset()
  })

  describe('selection', () => {
    it('adds and removes a report', () => {
      const { bulk } = setup()

      expect(bulk.toggle(report(4))).toBe(true)
      expect(bulk.isSelected('4')).toBe(true)
      expect(bulk.count.value).toBe(1)

      bulk.toggle(report(4))
      expect(bulk.isSelected('4')).toBe(false)
      expect(bulk.count.value).toBe(0)
    })

    it('estimates the total from the sizes in the listing', () => {
      const { bulk } = setup()
      bulk.toggle(report(1, '4.0 MB'))
      bulk.toggle(report(2, '512.0 KB'))

      expect(bulk.estimatedBytes.value).toBe(4 * 1024 ** 2 + 512 * 1024)
      expect(bulk.hasUnknownSizes.value).toBe(false)

      bulk.toggle(report(3, 'N/A'))
      expect(bulk.estimatedBytes.value).toBe(4 * 1024 ** 2 + 512 * 1024)
      expect(bulk.hasUnknownSizes.value).toBe(true)
    })

    it('refuses one report too many', () => {
      const { bulk } = setup()
      bulk.selectAll(reports(BULK_REPORT_MAX_FILES))

      expect(bulk.isFull.value).toBe(true)
      expect(bulk.toggle(report(999))).toBe(false)
      expect(bulk.count.value).toBe(BULK_REPORT_MAX_FILES)

      // A selected report can still be removed while full.
      expect(bulk.toggle(report(1))).toBe(true)
      expect(bulk.isFull.value).toBe(false)
    })

    it('selects a whole page, skipping reports already selected', () => {
      const { bulk } = setup()
      bulk.toggle(report(2))

      expect(bulk.selectAll(reports(12))).toBe(0)

      expect(bulk.count.value).toBe(12)
      expect(bulk.selected.value.filter((r) => r.id === '2')).toHaveLength(1)
    })

    it('fills up to the limit and reports how many did not fit', () => {
      const { bulk } = setup()
      bulk.selectAll(reports(20))

      const leftOut = bulk.selectAll(reports(12, 100))

      expect(leftOut).toBe(12 - (BULK_REPORT_MAX_FILES - 20))
      expect(bulk.count.value).toBe(BULK_REPORT_MAX_FILES)
    })

    it('deselects one page and keeps reports chosen on other pages', () => {
      const { bulk } = setup()
      bulk.selectAll(reports(3))
      bulk.selectAll(reports(3, 50))

      bulk.deselectAll(reports(3))

      expect(bulk.selected.value.map((r) => r.id)).toEqual(['50', '51', '52'])
    })

    it('is shared across the page, so it survives leaving and coming back', () => {
      setup().bulk.toggle(report(8))

      expect(setup().bulk.isSelected('8')).toBe(true)
    })
  })

  describe('download', () => {
    it('asks the server first, then hands the archive URL to the browser', async () => {
      mockFetch.mockResolvedValue(summary(3))
      const { bulk, save } = setup()
      bulk.selectAll(reports(3))

      await bulk.download()

      // Asked once: a refusal must reach the visitor, not be retried silently.
      expect(mockFetch).toHaveBeenCalledWith('/api/downloads/reports/bulk?ids=1,2,3&check=1', {
        retry: 0
      })
      expect(save).toHaveBeenCalledWith('/api/downloads/reports/bulk?ids=1,2,3')
      expect(bulk.started.value).toEqual({
        ids: [1, 2, 3],
        count: 3,
        bytes: 3 * 2_000_100,
        unavailable: 0
      })
      expect(bulk.error.value).toBeNull()
    })

    it('clears the selection once the download has started', async () => {
      mockFetch.mockResolvedValue(summary(2))
      const { bulk } = setup()
      bulk.selectAll(reports(2))

      await bulk.download()

      expect(bulk.count.value).toBe(0)
    })

    it('downloads only what is available, so missing files cost no allowance', async () => {
      mockFetch.mockResolvedValue(summary(2, [2]))
      const { bulk, save } = setup()
      bulk.selectAll(reports(3))

      await bulk.download()

      expect(save).toHaveBeenCalledWith('/api/downloads/reports/bulk?ids=1,3')
      expect(bulk.started.value).toMatchObject({ ids: [1, 3], count: 2, unavailable: 1 })
    })

    it('shows it is busy while the server is asked, and ignores a second click', async () => {
      let answer!: (value: unknown) => void
      mockFetch.mockReturnValue(new Promise((resolve) => (answer = resolve)))
      const { bulk, save } = setup()
      bulk.selectAll(reports(2))

      const first = bulk.download()
      expect(bulk.checking.value).toBe(true)
      await bulk.download()

      answer(summary(2))
      await first

      expect(bulk.checking.value).toBe(false)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(save).toHaveBeenCalledTimes(1)
    })

    it('does nothing with an empty selection', async () => {
      const { bulk, save } = setup()

      await bulk.download()

      expect(mockFetch).not.toHaveBeenCalled()
      expect(save).not.toHaveBeenCalled()
    })

    it('can repeat the download that was just started', async () => {
      mockFetch.mockResolvedValue(summary(2))
      const { bulk, save } = setup()
      bulk.selectAll(reports(2))
      await bulk.download()

      await bulk.downloadAgain()

      expect(save).toHaveBeenCalledTimes(2)
      expect(save).toHaveBeenLastCalledWith('/api/downloads/reports/bulk?ids=1,2')
      expect(bulk.started.value).toMatchObject({ ids: [1, 2] })
    })

    it('keeps the earlier download on offer when repeating it is refused', async () => {
      mockFetch.mockResolvedValueOnce(summary(2))
      const { bulk } = setup()
      bulk.selectAll(reports(2))
      await bulk.download()

      mockFetch.mockRejectedValueOnce({ statusCode: 429, data: { retryAfter: 40 } })
      await bulk.downloadAgain()

      expect(bulk.error.value).toMatchObject({ kind: 'rate-limited', retryAfterSeconds: 40 })
      expect(bulk.started.value).toMatchObject({ ids: [1, 2] })
    })
  })

  describe('when the download cannot start', () => {
    async function failWith(thrown: unknown) {
      mockFetch.mockRejectedValue(thrown)
      const context = setup()
      context.bulk.selectAll(reports(10))
      await context.bulk.download()
      return context
    }

    it('keeps the selection and starts nothing', async () => {
      const { bulk, save } = await failWith({ statusCode: 429, data: { retryAfter: 600 } })

      expect(save).not.toHaveBeenCalled()
      expect(bulk.count.value).toBe(10)
      expect(bulk.started.value).toBeNull()
      expect(bulk.checking.value).toBe(false)
    })

    it('explains a rate limit, including how many reports would still fit', async () => {
      const { bulk } = await failWith({
        statusCode: 429,
        data: { retryAfter: 1800, remaining: 4 }
      })

      expect(bulk.error.value).toEqual({
        kind: 'rate-limited',
        retryAfterSeconds: 1800,
        remaining: 4
      })
    })

    it('falls back to the Retry-After header', async () => {
      const { bulk } = await failWith({
        response: { status: 429, headers: new Headers({ 'Retry-After': '55' }) }
      })

      expect(bulk.error.value).toEqual({
        kind: 'rate-limited',
        retryAfterSeconds: 55,
        remaining: 0
      })
    })

    it('explains a selection that is too large', async () => {
      const { bulk } = await failWith({
        statusCode: 413,
        data: {
          data: { code: 'BULK_TOO_LARGE', totalBytes: 1_500_000_000, maxBytes: 1_073_741_824 }
        }
      })

      expect(bulk.error.value).toEqual({
        kind: 'too-large',
        totalBytes: 1_500_000_000,
        maxBytes: BULK_REPORT_MAX_BYTES
      })
    })

    it('reports files that are all unavailable', async () => {
      const { bulk } = await failWith({ statusCode: 404 })

      expect(bulk.error.value).toEqual({ kind: 'unavailable' })
    })

    it.each([
      ['a server error', { statusCode: 500 }],
      ['a network failure', new TypeError('Failed to fetch')],
      ['nothing useful', undefined]
    ])('treats %s as a generic failure', async (_label, thrown) => {
      const { bulk } = await failWith(thrown)

      expect(bulk.error.value).toEqual({ kind: 'failed' })
    })

    it('drops the message as soon as the selection changes', async () => {
      const { bulk } = await failWith({ statusCode: 413 })

      bulk.toggle(report(1))

      expect(bulk.error.value).toBeNull()
    })
  })

  it('dismiss clears the "download started" message', async () => {
    mockFetch.mockResolvedValue(summary(1))
    const { bulk } = setup()
    bulk.toggle(report(1))
    await bulk.download()

    bulk.dismiss()

    expect(bulk.started.value).toBeNull()
  })
})
