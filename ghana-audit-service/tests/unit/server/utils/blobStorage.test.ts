import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'
import {
  blobKeyFromFileUrl,
  isBlobStorageConfigured,
  getContainerClient,
  uploadBlob,
  downloadBlob,
  blobExists,
  tryBlobSource,
  __resetBlobForTests,
  __setContainerClientForTests
} from '~/server/utils/blobStorage'

const ORIGINAL_ENV = { ...process.env }

function setBlobEnv(conn?: string, container?: string) {
  if (conn === undefined) delete process.env.AZURE_STORAGE_CONNECTION_STRING
  else process.env.AZURE_STORAGE_CONNECTION_STRING = conn
  if (container === undefined) delete process.env.AZURE_BLOB_CONTAINER
  else process.env.AZURE_BLOB_CONTAINER = container
  __resetBlobForTests()
}

// A well-formed connection string. fromConnectionString() only parses it — no
// network call — so this is safe to use offline.
const FAKE_CONN =
  'DefaultEndpointsProtocol=https;AccountName=devstoreaccount1;' +
  'AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;' +
  'EndpointSuffix=core.windows.net'

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  __resetBlobForTests()
})

describe('blobKeyFromFileUrl', () => {
  it('strips the leading slash from a report path', () => {
    expect(blobKeyFromFileUrl('/pdf/reports/2024-report.pdf')).toBe('pdf/reports/2024-report.pdf')
  })

  it('strips query strings and hashes', () => {
    expect(blobKeyFromFileUrl('/pdf/reports/x.pdf?v=2#page=3')).toBe('pdf/reports/x.pdf')
  })

  it('collapses multiple leading slashes', () => {
    expect(blobKeyFromFileUrl('///pdf/reports/x.pdf')).toBe('pdf/reports/x.pdf')
  })

  it('rejects path traversal attempts', () => {
    expect(blobKeyFromFileUrl('/pdf/reports/../../etc/passwd')).toBeNull()
  })

  it('returns null for empty or missing input', () => {
    expect(blobKeyFromFileUrl('')).toBeNull()
    expect(blobKeyFromFileUrl(null)).toBeNull()
    expect(blobKeyFromFileUrl(undefined)).toBeNull()
  })

  it('returns null when the path is only slashes', () => {
    expect(blobKeyFromFileUrl('///')).toBeNull()
  })
})

describe('blob storage configuration', () => {
  beforeEach(() => {
    setBlobEnv(undefined, undefined)
  })

  it('is not configured when env vars are unset', () => {
    expect(isBlobStorageConfigured()).toBe(false)
  })

  it('is not configured when the connection string is set but the container is not', () => {
    setBlobEnv(FAKE_CONN, undefined)
    expect(isBlobStorageConfigured()).toBe(false)
  })

  it('is configured when both connection string and container are set', () => {
    setBlobEnv(FAKE_CONN, 'reports')
    expect(isBlobStorageConfigured()).toBe(true)
  })

  it('getContainerClient returns null when unconfigured', () => {
    expect(getContainerClient()).toBeNull()
  })

  it('getContainerClient returns a client when configured', () => {
    setBlobEnv(FAKE_CONN, 'reports')
    const client = getContainerClient()
    expect(client).not.toBeNull()
    expect(client?.containerName).toBe('reports')
  })
})

// Minimal fake ContainerClient capturing uploads and serving canned downloads.
function makeFakeContainer(opts: { existingKeys?: string[]; download?: unknown } = {}) {
  const uploads: Array<{ key: string; data: unknown; contentType?: string }> = []
  const existing = new Set(opts.existingKeys ?? [])
  const client = {
    getBlockBlobClient(key: string) {
      return {
        async uploadData(data: unknown, options: { blobHTTPHeaders?: { blobContentType?: string } }) {
          uploads.push({ key, data, contentType: options?.blobHTTPHeaders?.blobContentType })
        }
      }
    },
    getBlobClient(key: string) {
      return {
        async exists() {
          return existing.has(key)
        },
        async download() {
          if (!existing.has(key)) {
            const err = new Error('BlobNotFound') as Error & { statusCode?: number }
            err.statusCode = 404
            throw err
          }
          return opts.download
        }
      }
    }
  }
  return { client, uploads }
}

describe('blob upload/download/exists wrappers', () => {
  afterEach(() => {
    __resetBlobForTests()
  })

  it('uploadBlob writes data to the keyed block blob with its content type', async () => {
    const fake = makeFakeContainer()
    __setContainerClientForTests(fake.client as never)
    const data = Buffer.from('pdf-bytes')

    await uploadBlob('pdf/reports/x.pdf', data, 'application/pdf')

    expect(fake.uploads).toEqual([
      { key: 'pdf/reports/x.pdf', data, contentType: 'application/pdf' }
    ])
  })

  it('uploadBlob throws when blob storage is unconfigured', async () => {
    __setContainerClientForTests(null)
    await expect(uploadBlob('pdf/reports/x.pdf', Buffer.from('x'), 'application/pdf')).rejects.toThrow()
  })

  it('downloadBlob returns the stream and metadata for an existing blob', async () => {
    const stream = Readable.from([Buffer.from('hello')])
    const fake = makeFakeContainer({
      existingKeys: ['pdf/reports/x.pdf'],
      download: { readableStreamBody: stream, contentLength: 5, contentType: 'application/pdf' }
    })
    __setContainerClientForTests(fake.client as never)

    const result = await downloadBlob('pdf/reports/x.pdf')

    expect(result).not.toBeNull()
    expect(result?.stream).toBe(stream)
    expect(result?.contentLength).toBe(5)
    expect(result?.contentType).toBe('application/pdf')
  })

  it('downloadBlob returns null for a missing blob (404)', async () => {
    const fake = makeFakeContainer({ existingKeys: [] })
    __setContainerClientForTests(fake.client as never)

    expect(await downloadBlob('pdf/reports/missing.pdf')).toBeNull()
  })

  it('downloadBlob returns null when unconfigured', async () => {
    __setContainerClientForTests(null)
    expect(await downloadBlob('pdf/reports/x.pdf')).toBeNull()
  })

  it('blobExists delegates to the client', async () => {
    const fake = makeFakeContainer({ existingKeys: ['pdf/reports/here.pdf'] })
    __setContainerClientForTests(fake.client as never)

    expect(await blobExists('pdf/reports/here.pdf')).toBe(true)
    expect(await blobExists('pdf/reports/nope.pdf')).toBe(false)
  })

  it('blobExists returns false when unconfigured', async () => {
    __setContainerClientForTests(null)
    expect(await blobExists('pdf/reports/x.pdf')).toBe(false)
  })
})

describe('tryBlobSource', () => {
  afterEach(() => {
    __resetBlobForTests()
  })

  it('derives the blob key from a fileUrl and returns the source on a hit', async () => {
    const stream = Readable.from([Buffer.from('hi')])
    const fake = makeFakeContainer({
      existingKeys: ['pdf/reports/x.pdf'],
      download: { readableStreamBody: stream, contentLength: 2, contentType: 'application/pdf' }
    })
    __setContainerClientForTests(fake.client as never)

    const source = await tryBlobSource('/pdf/reports/x.pdf')

    expect(source?.stream).toBe(stream)
    expect(source?.contentLength).toBe(2)
  })

  it('returns null for a traversal fileUrl without touching the container', async () => {
    const fake = makeFakeContainer({ existingKeys: ['anything'] })
    __setContainerClientForTests(fake.client as never)

    expect(await tryBlobSource('/pdf/reports/../../secret.pdf')).toBeNull()
  })

  it('returns null when blob storage is unconfigured', async () => {
    __setContainerClientForTests(null)
    expect(await tryBlobSource('/pdf/reports/x.pdf')).toBeNull()
  })
})
