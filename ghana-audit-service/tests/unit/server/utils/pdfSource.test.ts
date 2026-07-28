import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Readable } from 'node:stream'
import { existsSync, readFileSync } from 'node:fs'
import { resolvePublicAsset } from '~/server/utils/publicFiles'
import { tryBlobSource } from '~/server/utils/blobStorage'
import { materializePdfSource } from '~/server/utils/pdfSource'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/publicFiles', () => ({
  resolvePublicAsset: vi.fn()
}))

vi.mock('~/server/utils/blobStorage', async () => {
  const actual = await vi.importActual<typeof import('~/server/utils/blobStorage')>(
    '~/server/utils/blobStorage'
  )
  return {
    ...actual,
    tryBlobSource: vi.fn(async () => null)
  }
})

describe('materializePdfSource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to the on-disk asset when Blob misses and returns a no-op cleanup', async () => {
    vi.mocked(tryBlobSource).mockResolvedValue(null)
    vi.mocked(resolvePublicAsset).mockReturnValue('/abs/public/pdf/reports/x.pdf')

    const source = await materializePdfSource('/pdf/reports/x.pdf')

    expect(source).not.toBeNull()
    expect(source!.path).toBe('/abs/public/pdf/reports/x.pdf')
    expect(source!.blobKey).toBeNull()
    await expect(source!.cleanup()).resolves.toBeUndefined()
  })

  it('prefers Blob over disk when the file exists in both backends', async () => {
    // Same precedence as /api/downloads/** — if these diverge, the optimizer
    // mutates the disk copy while downloads keep serving the stale blob.
    vi.mocked(resolvePublicAsset).mockReturnValue('/abs/public/pdf/reports/both.pdf')
    vi.mocked(tryBlobSource).mockResolvedValue({
      stream: Readable.from(Buffer.from('blob copy')),
      contentLength: 9,
      contentType: 'application/pdf'
    })

    const source = await materializePdfSource('/pdf/reports/both.pdf')

    expect(source).not.toBeNull()
    expect(source!.blobKey).toBe('pdf/reports/both.pdf')
    expect(source!.path).not.toBe('/abs/public/pdf/reports/both.pdf')
    await source!.cleanup()
  })

  it('streams the blob to a temp file when not on disk, and cleanup removes it', async () => {
    vi.mocked(resolvePublicAsset).mockReturnValue(null)
    vi.mocked(tryBlobSource).mockResolvedValue({
      stream: Readable.from(Buffer.from('%PDF-1.4 test')),
      contentLength: 13,
      contentType: 'application/pdf'
    })

    const source = await materializePdfSource('/pdf/reports/blob-only.pdf')

    expect(source).not.toBeNull()
    expect(source!.blobKey).toBe('pdf/reports/blob-only.pdf')
    expect(existsSync(source!.path)).toBe(true)
    expect(readFileSync(source!.path, 'utf8')).toBe('%PDF-1.4 test')

    await source!.cleanup()
    expect(existsSync(source!.path)).toBe(false)
    // Cleanup is idempotent and never throws.
    await expect(source!.cleanup()).resolves.toBeUndefined()
  })

  it('returns null when the file is on neither disk nor Blob', async () => {
    vi.mocked(resolvePublicAsset).mockReturnValue(null)
    vi.mocked(tryBlobSource).mockResolvedValue(null)

    await expect(materializePdfSource('/pdf/reports/missing.pdf')).resolves.toBeNull()
  })
})
