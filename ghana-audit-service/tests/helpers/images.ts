/**
 * Smallest headers that image parsers (and the upload size check) read a
 * pixel size from. They are not decodable pictures: only the bytes up to the
 * size fields are real.
 */

/** PNG signature + IHDR chunk (CRC left zero; size readers don't check it). */
export function pngHeader(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.writeUInt8(8, 8) // bit depth
  ihdr.writeUInt8(6, 9) // RGBA
  const length = Buffer.alloc(4)
  length.writeUInt32BE(13)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    length,
    Buffer.from('IHDR', 'ascii'),
    ihdr,
    Buffer.alloc(4)
  ])
}

/** GIF89a logical screen descriptor. */
export function gifHeader(width: number, height: number): Buffer {
  const size = Buffer.alloc(4)
  size.writeUInt16LE(width, 0)
  size.writeUInt16LE(height, 2)
  return Buffer.concat([Buffer.from('GIF89a', 'ascii'), size, Buffer.from([0, 0, 0])])
}

/**
 * JPEG with a baseline SOF0 frame of `width` × `height` as stored, preceded by
 * a JFIF block, or by an EXIF block carrying `orientation` (6 = stored
 * sideways, shown turned a quarter turn clockwise).
 */
export function jpegHeader(width: number, height: number, orientation?: number): Buffer {
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])]

  if (orientation !== undefined) {
    // Big-endian TIFF header, then one IFD with a single Orientation entry.
    const tiff = Buffer.alloc(8 + 2 + 12 + 4)
    tiff.write('MM', 0, 'ascii')
    tiff.writeUInt16BE(42, 2)
    tiff.writeUInt32BE(8, 4) // first IFD offset
    tiff.writeUInt16BE(1, 8) // entries
    tiff.writeUInt16BE(0x0112, 10) // Orientation
    tiff.writeUInt16BE(3, 12) // SHORT
    tiff.writeUInt32BE(1, 14) // count
    tiff.writeUInt16BE(orientation, 18)
    const exif = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff])
    const length = Buffer.alloc(2)
    length.writeUInt16BE(exif.length + 2)
    parts.push(Buffer.from([0xff, 0xe1]), length, exif)
  } else {
    // Real JPEGs always open with an APPn segment; JFIF when there is no EXIF.
    const jfif = Buffer.alloc(16)
    jfif.writeUInt16BE(16, 0)
    jfif.write('JFIF\0', 2, 'binary')
    jfif.writeUInt16BE(0x0101, 7) // version 1.1
    parts.push(Buffer.from([0xff, 0xe0]), jfif)
  }

  const frame = Buffer.alloc(2 + 1 + 2 + 2 + 1 + 9)
  frame.writeUInt16BE(frame.length, 0)
  frame.writeUInt8(8, 2) // precision
  frame.writeUInt16BE(height, 3)
  frame.writeUInt16BE(width, 5)
  frame.writeUInt8(3, 7) // components
  parts.push(Buffer.from([0xff, 0xc0]), frame, Buffer.from([0xff, 0xd9]))

  return Buffer.concat(parts)
}
