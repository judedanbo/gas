/**
 * Human-readable byte size for the admin UI (1.5 KB / 3.2 MB / 1.1 GB).
 * Client-side counterpart of server/utils/fileSize.ts (which parses the
 * mixed string formats stored in the DB back into bytes).
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
