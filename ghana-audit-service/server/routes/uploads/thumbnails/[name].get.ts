import { serveUploadedImage } from '../../../utils/serveUpload'

/**
 * Serve generated/uploaded thumbnails at their canonical /uploads/thumbnails/*
 * URL.
 *
 * Nitro serves static public assets before route handlers, so this route only
 * runs when the file is NOT in the build manifest — i.e. anything written at
 * runtime. It reads from disk first and falls back to Blob: thumbnails are
 * Blob-backed in production, but generateThumbnailFromPdf() writes to disk
 * whenever Blob is unconfigured, and those used to 404 here.
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name') ?? ''
  return serveUploadedImage(event, 'thumbnails', name)
})
