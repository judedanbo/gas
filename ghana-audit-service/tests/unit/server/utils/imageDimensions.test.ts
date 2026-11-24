import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertImageDimensions, readImageDimensions } from '~/server/utils/imageDimensions'
import { gifHeader, jpegHeader, pngHeader } from '../../../helpers/images'

const tmpDirs: string[] = []

function file(data: Buffer | string): string {
  const dir = mkdtempSync(join(tmpdir(), 'gas-image-'))
  tmpDirs.push(dir)
  const path = join(dir, 'upload')
  writeFileSync(path, data)
  return path
}

afterEach(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true })
  tmpDirs.length = 0
})

describe('readImageDimensions', () => {
  it('reads PNG, GIF and JPEG sizes from the header', async () => {
    expect(await readImageDimensions(file(pngHeader(1600, 800)))).toEqual({
      width: 1600,
      height: 800
    })
    expect(await readImageDimensions(file(gifHeader(640, 320)))).toEqual({
      width: 640,
      height: 320
    })
    expect(await readImageDimensions(file(jpegHeader(1600, 800)))).toEqual({
      width: 1600,
      height: 800
    })
  })

  it('reports a JPEG stored sideways at the size a browser shows it', async () => {
    // Stored 800 × 1600 with orientation 6: displayed 1600 × 800.
    expect(await readImageDimensions(file(jpegHeader(800, 1600, 6)))).toEqual({
      width: 1600,
      height: 800
    })
    // Orientation 3 is upside down: no swap.
    expect(await readImageDimensions(file(jpegHeader(1600, 800, 3)))).toEqual({
      width: 1600,
      height: 800
    })
  })

  it('returns null for files that are not raster images', async () => {
    expect(await readImageDimensions(file('not an image at all'))).toBeNull()
    // image-size can measure SVG, but SVG is never an accepted upload.
    expect(
      await readImageDimensions(
        file('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800"></svg>')
      )
    ).toBeNull()
  })

  it('returns null for a missing file', async () => {
    expect(await readImageDimensions(join(tmpdir(), 'gas-image-missing'))).toBeNull()
  })
})

describe('assertImageDimensions', () => {
  const required = { width: 1600, height: 800 }

  it('accepts an image of exactly the required size', async () => {
    await expect(assertImageDimensions(file(pngHeader(1600, 800)), required)).resolves.toBe(
      undefined
    )
  })

  it.each([
    [1200, 600],
    [800, 1600],
    [1601, 800],
    [3200, 1600]
  ])('rejects %i × %i with a 400 naming both sizes', async (width, height) => {
    await expect(
      assertImageDimensions(file(pngHeader(width, height)), required)
    ).rejects.toMatchObject({
      statusCode: 400,
      message: `The image must be exactly 1600 × 800 pixels. This one is ${width} × ${height}.`
    })
  })

  it('rejects a file it cannot read as an image', async () => {
    await expect(assertImageDimensions(file('garbage'), required)).rejects.toMatchObject({
      statusCode: 400,
      message: 'This file could not be read as an image. Upload a JPEG, PNG, WebP or GIF.'
    })
  })
})
