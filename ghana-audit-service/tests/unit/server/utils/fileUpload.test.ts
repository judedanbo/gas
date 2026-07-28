import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { persistUpload, uploadConfigs, type UploadConfig } from '~/server/utils/fileUpload'
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
  const uploads: Array<{ key: string; data: unknown; contentType?: string }> = []
  const client = {
    getBlockBlobClient(key: string) {
      return {
        async uploadData(data: unknown, options: { blobHTTPHeaders?: { blobContentType?: string } }) {
          uploads.push({ key, data, contentType: options?.blobHTTPHeaders?.blobContentType })
        }
      }
    }
  }
  return { client, uploads }
}

const tmpDirs: string[] = []
afterEach(() => {
  __resetBlobForTests()
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true })
  tmpDirs.length = 0
})

describe('persistUpload', () => {
  it('uploads report PDFs to Blob and returns the unchanged public URL', async () => {
    const fake = makeFakeContainer()
    __setContainerClientForTests(fake.client as never)
    const data = Buffer.from('%PDF-1.7 fake')

    const url = await persistUpload(reportBlobConfig, '20260615-abc.pdf', data, 'application/pdf')

    expect(url).toBe('/pdf/reports/20260615-abc.pdf')
    expect(fake.uploads).toEqual([
      { key: 'pdf/reports/20260615-abc.pdf', data, contentType: 'application/pdf' }
    ])
  })

  it('falls back to disk when Blob storage is unconfigured', async () => {
    __setContainerClientForTests(null)
    const baseDir = mkdtempSync(join(tmpdir(), 'gas-upload-'))
    tmpDirs.push(baseDir)
    const data = Buffer.from('%PDF-1.7 fallback')

    const url = await persistUpload(
      { ...reportBlobConfig, baseDir },
      '20260615-def.pdf',
      data,
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
      data,
      'application/pdf'
    )

    expect(url).toBe('/uploads/publications/20260728-pub.pdf')
    expect(fake.uploads).toEqual([
      { key: 'uploads/publications/20260728-pub.pdf', data, contentType: 'application/pdf' }
    ])
  })

  it('report and publication configs both use the blob backend', () => {
    // PDFs must not be written to cwd public/ — that directory is not served
    // in production (only .output/public is) and dies on container restart.
    expect(uploadConfigs.report.backend).toBe('blob')
    expect(uploadConfigs.publication.backend).toBe('blob')
  })
})
