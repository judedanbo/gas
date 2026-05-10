import type { H3Event } from 'h3'
import { performance } from 'node:perf_hooks'
import { getHeader } from 'h3'
import { getDatabase } from '../../database'
import { downloadEvents } from '../../database/schema/analytics'
import { getClientIP } from '../rateLimiter'
import { hashIp, hashUa, classifyUa } from './fingerprint'

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
  opts: { kind: 'report' | 'publication'; targetId: number; slug?: string | null }
): void {
  const start = performance.now()
  const isPartial = !!getHeader(event, 'range')
  const ua = getHeader(event, 'user-agent') || ''
  const stash = event.context.analytics
  const ipHash = stash?.ipHash ?? hashIp(getClientIP(event))
  const uaHash = stash?.uaHash ?? hashUa(ua)
  const uaFamily = stash?.uaFamily ?? classifyUa(ua).family

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
          ipHash,
          uaHash,
          uaFamily,
          country: null,
          asn: null,
          isBot: null
        })
      } catch (err) {
        console.warn('[analytics/download] insert failed:', (err as Error).message)
      }
    })()
  })
}
