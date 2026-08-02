import { serveUploadedImage } from '../../../utils/serveUpload'

/**
 * Serve admin-uploaded images at their canonical /uploads/images/* URL.
 *
 * These are written at runtime, so they are absent from Nitro's build-time
 * public-asset manifest and the static handler cannot serve them — see
 * serveUploadedImage() for the full mechanism. Without this route every image
 * an admin has ever uploaded (news/event thumbnails, gallery images, team and
 * Auditor-General photos) 404s in production.
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name') ?? ''
  return serveUploadedImage(event, 'images', name)
})
