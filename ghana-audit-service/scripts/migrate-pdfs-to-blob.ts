/**
 * One-off migration: upload the on-disk report PDFs (public/pdf/**) to Azure
 * Blob Storage so the container image no longer has to ship them.
 *
 * Idempotent — skips blobs that already exist, so it is safe to re-run (e.g.
 * after adding more reports, or if a previous run was interrupted).
 *
 * Usage (from ghana-audit-service/):
 *   AZURE_STORAGE_CONNECTION_STRING=... AZURE_BLOB_CONTAINER=reports \
 *     npx tsx --env-file=.env scripts/migrate-pdfs-to-blob.ts [sourceDir]
 *
 * sourceDir defaults to "public/pdf". Blob keys are derived from the path
 * relative to "public/" (e.g. public/pdf/reports/x.pdf -> pdf/reports/x.pdf),
 * matching the keys the download endpoints derive from the stored fileUrl.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { isBlobStorageConfigured, blobExists, uploadBlob } from '../server/utils/blobStorage'

const PUBLIC_DIR = 'public'
const sourceDir = process.argv[2] || join(PUBLIC_DIR, 'pdf')

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) yield full
  }
}

async function main() {
  if (!isBlobStorageConfigured()) {
    console.error(
      'Blob storage is not configured. Set AZURE_STORAGE_CONNECTION_STRING and AZURE_BLOB_CONTAINER.'
    )
    process.exit(1)
  }

  let uploaded = 0
  let skipped = 0
  let bytes = 0

  for await (const filePath of walk(sourceDir)) {
    // Key = path relative to public/, with forward slashes.
    const key = relative(PUBLIC_DIR, filePath).split(sep).join('/')

    if (await blobExists(key)) {
      skipped++
      console.log(`skip   ${key} (already in container)`)
      continue
    }

    const { size } = await stat(filePath)
    const data = await readFile(filePath)
    await uploadBlob(key, data, 'application/pdf')
    uploaded++
    bytes += size
    console.log(`upload ${key} (${(size / 1024 / 1024).toFixed(1)} MB)`)
  }

  console.log(
    `\nDone. Uploaded ${uploaded}, skipped ${skipped}, ${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB transferred.`
  )
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
