import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'
import { createApp, createRouter, toNodeListener } from 'h3'
import { getDatabase } from '~/server/database'
import { resolveDownloadSource } from '~/server/utils/downloadSource'
import { zipArchiveSize } from '~/server/utils/zipStream'
import {
  BULK_REPORT_DOWNLOAD_PATH,
  BULK_REPORT_MAX_BYTES,
  BULK_REPORT_MAX_FILES
} from '~/utils/bulkReportDownload'
import { readZip } from '../../../../helpers/zip'

// The real handler behind a real HTTP server: headers, streaming and aborted
// connections behave as they do in production. Only the database and the file
// store are replaced.
vi.mock('~/server/database', async () => ({
  getDatabase: vi.fn(),
  schema: await vi.importActual('~/server/database/schema')
}))
vi.mock('~/server/utils/downloadSource', () => ({ resolveDownloadSource: vi.fn() }))
vi.mock('~/server/utils/analytics/geoip', () => ({
  getGeoIp: vi.fn(() => ({ country: null, asn: null }))
}))
vi.mock('~/server/utils/logger', () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }))

const { default: bulkDownload } = await import('~/server/api/downloads/reports/bulk.get')
const { logError } = await import('~/server/utils/logger')

interface Row {
  id: number
  slug: string
  fileUrl: string
  updatedAt: Date
}

const FILES: Record<string, Buffer> = {
  '/pdf/reports/a.pdf': Buffer.from('%PDF-1.7 public accounts 2023 '.repeat(4000)),
  '/pdf/reports/b.pdf': Buffer.from('%PDF-1.7 performance audit'),
  '/pdf/reports/c.pdf': Buffer.from('%PDF-1.7 special audit '.repeat(9000))
}
const ROWS: Row[] = [
  { id: 12, slug: 'public-accounts-2023', fileUrl: '/pdf/reports/a.pdf', updatedAt: new Date() },
  { id: 7, slug: 'performance-audit', fileUrl: '/pdf/reports/b.pdf', updatedAt: new Date() },
  { id: 3, slug: 'special-audit', fileUrl: '/pdf/reports/c.pdf', updatedAt: new Date() }
]

let rows: Row[] = []
let downloadRows: Array<Record<string, unknown>> = []
let insertDone: Promise<void>
let resolveInsert: () => void

function fakeDatabase() {
  return {
    select: () => ({
      from: () => ({ where: () => ({ orderBy: async () => rows }) })
    }),
    insert: () => ({
      values: async (values: Array<Record<string, unknown>>) => {
        downloadRows.push(...values)
        resolveInsert()
      }
    })
  }
}

let server: http.Server
let origin = ''

beforeAll(async () => {
  const router = createRouter().get(BULK_REPORT_DOWNLOAD_PATH, bulkDownload)
  server = http.createServer(toNodeListener(createApp().use(router)))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
})

beforeEach(() => {
  rows = ROWS
  downloadRows = []
  insertDone = new Promise((resolve) => (resolveInsert = resolve))
  vi.mocked(getDatabase).mockReturnValue(fakeDatabase() as never)
  vi.mocked(resolveDownloadSource).mockImplementation(async (fileUrl) => {
    const content = FILES[fileUrl ?? '']
    return content
      ? { size: content.length, open: async () => Readable.from([content], { objectMode: false }) }
      : null
  })
})

interface Reply {
  status: number
  headers: http.IncomingHttpHeaders
  body: Buffer
  /** The connection was cut before the body finished. */
  aborted: boolean
}

function get(query: string): Promise<Reply> {
  return new Promise((resolve, reject) => {
    http
      .get(`${origin}${BULK_REPORT_DOWNLOAD_PATH}?${query}`, (res) => {
        const chunks: Buffer[] = []
        const done = (aborted: boolean) =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
            aborted
          })
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => done(false))
        res.on('error', () => done(true))
      })
      .on('error', reject)
  })
}

const json = (reply: Reply) => JSON.parse(reply.body.toString('utf8'))

describe('GET /api/downloads/reports/bulk', () => {
  it('streams the selected reports as one ZIP the browser can save', async () => {
    const reply = await get('ids=12,7,3')

    expect(reply.status).toBe(200)
    expect(reply.headers['content-type']).toBe('application/zip')
    expect(reply.headers['content-disposition']).toMatch(
      /^attachment; filename="auditor-general-reports-\d{4}-\d{2}-\d{2}\.zip"$/
    )
    expect(reply.headers['cache-control']).toContain('no-store')
    // An exact Content-Length is what gives the browser a progress bar and
    // lets it tell a complete archive from a cut-off one.
    expect(Number(reply.headers['content-length'])).toBe(reply.body.length)

    const entries = readZip(reply.body)
    expect(entries.map((e) => e.name)).toEqual([
      'public-accounts-2023.pdf',
      'performance-audit.pdf',
      'special-audit.pdf'
    ])
    entries.forEach((entry, i) => {
      expect(entry.data.equals(FILES[ROWS[i].fileUrl])).toBe(true)
    })
  })

  it('records one download per report delivered', async () => {
    await get('ids=12,7,3')
    await insertDone

    expect(downloadRows.map((r) => [r.kind, r.targetId, r.slug, r.bytesOut])).toEqual([
      ['report', 12, 'public-accounts-2023', FILES['/pdf/reports/a.pdf'].length],
      ['report', 7, 'performance-audit', FILES['/pdf/reports/b.pdf'].length],
      ['report', 3, 'special-audit', FILES['/pdf/reports/c.pdf'].length]
    ])
    expect(downloadRows.every((r) => r.isPartial === false)).toBe(true)
    expect(downloadRows.every((r) => typeof r.ipHash === 'string' && r.ipHash)).toBe(true)
  })

  it('answers a check with what the download would contain, sending no archive', async () => {
    const reply = await get('ids=12,7,3&check=1')

    const totalBytes = Object.values(FILES).reduce((sum, file) => sum + file.length, 0)
    expect(reply.status).toBe(200)
    expect(reply.headers['content-type']).toContain('application/json')
    expect(reply.headers['cache-control']).toContain('no-store')
    expect(json(reply)).toEqual({
      count: 3,
      totalBytes,
      zipBytes: zipArchiveSize(
        ROWS.map((row) => ({ name: `${row.slug}.pdf`, size: FILES[row.fileUrl].length }))
      ),
      fileName: expect.stringMatching(/^auditor-general-reports-.*\.zip$/),
      unavailable: []
    })
    expect(downloadRows).toEqual([])
  })

  it('promises in the check exactly the size the download then has', async () => {
    const { zipBytes } = json(await get('ids=12,7,3&check=1'))

    const download = await get('ids=12,7,3')

    expect(download.body.length).toBe(zipBytes)
  })

  it('leaves out reports that are unpublished or whose file is missing, and says which', async () => {
    // 99 is not returned by the published-reports query; 7's file is gone.
    vi.mocked(resolveDownloadSource).mockImplementation(async (fileUrl) => {
      const content = fileUrl === '/pdf/reports/b.pdf' ? undefined : FILES[fileUrl ?? '']
      return content
        ? {
            size: content.length,
            open: async () => Readable.from([content], { objectMode: false })
          }
        : null
    })

    const check = json(await get('ids=12,7,3,99&check=1'))
    const download = await get('ids=12,7,3,99')

    expect(check).toMatchObject({ count: 2, unavailable: [7, 99] })
    expect(readZip(download.body).map((e) => e.name)).toEqual([
      'public-accounts-2023.pdf',
      'special-audit.pdf'
    ])
  })

  it.each([
    ['no ids', ''],
    ['a slug', 'ids=annual-report'],
    ['one bad id among good ones', 'ids=12,x,3'],
    [
      'too many reports',
      `ids=${Array.from({ length: BULK_REPORT_MAX_FILES + 1 }, (_, i) => i + 1)}`
    ]
  ])('rejects %s with 400 before touching the database', async (_label, query) => {
    const reply = await get(query)

    expect(reply.status).toBe(400)
    expect(json(reply).data).toEqual({
      code: 'BULK_INVALID_SELECTION',
      maxFiles: BULK_REPORT_MAX_FILES
    })
    expect(getDatabase).not.toHaveBeenCalled()
  })

  it('answers 404 when none of the selected reports can be downloaded', async () => {
    rows = []

    const reply = await get('ids=404,405')

    expect(reply.status).toBe(404)
    expect(json(reply).data).toEqual({ code: 'BULK_NONE_AVAILABLE' })
  })

  it('refuses a selection larger than one ZIP may carry, without opening any file', async () => {
    const open = vi.fn()
    vi.mocked(resolveDownloadSource).mockResolvedValue({
      size: Math.ceil(BULK_REPORT_MAX_BYTES / 3) + 1,
      open
    })

    const reply = await get('ids=12,7,3&check=1')

    expect(reply.status).toBe(413)
    expect(json(reply).data).toEqual({
      code: 'BULK_TOO_LARGE',
      totalBytes: 3 * (Math.ceil(BULK_REPORT_MAX_BYTES / 3) + 1),
      maxBytes: BULK_REPORT_MAX_BYTES
    })
    expect(open).not.toHaveBeenCalled()
  })

  it('answers a generic 500 when storage cannot be reached', async () => {
    vi.mocked(resolveDownloadSource).mockRejectedValue(
      new Error('ServerBusy: account gasstore01 key=abc')
    )

    const reply = await get('ids=12&check=1')

    expect(reply.status).toBe(500)
    expect(reply.body.toString()).not.toContain('gasstore01')
  })

  it('cuts the connection if a file fails part-way, so no truncated archive is saved', async () => {
    vi.mocked(resolveDownloadSource).mockImplementation(async (fileUrl) => {
      const content = FILES[fileUrl ?? '']
      return {
        size: content.length,
        open: async () =>
          fileUrl === '/pdf/reports/c.pdf'
            ? new Readable({
                read() {
                  this.destroy(new Error('storage connection reset'))
                }
              })
            : Readable.from([content], { objectMode: false })
      }
    })

    const reply = await get('ids=12,7,3')
    await insertDone

    expect(reply.aborted).toBe(true)
    expect(reply.body.length).toBeLessThan(Number(reply.headers['content-length']))
    expect(logError).toHaveBeenCalledWith(
      'downloads:reports:bulk',
      expect.objectContaining({ message: 'storage connection reset' })
    )
    // Only the two reports that went out in full count as downloads.
    expect(downloadRows.map((r) => r.targetId)).toEqual([12, 7])
  })

  it('stops reading from storage when the visitor cancels the download', async () => {
    let source!: Readable
    const closed = new Promise<void>((resolve) => {
      vi.mocked(resolveDownloadSource).mockResolvedValue({
        size: 512 * 1024 * 1024,
        open: async () => {
          // Endless data: only cancelling can end this download.
          source = new Readable({
            read() {
              this.push(Buffer.alloc(64 * 1024))
            }
          })
          source.once('close', resolve)
          return source
        }
      })
    })
    rows = [ROWS[0]]

    await new Promise<void>((resolve) => {
      const request = http.get(`${origin}${BULK_REPORT_DOWNLOAD_PATH}?ids=12`, (res) => {
        res.once('data', () => {
          request.destroy()
          resolve()
        })
      })
      request.on('error', () => {})
    })
    await closed

    expect(source.destroyed).toBe(true)
    // A cancelled download is the visitor's choice, not a server error.
    expect(logError).not.toHaveBeenCalled()
  })
})
