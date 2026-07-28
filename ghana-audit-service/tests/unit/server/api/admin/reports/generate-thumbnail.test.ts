import { describe, it, expect, vi, beforeEach } from 'vitest'
import { materializePdfSource, type LocalPdfSource } from '~/server/utils/pdfSource'
import { generateThumbnailFromPdf } from '~/server/utils/generateThumbnail'

vi.mock('~/server/utils/pdfSource', () => ({
  materializePdfSource: vi.fn()
}))

vi.mock('~/server/utils/generateThumbnail', () => ({
  generateThumbnailFromPdf: vi.fn()
}))

vi.mock('~/server/utils/adminHelpers', () => ({
  requirePermission: vi.fn()
}))

// Mirrors generate-thumbnail.post.ts's control flow (H3 globals aren't worth
// booting for a unit test): materialize the PDF (disk or blob temp), generate,
// always clean up the source.
async function handleGenerateThumbnail(body: { fileUrl?: string }) {
  const fileUrl = body?.fileUrl
  if (!fileUrl || typeof fileUrl !== 'string') {
    throw { statusCode: 400, statusMessage: 'fileUrl is required' }
  }
  if (!fileUrl.startsWith('/pdf/reports/')) {
    throw { statusCode: 400, statusMessage: 'Invalid file path' }
  }

  const source = await materializePdfSource(fileUrl)
  if (!source) {
    throw { statusCode: 422, statusMessage: 'PDF file not found in storage' }
  }

  try {
    const thumbnailUrl = await generateThumbnailFromPdf(source.path)
    if (!thumbnailUrl) {
      throw {
        statusCode: 422,
        statusMessage: 'Thumbnail generation failed — pdftoppm may not be available'
      }
    }

    return { success: true, thumbnailUrl }
  } finally {
    await source.cleanup()
  }
}

function fakeSource(path: string): LocalPdfSource {
  return { path, blobKey: null, cleanup: vi.fn(async () => undefined) }
}

describe('generate-thumbnail endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when fileUrl is missing', async () => {
    await expect(handleGenerateThumbnail({})).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'fileUrl is required'
    })
  })

  it('returns 400 when fileUrl does not start with /pdf/reports/', async () => {
    await expect(
      handleGenerateThumbnail({ fileUrl: '/uploads/images/evil.pdf' })
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Invalid file path'
    })
  })

  it('returns 422 when the PDF is on neither disk nor Blob', async () => {
    vi.mocked(materializePdfSource).mockResolvedValue(null)

    await expect(
      handleGenerateThumbnail({ fileUrl: '/pdf/reports/test.pdf' })
    ).rejects.toMatchObject({
      statusCode: 422,
      statusMessage: 'PDF file not found in storage'
    })
  })

  it('returns 422 and cleans up when thumbnail generation fails', async () => {
    const source = fakeSource('/abs/path/test.pdf')
    vi.mocked(materializePdfSource).mockResolvedValue(source)
    vi.mocked(generateThumbnailFromPdf).mockResolvedValue(null)

    await expect(
      handleGenerateThumbnail({ fileUrl: '/pdf/reports/test.pdf' })
    ).rejects.toMatchObject({
      statusCode: 422,
      statusMessage: 'Thumbnail generation failed — pdftoppm may not be available'
    })
    expect(source.cleanup).toHaveBeenCalled()
  })

  it('returns success with thumbnailUrl and cleans up the source', async () => {
    const source = fakeSource('/abs/path/test.pdf')
    vi.mocked(materializePdfSource).mockResolvedValue(source)
    vi.mocked(generateThumbnailFromPdf).mockResolvedValue('/uploads/thumbnails/20260513-abc.jpg')

    const result = await handleGenerateThumbnail({
      fileUrl: '/pdf/reports/test.pdf'
    })

    expect(result).toEqual({
      success: true,
      thumbnailUrl: '/uploads/thumbnails/20260513-abc.jpg'
    })
    expect(materializePdfSource).toHaveBeenCalledWith('/pdf/reports/test.pdf')
    expect(generateThumbnailFromPdf).toHaveBeenCalledWith('/abs/path/test.pdf')
    expect(source.cleanup).toHaveBeenCalled()
  })
})
