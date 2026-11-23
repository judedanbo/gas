import type { H3Event } from 'h3'
import { performance } from 'node:perf_hooks'
import { getHeader } from 'h3'
import { getDatabase } from '../../database'
import { downloadEvents } from '../../database/schema/analytics'
import { getClientIP } from '../rateLimiter'
import { hashIp, hashUa, classifyUa } from './fingerprint'
import { getGeoIp } from './geoip'

type DownloadKind = 'report' | 'publication'

/**
 * Who is downloading, resolved while the request is still in scope. Reuses the
 * hashes + geo from the capture middleware when available; falls back to
 * recomputing if this handler somehow runs without it (e.g. a future call
 * site that bypasses the middleware skip-list).
 */
function downloadFingerprint(event: H3Event) {
  const ua = getHeader(event, 'user-agent') || ''
  const stash = event.context.analytics
  const fallbackGeo = stash ? null : getGeoIp(getClientIP(event))
  return {
    ipHash: stash?.ipHash ?? hashIp(getClientIP(event)),
    // When the capture middleware ran, honour whatever it stored (which already
    // applies the /citizenseye carve-out, possibly null). Only recompute the raw
    // IP on the fallback path where no stash exists (downloads are never anonymised).
    ip: stash ? stash.ip : getClientIP(event),
    uaHash: stash?.uaHash ?? hashUa(ua),
    uaFamily: stash?.uaFamily ?? classifyUa(ua).family,
    country: stash?.country ?? fallbackGeo?.country ?? null,
    asn: stash?.asn ?? fallbackGeo?.asn ?? null
  }
}

/**
 * Register a response 'close' hook on the event that, once the file stream
 * has finished, writes a row to download_events. The capture middleware
 * already records a generic request_events row; this is the deeper
 * forensic log specifically for downloads (longer retention, link to
 * report/publication target).
 *
 * Failures are swallowed and logged. download_events is best-effort: we
 * never want analytics to break a user's PDF download.
 */
export function recordDownload(
  event: H3Event,
  opts: { kind: DownloadKind; targetId: number; slug?: string | null }
): void {
  const start = performance.now()
  const isPartial = !!getHeader(event, 'range')
  const who = downloadFingerprint(event)

  event.node.res.on('close', () => {
    void (async () => {
      try {
        const durationMs = Math.max(0, Math.round(performance.now() - start))
        const contentLen = event.node.res.getHeader('content-length')
        const bytesOut =
          typeof contentLen === 'string'
            ? Math.max(0, parseInt(contentLen, 10) || 0)
            : typeof contentLen === 'number'
              ? Math.max(0, contentLen)
              : 0

        const db = getDatabase()
        await db.insert(downloadEvents).values({
          kind: opts.kind,
          targetId: opts.targetId,
          slug: opts.slug ? opts.slug.slice(0, 256) : null,
          durationMs,
          bytesOut,
          isPartial,
          ...who,
          isBot: null
        })
      } catch (err) {
        console.warn('[analytics/download] insert failed:', (err as Error).message)
      }
    })()
  })
}

export interface DeliveredDownload {
  targetId: number
  slug?: string | null
  /** Size of the file that was sent. */
  bytes: number
  /** Time spent sending this file. */
  durationMs: number
}

/**
 * recordDownload() for a response that carries several files (a bulk ZIP).
 * When the response closes, writes one download_events row per file that was
 * sent in full, so per-report download counts stay the same whether a report
 * was fetched on its own or inside an archive. `delivered` is read at close
 * time: files the visitor never received (they cancelled, or the archive
 * failed part-way) are simply not in it.
 */
export function recordBulkDownload(
  event: H3Event,
  opts: { kind: DownloadKind; delivered: () => DeliveredDownload[] }
): void {
  const who = downloadFingerprint(event)

  event.node.res.on('close', () => {
    void (async () => {
      try {
        const files = opts.delivered()
        if (files.length === 0) return

        const db = getDatabase()
        await db.insert(downloadEvents).values(
          files.map((file) => ({
            kind: opts.kind,
            targetId: file.targetId,
            slug: file.slug ? file.slug.slice(0, 256) : null,
            durationMs: Math.max(0, Math.round(file.durationMs)),
            bytesOut: Math.max(0, Math.round(file.bytes)),
            isPartial: false,
            ...who,
            isBot: null
          }))
        )
      } catch (err) {
        console.warn('[analytics/download] bulk insert failed:', (err as Error).message)
      }
    })()
  })
}
