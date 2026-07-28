import { downloadBlob } from '../../../utils/blobStorage'

/**
 * Serve blob-stored thumbnails at their canonical /uploads/thumbnails/* URL.
 *
 * Nitro serves static public assets before route handlers, so this route only
 * runs when the file is NOT on disk — i.e. thumbnails generated with the Blob
 * backend (production). Dev/legacy on-disk thumbnails never reach here.
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name') ?? ''

  // Thumbnail names are generated as <yyyymmdd>-<uuid>.jpg; anything else 404s.
  // The strict charset also rules out traversal in the blob key.
  if (!/^[A-Za-z0-9-]+\.jpg$/.test(name)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const blob = await downloadBlob(`uploads/thumbnails/${name}`)
  if (!blob) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  setHeader(event, 'Content-Type', 'image/jpeg')
  if (blob.contentLength > 0) {
    setHeader(event, 'Content-Length', blob.contentLength)
  }
  // Names embed a UUID, so content never changes under a given URL.
  setHeader(event, 'Cache-Control', 'public, max-age=86400, immutable')

  return sendStream(event, blob.stream)
})
