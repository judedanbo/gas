import { expect } from 'vitest'
import { inflateRawSync } from 'node:zlib'

export interface ZipFileEntry {
  name: string
  method: number
  flags: number
  crc: number
  compressedSize: number
  size: number
  data: Buffer
}

/**
 * Read a ZIP archive back the way unzip tools do, from the central directory,
 * inflating every entry. Only what the app's own writer produces is supported
 * (no Zip64, no encryption); anything malformed fails an assertion.
 */
export function readZip(zip: Buffer): ZipFileEntry[] {
  const end = zip.length - 22
  expect(zip.readUInt32LE(end)).toBe(0x06054b50)
  const count = zip.readUInt16LE(end + 10)
  let at = zip.readUInt32LE(end + 16)
  expect(at + zip.readUInt32LE(end + 12)).toBe(end)

  const entries: ZipFileEntry[] = []
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(at)).toBe(0x02014b50)
    const nameLength = zip.readUInt16LE(at + 28)
    const compressedSize = zip.readUInt32LE(at + 20)
    const localOffset = zip.readUInt32LE(at + 42)

    expect(zip.readUInt32LE(localOffset)).toBe(0x04034b50)
    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26)
    entries.push({
      name: zip.subarray(at + 46, at + 46 + nameLength).toString('utf8'),
      flags: zip.readUInt16LE(at + 8),
      method: zip.readUInt16LE(at + 10),
      crc: zip.readUInt32LE(at + 16),
      compressedSize,
      size: zip.readUInt32LE(at + 24),
      data: inflateRawSync(zip.subarray(dataStart, dataStart + compressedSize))
    })
    at += 46 + nameLength
  }
  return entries
}
