import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Readable } from 'node:stream'
import { resolveDownloadSource } from '~/server/utils/downloadSource'
import {
  archiveEntryName,
  bulkArchiveFileName,
  resolveBulkReportFiles
} from '~/server/utils/bulkReportArchive'
import { zipArchiveSize } from '~/server/utils/zipStream'

vi.mock('~/server/utils/downloadSource', () => ({
  resolveDownloadSource: vi.fn()
}))

function source(size: number) {
  return { size, open: async () => Readable.from([Buffer.alloc(size)], { objectMode: false }) }
}

describe('archiveEntryName', () => {
  it('names the file after the report slug, like the single-file download', () => {
    expect(
      archiveEntryName('public-accounts-of-ghana-2023', '/pdf/reports/a1b2c3.pdf', new Set())
    ).toBe('public-accounts-of-ghana-2023.pdf')
  })

  it('keeps the stored file extension and defaults to .pdf', () => {
    expect(archiveEntryName('annex', '/pdf/reports/annex.XLSX?v=2', new Set())).toBe('annex.xlsx')
    expect(archiveEntryName('no-extension', '/pdf/reports/blob', new Set())).toBe(
      'no-extension.pdf'
    )
    expect(archiveEntryName('no-file', null, new Set())).toBe('no-file.pdf')
  })

  it('numbers names that would collide, ignoring case', () => {
    const taken = new Set<string>()

    expect(archiveEntryName('Report', '/x.pdf', taken)).toBe('Report.pdf')
    expect(archiveEntryName('report', '/y.pdf', taken)).toBe('report-2.pdf')
    expect(archiveEntryName('REPORT', '/z.pdf', taken)).toBe('REPORT-3.pdf')
  })

  it.each([
    ['../../etc/passwd'],
    ['reports/2023/annual'],
    ['c:\\windows\\system32'],
    ['...'],
    [''],
    ['a\u0000b']
  ])('turns the hostile slug %j into one safe path segment', (slug) => {
    const name = archiveEntryName(slug, '/pdf/reports/x.pdf', new Set())

    expect(name).toMatch(/^[\w][\w.-]*\.pdf$/)
    expect(() => zipArchiveSize([{ name, size: 1 }])).not.toThrow()
  })
})

describe('resolveBulkReportFiles', () => {
  beforeEach(() => {
    vi.mocked(resolveDownloadSource).mockReset()
  })

  it('keeps reports whose file exists, in order, and leaves the rest out', async () => {
    vi.mocked(resolveDownloadSource).mockImplementation(async (fileUrl) =>
      fileUrl === '/pdf/reports/missing.pdf' ? null : source(100)
    )

    const files = await resolveBulkReportFiles([
      { id: 3, slug: 'third', fileUrl: '/pdf/reports/c.pdf', updatedAt: '2024-05-01T08:00:00Z' },
      { id: 2, slug: 'second', fileUrl: '/pdf/reports/missing.pdf', updatedAt: null },
      { id: 1, slug: 'first', fileUrl: '/pdf/reports/a.pdf', updatedAt: new Date('2023-01-02') }
    ])

    expect(files.map((f) => [f.id, f.name, f.size])).toEqual([
      [3, 'third.pdf', 100],
      [1, 'first.pdf', 100]
    ])
    expect(files[0].modifiedAt).toEqual(new Date('2024-05-01T08:00:00Z'))
  })

  it('ignores an unreadable modification date instead of failing', async () => {
    vi.mocked(resolveDownloadSource).mockResolvedValue(source(1))

    const [file] = await resolveBulkReportFiles([
      { id: 1, slug: 'x', fileUrl: '/pdf/reports/x.pdf', updatedAt: 'not a date' }
    ])

    expect(file.modifiedAt).toBeUndefined()
  })

  it('passes a storage failure on', async () => {
    vi.mocked(resolveDownloadSource).mockRejectedValue(new Error('ServerBusy'))

    await expect(
      resolveBulkReportFiles([{ id: 1, slug: 'x', fileUrl: '/pdf/reports/x.pdf', updatedAt: null }])
    ).rejects.toThrow('ServerBusy')
  })
})

describe('bulkArchiveFileName', () => {
  it('is dated and safe to put in a Content-Disposition header', () => {
    const name = bulkArchiveFileName(new Date('2026-11-23T23:59:59Z'))

    expect(name).toBe('auditor-general-reports-2026-11-23.zip')
    expect(name).toMatch(/^[a-z0-9.-]+$/)
  })
})
