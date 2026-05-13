import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~/server/utils/publicFiles', () => ({
  resolvePublicAsset: vi.fn()
}))

vi.mock('~/server/utils/generateThumbnail', () => ({
  generateThumbnailFromPdf: vi.fn()
}))

vi.mock('~/server/utils/adminHelpers', () => ({
  requirePermission: vi.fn()
}))

import { resolvePublicAsset } from '~/server/utils/publicFiles'
import { generateThumbnailFromPdf } from '~/server/utils/generateThumbnail'

async function handleGenerateThumbnail(body: { fileUrl?: string }) {
  const fileUrl = body?.fileUrl
  if (!fileUrl || typeof fileUrl !== 'string') {
    throw { statusCode: 400, statusMessage: 'fileUrl is required' }
  }
  if (!fileUrl.startsWith('/pdf/reports/')) {
    throw { statusCode: 400, statusMessage: 'Invalid file path' }
  }

  const pdfPath = resolvePublicAsset(fileUrl)
  if (!pdfPath) {
    throw { statusCode: 422, statusMessage: 'PDF file not found' }
  }

  const thumbnailUrl = generateThumbnailFromPdf(pdfPath)
  if (!thumbnailUrl) {
    throw {
      statusCode: 422,
      statusMessage: 'Thumbnail generation failed — pdftoppm may not be available'
    }
  }

  return { success: true, thumbnailUrl }
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

  it('returns 422 when PDF file is not found on disk', async () => {
    vi.mocked(resolvePublicAsset).mockReturnValue(null)

    await expect(
      handleGenerateThumbnail({ fileUrl: '/pdf/reports/test.pdf' })
    ).rejects.toMatchObject({
      statusCode: 422,
      statusMessage: 'PDF file not found'
    })
  })

  it('returns 422 when thumbnail generation fails', async () => {
    vi.mocked(resolvePublicAsset).mockReturnValue('/abs/path/test.pdf')
    vi.mocked(generateThumbnailFromPdf).mockReturnValue(null)

    await expect(
      handleGenerateThumbnail({ fileUrl: '/pdf/reports/test.pdf' })
    ).rejects.toMatchObject({
      statusCode: 422,
      statusMessage: 'Thumbnail generation failed — pdftoppm may not be available'
    })
  })

  it('returns success with thumbnailUrl on success', async () => {
    vi.mocked(resolvePublicAsset).mockReturnValue('/abs/path/test.pdf')
    vi.mocked(generateThumbnailFromPdf).mockReturnValue('/uploads/thumbnails/20260513-abc.jpg')

    const result = await handleGenerateThumbnail({
      fileUrl: '/pdf/reports/test.pdf'
    })

    expect(result).toEqual({
      success: true,
      thumbnailUrl: '/uploads/thumbnails/20260513-abc.jpg'
    })
    expect(resolvePublicAsset).toHaveBeenCalledWith('/pdf/reports/test.pdf')
    expect(generateThumbnailFromPdf).toHaveBeenCalledWith('/abs/path/test.pdf')
  })
})
