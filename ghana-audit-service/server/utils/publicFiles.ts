import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Resolve a public-facing URL (e.g. `/uploads/reports/abc.pdf`) to the
 * absolute filesystem path that corresponds to it. Returns null if the path
 * cannot be resolved or if it is suspicious (path traversal).
 *
 * Tries dev (`<cwd>/public`) and production (`<cwd>/.output/public`) layouts.
 */
export function resolvePublicAsset(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null

  // Strip query/hash, leading slashes; reject any traversal.
  const cleaned = publicUrl.split('?')[0].split('#')[0].replace(/^\/+/, '')
  if (!cleaned || cleaned.includes('..')) return null

  const candidates = [
    resolve(process.cwd(), 'public', cleaned),
    resolve(process.cwd(), '.output', 'public', cleaned)
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}
