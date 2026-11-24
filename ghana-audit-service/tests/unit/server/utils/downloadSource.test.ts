import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolvePublicAsset } from '~/server/utils/publicFiles'
import {
  getBlobSize,
  __resetBlobForTests,
  __setContainerClientForTests
} from '~/server/utils/blobStorage'
import { resolveDownloadSource } from '~/server/utils/downloadSource'

vi.mock('~/server/utils/publicFiles', () => ({
  resolvePublicAsset: vi.fn()
}))

function notFound(): Error {
  return Object.assign(new Error('BlobNotFound'), { statusCode: 404 })
}

/** Fake ContainerClient holding `blobs` (key → content). */
function fakeContainer(blobs: Record<string, Buffer>, failWith?: Error) {
  const calls = { properties: 0, downloads: 0 }
  const client = {
    getBlobClient(key: string) {
      return {
        async getProperties() {
          calls.properties++
          if (failWith) throw failWith
          if (!(key in blobs)) throw notFound()
          return { contentLength: blobs[key].length }
        },
        async download() {
          calls.downloads++
          if (!(key in blobs)) throw notFound()
          return {
            readableStreamBody: Readable.from([blobs[key]], { objectMode: false }),
            contentLength: blobs[key].length,
            contentType: 'application/pdf'
          }
        }
      }
    }
  }
  return { client, calls }
}

async function read(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gas-download-source-'))
  vi.mocked(resolvePublicAsset).mockReturnValue(null)
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  __resetBlobForTests()
})

describe('getBlobSize', () => {
  it('returns the size from blob metadata', async () => {
    const fake = fakeContainer({ 'pdf/reports/x.pdf': Buffer.alloc(4321) })
    __setContainerClientForTests(fake.client as never)

    expect(await getBlobSize('pdf/reports/x.pdf')).toBe(4321)
  })

  it('returns null for a missing blob', async () => {
    __setContainerClientForTests(fakeContainer({}).client as never)

    expect(await getBlobSize('pdf/reports/missing.pdf')).toBeNull()
  })

  it('returns null when Blob storage is unconfigured', async () => {
    __setContainerClientForTests(null)

    expect(await getBlobSize('pdf/reports/x.pdf')).toBeNull()
  })

  it('lets a storage outage surface instead of reporting the file missing', async () => {
    const outage = Object.assign(new Error('ServerBusy'), { statusCode: 503 })
    __setContainerClientForTests(fakeContainer({}, outage).client as never)

    await expect(getBlobSize('pdf/reports/x.pdf')).rejects.toThrow('ServerBusy')
  })
})

describe('resolveDownloadSource', () => {
  it('reports a blob size without downloading it, then opens it on demand', async () => {
    const content = Buffer.from('%PDF-1.7 from blob')
    const fake = fakeContainer({ 'pdf/reports/x.pdf': content })
    __setContainerClientForTests(fake.client as never)

    const source = await resolveDownloadSource('/pdf/reports/x.pdf')

    expect(source?.size).toBe(content.length)
    expect(fake.calls.downloads).toBe(0)
    expect((await read(await source!.open())).equals(content)).toBe(true)
    expect(fake.calls.downloads).toBe(1)
  })

  it('prefers Blob over disk when the file is in both, like the single-file endpoint', async () => {
    const onDisk = join(dir, 'both.pdf')
    writeFileSync(onDisk, 'disk copy, longer than the blob')
    vi.mocked(resolvePublicAsset).mockReturnValue(onDisk)
    __setContainerClientForTests(
      fakeContainer({ 'pdf/reports/both.pdf': Buffer.from('blob copy') }).client as never
    )

    const source = await resolveDownloadSource('/pdf/reports/both.pdf')

    expect((await read(await source!.open())).toString()).toBe('blob copy')
  })

  it('falls back to the on-disk file when the blob is missing', async () => {
    const onDisk = join(dir, 'legacy.pdf')
    writeFileSync(onDisk, '%PDF legacy file')
    vi.mocked(resolvePublicAsset).mockReturnValue(onDisk)
    __setContainerClientForTests(fakeContainer({}).client as never)

    const source = await resolveDownloadSource('/pdf/reports/legacy.pdf')

    expect(source?.size).toBe(16)
    expect((await read(await source!.open())).toString()).toBe('%PDF legacy file')
  })

  it('uses the on-disk file when Blob storage is unconfigured', async () => {
    const onDisk = join(dir, 'local.pdf')
    writeFileSync(onDisk, 'local dev file')
    vi.mocked(resolvePublicAsset).mockReturnValue(onDisk)
    __setContainerClientForTests(null)

    const source = await resolveDownloadSource('/pdf/reports/local.pdf')

    expect(source?.size).toBe(14)
  })

  it('returns null when the file is in neither place', async () => {
    __setContainerClientForTests(fakeContainer({}).client as never)

    expect(await resolveDownloadSource('/pdf/reports/gone.pdf')).toBeNull()
  })

  it('returns null for a directory, a missing URL or a traversal attempt', async () => {
    __setContainerClientForTests(null)
    mkdirSync(join(dir, 'folder'))
    vi.mocked(resolvePublicAsset).mockReturnValue(join(dir, 'folder'))
    expect(await resolveDownloadSource('/pdf/reports/folder')).toBeNull()

    vi.mocked(resolvePublicAsset).mockReturnValue(null)
    expect(await resolveDownloadSource(null)).toBeNull()
    expect(await resolveDownloadSource('/pdf/reports/../../etc/passwd')).toBeNull()
  })

  it('fails to open, rather than yield nothing, if the blob vanished after it was sized', async () => {
    const blobs: Record<string, Buffer> = { 'pdf/reports/x.pdf': Buffer.from('here') }
    __setContainerClientForTests(fakeContainer(blobs).client as never)
    const source = await resolveDownloadSource('/pdf/reports/x.pdf')

    delete blobs['pdf/reports/x.pdf']

    await expect(source!.open()).rejects.toThrow(/disappeared/)
  })

  it('lets a storage outage surface instead of treating the file as missing', async () => {
    const outage = Object.assign(new Error('ServerBusy'), { statusCode: 503 })
    __setContainerClientForTests(fakeContainer({}, outage).client as never)

    await expect(resolveDownloadSource('/pdf/reports/x.pdf')).rejects.toThrow('ServerBusy')
  })
})
