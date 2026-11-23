import { describe, it, expect } from 'vitest'
import {
  BULK_REPORT_DOWNLOAD_PATH,
  BULK_REPORT_MAX_BYTES,
  BULK_REPORT_MAX_FILES,
  bulkReportDownloadUrl,
  fileSizeLabelToBytes,
  isBulkCheck,
  parseBulkReportIds
} from '~/utils/bulkReportDownload'
import { RATE_LIMITS } from '~/server/utils/rateLimiter'

describe('bulk report download limits', () => {
  it('lets a full selection fit inside the hourly download allowance', () => {
    // Each report in a ZIP takes one unit of the hourly limit; a selection
    // larger than the limit could never be downloaded.
    expect(BULK_REPORT_MAX_FILES).toBeLessThanOrEqual(RATE_LIMITS.downloadHourly.limit)
  })

  it('keeps one archive inside the plain (non-Zip64) ZIP format', () => {
    expect(BULK_REPORT_MAX_BYTES).toBeLessThan(4 * 1024 ** 3)
  })
})

describe('parseBulkReportIds', () => {
  it('reads a comma-separated list', () => {
    expect(parseBulkReportIds('3,7,12')).toEqual([3, 7, 12])
  })

  it('reads repeated parameters', () => {
    expect(parseBulkReportIds(['3', '7,12'])).toEqual([3, 7, 12])
  })

  it('drops duplicates, keeping the first position', () => {
    expect(parseBulkReportIds('7,3,7,3')).toEqual([7, 3])
  })

  it('accepts exactly the maximum number of reports', () => {
    const ids = Array.from({ length: BULK_REPORT_MAX_FILES }, (_, i) => i + 1)

    expect(parseBulkReportIds(ids.join(','))).toEqual(ids)
  })

  it('rejects more than the maximum', () => {
    const ids = Array.from({ length: BULK_REPORT_MAX_FILES + 1 }, (_, i) => i + 1)

    expect(parseBulkReportIds(ids.join(','))).toBeNull()
  })

  it.each([
    ['nothing', undefined],
    ['an empty string', ''],
    ['a slug', 'annual-report'],
    ['one bad token among good ones', '3,abc,7'],
    ['a trailing comma', '3,7,'],
    ['zero', '0'],
    ['a negative number', '-4'],
    ['a decimal', '3.5'],
    ['an id beyond MySQL INT', '2147483648'],
    ['SQL in the value', '1 OR 1=1'],
    ['a non-string value', 42],
    ['an object', { ids: '1' }]
  ])('rejects %s', (_label, raw) => {
    expect(parseBulkReportIds(raw)).toBeNull()
  })
})

describe('isBulkCheck', () => {
  it('is true only for an explicit check flag', () => {
    expect(isBulkCheck('1')).toBe(true)
    expect(isBulkCheck('true')).toBe(true)
    expect(isBulkCheck('0')).toBe(false)
    expect(isBulkCheck('')).toBe(false)
    expect(isBulkCheck(undefined)).toBe(false)
    expect(isBulkCheck(['1'])).toBe(false)
  })
})

describe('bulkReportDownloadUrl', () => {
  it('builds the download URL', () => {
    expect(bulkReportDownloadUrl([3, 7, 12])).toBe(`${BULK_REPORT_DOWNLOAD_PATH}?ids=3,7,12`)
  })

  it('builds the check URL', () => {
    expect(bulkReportDownloadUrl(['3', '7'], { check: true })).toBe(
      `${BULK_REPORT_DOWNLOAD_PATH}?ids=3,7&check=1`
    )
  })

  it('round-trips through the parser', () => {
    const url = new URL(bulkReportDownloadUrl([9, 4, 21], { check: true }), 'https://audit.gov.gh')

    expect(parseBulkReportIds(url.searchParams.get('ids'))).toEqual([9, 4, 21])
    expect(isBulkCheck(url.searchParams.get('check'))).toBe(true)
  })
})

describe('fileSizeLabelToBytes', () => {
  it('converts the labels the public API returns', () => {
    expect(fileSizeLabelToBytes('4.2 MB')).toBe(Math.round(4.2 * 1024 ** 2))
    expect(fileSizeLabelToBytes('512.0 KB')).toBe(512 * 1024)
    expect(fileSizeLabelToBytes('1.5 GB')).toBe(1.5 * 1024 ** 3)
    expect(fileSizeLabelToBytes('900 B')).toBe(900)
    expect(fileSizeLabelToBytes('12mb')).toBe(12 * 1024 ** 2)
  })

  it('returns null when there is no usable size', () => {
    expect(fileSizeLabelToBytes('N/A')).toBeNull()
    expect(fileSizeLabelToBytes('')).toBeNull()
    expect(fileSizeLabelToBytes(null)).toBeNull()
    expect(fileSizeLabelToBytes(undefined)).toBeNull()
    expect(fileSizeLabelToBytes('0 MB')).toBeNull()
    expect(fileSizeLabelToBytes('big')).toBeNull()
  })
})
