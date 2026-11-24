import { createError } from 'h3'
import { imageSizeFromFile } from 'image-size/fromFile'

export interface ImageDimensions {
  width: number
  height: number
}

/** The formats image uploads accept (`uploadConfigs.image`/`.popup`). */
const RASTER_TYPES = new Set(['jpg', 'png', 'webp', 'gif'])

/**
 * Pixel size of the image at `path` as a browser shows it, read from the file
 * header (at most the first 512 KB). JPEG EXIF orientations 5–8 turn the image
 * a quarter turn, so width and height swap — the admin form measures the
 * picked file the same way. Null when the file is not a JPEG, PNG, WebP or GIF
 * whose size can be read.
 */
export async function readImageDimensions(path: string): Promise<ImageDimensions | null> {
  try {
    const { width, height, orientation, type } = await imageSizeFromFile(path)
    if (!type || !RASTER_TYPES.has(type) || !width || !height) return null
    return orientation && orientation >= 5 ? { width: height, height: width } : { width, height }
  } catch {
    return null
  }
}

/**
 * Reject the image at `path` with a 400 unless it is exactly `required`. The
 * message is shown to the admin as-is under the upload field.
 */
export async function assertImageDimensions(
  path: string,
  required: ImageDimensions
): Promise<void> {
  const actual = await readImageDimensions(path)
  if (!actual) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unreadable image',
      message: 'This file could not be read as an image. Upload a JPEG, PNG, WebP or GIF.'
    })
  }
  if (actual.width !== required.width || actual.height !== required.height) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Wrong image size',
      message:
        `The image must be exactly ${required.width} × ${required.height} pixels. ` +
        `This one is ${actual.width} × ${actual.height}.`
    })
  }
}
