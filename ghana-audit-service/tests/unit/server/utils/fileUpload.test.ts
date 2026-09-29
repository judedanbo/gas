import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import {
  persistUpload,
  receiveMultipartFile,
  uploadConfigs,
  type UploadConfig
} from '~/server/utils/fileUpload'
import { __resetBlobForTests, __setContainerClientForTests } from '~/server/utils/blobStorage'

const reportBlobConfig: UploadConfig = {
  allowedTypes: ['application/pdf'],
  maxSize: 100 * 1024 * 1024,
  directory: 'reports',
  baseDir: 'public/pdf',
  urlBase: '/pdf',
  backend: 'blob'
}

function makeFakeContainer() {
  const uploads: Array<{ key: string; data: Buffer; contentType?: string }> = []
  const client = {
    getBlockBlobClient(key: string) {
      return {
        async uploadFile(
          filePath: string,
          options: { blobHTTPHeaders?: { blobContentType?: string } }
        ) {
          uploads.push({
            key,
            data: readFileSync(filePath),
            contentType: options?.blobHTTPHeaders?.blobContentType
          })
        }
      }
    }
  }
  return { client, uploads }
}

const tmpDirs: string[] = []
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gas-upload-'))
  tmpDirs.push(dir)
  return dir
}

/** Write `data` to a fresh temp file and return its path (a spooled upload). */
function spool(data: Buffer): string {
  const path = join(makeTmpDir(), 'spool')
  writeFileSync(path, data)
  return path
}

afterEach(() => {
  __resetBlobForTests()
  delete process.env.UPLOAD_TMP_DIR
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true })
  tmpDirs.length = 0
})

describe('persistUpload', () => {
  it('uploads report PDFs to Blob and returns the unchanged public URL', async () => {
    const fake = makeFakeContainer()
    __setContainerClientForTests(fake.client as never)
    const data = Buffer.from('%PDF-1.7 fake')

    const url = await persistUpload(
      reportBlobConfig,
      '20260615-abc.pdf',
      spool(data),
      'application/pdf'
    )

    expect(url).toBe('/pdf/reports/20260615-abc.pdf')
    expect(fake.uploads).toEqual([
      { key: 'pdf/reports/20260615-abc.pdf', data, contentType: 'application/pdf' }
    ])
  })

  it('falls back to disk when Blob storage is unconfigured', async () => {
    __setContainerClientForTests(null)
    const baseDir = makeTmpDir()
    const data = Buffer.from('%PDF-1.7 fallback')

    const url = await persistUpload(
      { ...reportBlobConfig, baseDir },
      '20260615-def.pdf',
      spool(data),
      'application/pdf'
    )

    expect(url).toBe('/pdf/reports/20260615-def.pdf')
    const written = join(baseDir, 'reports', '20260615-def.pdf')
    expect(existsSync(written)).toBe(true)
    expect(readFileSync(written)).toEqual(data)
  })

  it('uploads publication PDFs to Blob under uploads/publications/', async () => {
    const fake = makeFakeContainer()
    __setContainerClientForTests(fake.client as never)
    const data = Buffer.from('%PDF-1.7 publication')

    const url = await persistUpload(
      uploadConfigs.publication,
      '20260728-pub.pdf',
      spool(data),
      'application/pdf'
    )

    expect(url).toBe('/uploads/publications/20260728-pub.pdf')
    expect(fake.uploads).toEqual([
      { key: 'uploads/publications/20260728-pub.pdf', data, contentType: 'application/pdf' }
    ])
  })

  it('writes image uploads to disk under the /uploads/images/ URL', async () => {
    __setContainerClientForTests(null)
    const baseDir = makeTmpDir()
    const data = Buffer.from('image-bytes')

    const url = await persistUpload(
      { ...uploadConfigs.image, baseDir },
      '20260114-abc.jpeg',
      spool(data),
      'image/jpeg'
    )

    // Nothing baked sits behind this URL, so it is only reachable because
    // server/routes/uploads/images/[name].get.ts serves it.
    expect(url).toBe('/uploads/images/20260114-abc.jpeg')
    const written = join(baseDir, 'images', '20260114-abc.jpeg')
    expect(existsSync(written)).toBe(true)
    expect(readFileSync(written)).toEqual(data)
  })

  it('image uploads are disk-backed, not blob-backed', () => {
    expect(uploadConfigs.image.backend).toBeUndefined()
  })

  it('report and publication configs both use the blob backend', () => {
    // PDFs must not be written to cwd public/ — that directory is not served
    // in production (only .output/public is) and dies on container restart.
    expect(uploadConfigs.report.backend).toBe('blob')
    expect(uploadConfigs.publication.backend).toBe('blob')
  })
})

describe('receiveMultipartFile', () => {
  const BOUNDARY = '----gasTestBoundary'

  interface Part {
    name: string
    data: Buffer | string
    filename?: string
    contentType?: string
  }

  /** Build a multipart/form-data body the way a browser would. */
  function multipart(parts: Part[]): { body: Readable; headers: Record<string, string> } {
    const chunks: Buffer[] = []
    for (const part of parts) {
      let head = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${part.name}"`
      if (part.filename !== undefined) head += `; filename="${part.filename}"`
      head += '\r\n'
      if (part.contentType) head += `Content-Type: ${part.contentType}\r\n`
      head += '\r\n'
      chunks.push(Buffer.from(head, 'utf8'), Buffer.from(part.data), Buffer.from('\r\n'))
    }
    chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`))
    const full = Buffer.concat(chunks)
    // Feed the body in small chunks so boundary detection across chunk edges
    // is exercised, as it would be over a real socket.
    const pieces: Buffer[] = []
    for (let i = 0; i < full.length; i += 7) pieces.push(full.subarray(i, i + 7))
    return {
      body: Readable.from(pieces),
      headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` }
    }
  }

  const pdfConfig: UploadConfig = {
    allowedTypes: ['application/pdf'],
    maxSize: 1024,
    directory: 'reports'
  }

  it('spools the file part to disk with its name, type and size', async () => {
    process.env.UPLOAD_TMP_DIR = makeTmpDir()
    const data = Buffer.from('%PDF-1.7 hello world')
    const { body, headers } = multipart([
      { name: 'title', data: 'ignored text field' },
      {
        name: 'file',
        data,
        filename: 'Sea Defence Report_FINAL.pdf',
        contentType: 'application/pdf'
      }
    ])

    const received = await receiveMultipartFile(body, headers, pdfConfig)

    expect(received.originalName).toBe('Sea Defence Report_FINAL.pdf')
    expect(received.mimeType).toBe('application/pdf')
    expect(received.size).toBe(data.length)
    expect(received.tempPath.startsWith(process.env.UPLOAD_TMP_DIR)).toBe(true)
    expect(readFileSync(received.tempPath)).toEqual(data)
  })

  it('keeps non-ASCII filenames intact', async () => {
    process.env.UPLOAD_TMP_DIR = makeTmpDir()
    const { body, headers } = multipart([
      {
        name: 'file',
        data: '%PDF-1.7',
        filename: 'Ràpport Ghana – 2026.pdf',
        contentType: 'application/pdf'
      }
    ])

    const received = await receiveMultipartFile(body, headers, pdfConfig)

    expect(received.originalName).toBe('Ràpport Ghana – 2026.pdf')
  })

  it('rejects files over the configured size limit with a 400 and removes the spool file', async () => {
    const tmp = makeTmpDir()
    process.env.UPLOAD_TMP_DIR = tmp
    const { body, headers } = multipart([
      {
        name: 'file',
        data: Buffer.alloc(pdfConfig.maxSize + 1, 0x41),
        filename: 'big.pdf',
        contentType: 'application/pdf'
      }
    ])

    await expect(receiveMultipartFile(body, headers, pdfConfig)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'File exceeds maximum size of 0.0009765625MB'
    })
    expect(readdirSync(tmp)).toEqual([])
  })

  it('rejects disallowed MIME types with a 400', async () => {
    process.env.UPLOAD_TMP_DIR = makeTmpDir()
    const { body, headers } = multipart([
      { name: 'file', data: 'GIF89a', filename: 'x.gif', contentType: 'image/gif' }
    ])

    await expect(receiveMultipartFile(body, headers, pdfConfig)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'File type image/gif is not allowed. Allowed types: application/pdf'
    })
  })

  it('rejects a request without a file part', async () => {
    process.env.UPLOAD_TMP_DIR = makeTmpDir()
    const { body, headers } = multipart([{ name: 'title', data: 'no file here' }])

    await expect(receiveMultipartFile(body, headers, pdfConfig)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'No file found in request'
    })
  })

  it('rejects an empty file', async () => {
    process.env.UPLOAD_TMP_DIR = makeTmpDir()
    const { body, headers } = multipart([
      { name: 'file', data: '', filename: 'empty.pdf', contentType: 'application/pdf' }
    ])

    await expect(receiveMultipartFile(body, headers, pdfConfig)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'File is empty'
    })
  })

  it('rejects non-multipart requests', async () => {
    await expect(
      receiveMultipartFile(
        Readable.from([Buffer.from('{}')]),
        { 'content-type': 'application/json' },
        pdfConfig
      )
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: 'No file uploaded' })
  })

  it('rejects a truncated body as malformed and removes the spool file', async () => {
    const tmp = makeTmpDir()
    process.env.UPLOAD_TMP_DIR = tmp
    const head =
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="cut.pdf"\r\n` +
      `Content-Type: application/pdf\r\n\r\n%PDF-1.7 partial`
    const body = Readable.from([Buffer.from(head)]) // no closing boundary

    await expect(
      receiveMultipartFile(
        body,
        { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
        pdfConfig
      )
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Malformed upload' })
    expect(readdirSync(tmp)).toEqual([])
  })
})
