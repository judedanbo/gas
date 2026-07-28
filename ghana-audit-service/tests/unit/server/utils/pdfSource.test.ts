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

  it('prefers the on-disk asset and returns a no-op cleanup', async () => {
    vi.mocked(resolvePublicAsset).mockReturnValue('/abs/public/pdf/reports/x.pdf')

    const source = await materializePdfSource('/pdf/reports/x.pdf')

    expect(source).not.toBeNull()
    expect(source!.path).toBe('/abs/public/pdf/reports/x.pdf')
    expect(source!.blobKey).toBeNull()
    await expect(source!.cleanup()).resolves.toBeUndefined()
    expect(vi.mocked(tryBlobSource)).not.toHaveBeenCalled()
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
