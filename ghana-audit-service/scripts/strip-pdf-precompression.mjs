#!/usr/bin/env node
/**
 * Post-build cleanup: remove Nitro's pre-compressed (.gz/.br) siblings of
 * already-compressed binary media from the build output.
 *
 * WHY: Nitro's `compressPublicAssets` compresses every public file whose MIME
 * type is in its hardcoded COMPRESSIBLE_MIMES_RE set — and `application/pdf` is
 * in that set. PDFs are already DEFLATE-compressed internally, so gzip/brotli at
 * max quality produce near-identical-size copies. For this repo's report PDFs
 * (2.6 GB), that tripled the output to ~7.5 GB (original + .gz + .br) for ~0%
 * transfer savings.
 *
 * Report/publication downloads are served through `/api/downloads/**`, which
 * streams the original `.pdf` from disk — it never reads the .gz/.br siblings —
 * so deleting them is safe. Direct static hits to `/pdf/...` simply serve
 * uncompressed (negligible for already-compressed binaries).
 *
 * Nitro exposes no per-extension exclusion for compressPublicAssets, so this
 * runs as a `postbuild` step instead.
 */
import { readdir, stat, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Compressed siblings of these extensions are pure waste — already-compressed
// binaries. (Images like png/jpg/webp aren't in Nitro's compressible set, so
// they're never tripled; .pdf is the only offender today, but listing more
// keeps this robust if media types change.)
const BINARY_EXTS = ['.pdf', '.zip', '.mp4', '.webm', '.woff', '.woff2']
const COMPRESSED_SUFFIXES = ['.gz', '.br']

const publicDir = resolve(process.argv[2] || '.output/public')

if (!existsSync(publicDir)) {
  console.log(`[strip-pdf-precompression] ${publicDir} not found — skipping.`)
  process.exit(0)
}

function isWastefulCompressedSibling(fileName) {
  const suffix = COMPRESSED_SUFFIXES.find((s) => fileName.endsWith(s))
  if (!suffix) return false
  const base = fileName.slice(0, -suffix.length).toLowerCase()
  return BINARY_EXTS.some((ext) => base.endsWith(ext))
}

let removed = 0
let bytesFreed = 0

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full)
    } else if (entry.isFile() && isWastefulCompressedSibling(entry.name)) {
      const { size } = await stat(full)
      await unlink(full)
      removed++
      bytesFreed += size
    }
  }
}

await walk(publicDir)

const mb = (bytesFreed / 1024 / 1024).toFixed(1)
console.log(
  `[strip-pdf-precompression] removed ${removed} compressed binary sibling(s), freed ${mb} MB from ${publicDir}`
)
