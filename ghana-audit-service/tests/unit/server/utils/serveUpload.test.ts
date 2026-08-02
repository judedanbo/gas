import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { serveUploadedImage } from '~/server/utils/serveUpload'
import { __resetBlobForTests, __setContainerClientForTests } from '~/server/utils/blobStorage'

// vi.mock is hoisted above every declaration, so the shared spy state has to be
// hoisted too — a plain `const` would be in the temporal dead zone.
const h3 = vi.hoisted(() => ({
  headers: {} as Record<string, unknown>,
  streamed: null as unknown,
  reset() {
    h3.headers = {}
    h3.streamed = null
  }
}))

vi.mock('h3', () => ({
  createError: (opts: { statusCode: number; statusMessage?: string }) =>
    Object.assign(new Error(opts.statusMessage ?? 'Error'), opts),
  setHeader: (_event: unknown, key: string, value: unknown) => {
    h3.headers[key] = value
  },
  sendStream: (_event: unknown, stream: unknown) => {
    h3.streamed = stream
    return stream
  }
}))

const event = {} as never

/**
 * Drain the stream handed to sendStream. createReadStream opens lazily, so
 * tests must consume it before the temp dir is removed or the deferred open
 * throws ENOENT as an uncaught exception.
 */
async function collectStreamed(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of h3.streamed as Readable) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString()
}

/** Mimics the shape blobStorage.downloadBlob() consumes. */
function makeFakeContainer(blobs: Record<string, { body: string; contentType: string }>) {
  return {
    getBlobClient(key: string) {
      return {
        async download() {
          const blob = blobs[key]
          if (!blob) {
            throw Object.assign(new Error('not found'), { statusCode: 404 })
          }
          return {
            readableStreamBody: Readable.from([Buffer.from(blob.body)]),
            contentLength: blob.body.length,
            contentType: blob.contentType
          }
        }
      }
    }
  }
}

const tmpDirs: string[] = []
const originalUploadDir = process.env.UPLOAD_DIRECTORY

function makeUploadDir(directory: string, files: Record<string, string> = {}): string {
  const base = mkdtempSync(join(tmpdir(), 'gas-serve-'))
  tmpDirs.push(base)
  mkdirSync(join(base, directory), { recursive: true })
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(base, directory, name), contents)
  }
  process.env.UPLOAD_DIRECTORY = base
  return base
}

beforeEach(() => {
  h3.reset()
  __setContainerClientForTests(null)
})

afterEach(() => {
  __resetBlobForTests()
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true })
  tmpDirs.length = 0
  if (originalUploadDir === undefined) {
    delete process.env.UPLOAD_DIRECTORY
  } else {
    process.env.UPLOAD_DIRECTORY = originalUploadDir
  }
})

describe('serveUploadedImage', () => {
  it('streams an uploaded image from disk with the right headers', async () => {
    makeUploadDir('images', { '20260114-abc.jpeg': 'jpeg-bytes' })

    await serveUploadedImage(event, 'images', '20260114-abc.jpeg')

    expect(h3.headers['Content-Type']).toBe('image/jpeg')
    expect(h3.headers['Content-Length']).toBe('jpeg-bytes'.length)
    expect(h3.headers['Cache-Control']).toBe('public, max-age=86400, immutable')
    await expect(collectStreamed()).resolves.toBe('jpeg-bytes')
  })

  it('serves thumbnails from disk too, not just Blob', async () => {
    // The regression this fixes: the thumbnails route used to be Blob-only, so
    // a disk-written thumbnail 404ed whenever Azure was unconfigured.
    makeUploadDir('thumbnails', { '20260114-cover.jpg': 'thumb' })

    await serveUploadedImage(event, 'thumbnails', '20260114-cover.jpg')

    expect(h3.headers['Content-Type']).toBe('image/jpeg')
    await expect(collectStreamed()).resolves.toBe('thumb')
  })

  it('resolves png and webp to their own content types', async () => {
    makeUploadDir('images', { '20260114-a.png': 'png', '20260114-b.webp': 'webp' })

    await serveUploadedImage(event, 'images', '20260114-a.png')
    expect(h3.headers['Content-Type']).toBe('image/png')
    await collectStreamed()

    await serveUploadedImage(event, 'images', '20260114-b.webp')
    expect(h3.headers['Content-Type']).toBe('image/webp')
    await collectStreamed()
  })

  it('falls back to Blob when the file is not on disk', async () => {
    makeUploadDir('images')
    __setContainerClientForTests(
      makeFakeContainer({
        'uploads/images/20260114-blob.jpg': { body: 'from-blob', contentType: 'image/jpeg' }
      }) as never
    )

    await serveUploadedImage(event, 'images', '20260114-blob.jpg')

    expect(h3.headers['Content-Type']).toBe('image/jpeg')
    expect(h3.headers['Content-Length']).toBe('from-blob'.length)
    await expect(collectStreamed()).resolves.toBe('from-blob')
  })

  it('404s when the file is in neither disk nor Blob', async () => {
    makeUploadDir('images')

    await expect(serveUploadedImage(event, 'images', '20260114-missing.jpg')).rejects.toMatchObject(
      { statusCode: 404 }
    )
  })

  it.each([
    ['traversal', '../../../etc/passwd'],
    ['encoded traversal', '..%2F..%2Fsecret.jpg'],
    ['nested path', 'sub/dir/file.jpg'],
    ['disallowed extension', '20260114-abc.svg'],
    ['no extension', '20260114-abc'],
    ['double extension', '20260114-abc.php.jpg'],
    ['spaces', 'my photo.jpg']
  ])('404s on %s without touching disk or Blob', async (_label, name) => {
    makeUploadDir('images', { 'passwd.jpg': 'secret' })

    await expect(serveUploadedImage(event, 'images', name)).rejects.toMatchObject({
      statusCode: 404
    })
    expect(h3.streamed).toBeNull()
  })
})
