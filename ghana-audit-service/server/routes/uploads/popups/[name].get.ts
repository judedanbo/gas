import { serveUploadedImage } from '../../../utils/serveUpload'

/**
 * Serve site pop-up images at their canonical /uploads/popups/* URL.
 *
 * Like /uploads/images/*, these are written at runtime (the `popup` upload
 * type, which only accepts 1600 × 800 images), so the build-time static
 * handler cannot serve them — see serveUploadedImage().
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name') ?? ''
  return serveUploadedImage(event, 'popups', name)
})
