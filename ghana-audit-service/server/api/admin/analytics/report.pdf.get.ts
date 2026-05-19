import { z } from 'zod'
import { withPage } from '../../../utils/pdf/browser'
import { signPdfToken, type PdfWindow } from '../../../utils/analytics/pdfToken'
import { logAuditAction } from '../../../utils/auditLogger'

/**
 * Generate a unified analytics PDF report.
 *
 * Flow:
 *   1. adminAuth middleware has already validated the admin Bearer token
 *      and attached event.context.auth.
 *   2. We mint a 60s, single-use PDF token carrying the admin's userId/sid.
 *   3. We launch a Puppeteer page on loopback pointing at the report page
 *      with ?pdfToken=... — the page exchanges it for a 5-min session JWT
 *      so all subsequent /api/admin/analytics/* fetches inside the headless
 *      tab are authenticated normally.
 *   4. We wait for window.__reportReady (set by the page once all
 *      sections + charts have rendered), then capture as A4 PDF.
 */

const querySchema = z.object({
  window: z.enum(['24h', '7d', '30d']).default('7d')
})

const REPORT_READY_TIMEOUT_MS = 30_000
const NETWORK_IDLE_MS = 500

function reportBaseUrl(): string {
  const host = process.env.NITRO_HOST || process.env.HOST || '127.0.0.1'
  const port = process.env.NITRO_PORT || process.env.PORT || '3000'
  // Always talk to ourselves on loopback. Don't trust NITRO_HOST literally
  // if it's a wildcard; resolve it to a loopback address.
  const safeHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host
  return `http://${safeHost}:${port}`
}

function pdfFilename(window: PdfWindow): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `gas-analytics-${window}-${stamp}.pdf`
}

function headerTemplate(window: PdfWindow, email: string): string {
  // Puppeteer's header/footer is rendered in an isolated frame with a tiny
  // default font; inline styles only.
  return `
    <div style="font-size:8px; color:#374151; width:100%; padding:4px 10mm; display:flex; justify-content:space-between; font-family: sans-serif;">
      <span>Ghana Audit Service — Analytics Report (${window})</span>
      <span>${email.replace(/</g, '&lt;')}</span>
    </div>
  `
}

function footerTemplate(): string {
  return `
    <div style="font-size:8px; color:#6b7280; width:100%; padding:4px 10mm; display:flex; justify-content:space-between; font-family: sans-serif;">
      <span>Generated <span class="date"></span></span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
  `
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: parsed.error.issues[0].message
    })
  }
  const window: PdfWindow = parsed.data.window

  const { token: pdfToken } = await signPdfToken({
    userId: auth.user.id,
    sid: auth.sessionId,
    window
  })

  const url =
    `${reportBaseUrl()}/admin/analytics/report` +
    `?pdfToken=${encodeURIComponent(pdfToken)}&window=${window}&print=1`

  const pdf = await withPage(async (page) => {
    await page.emulateMediaType('print')
    page.setDefaultNavigationTimeout(REPORT_READY_TIMEOUT_MS)
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 })

    await page.goto(url, { waitUntil: 'networkidle2', timeout: REPORT_READY_TIMEOUT_MS })

    await page.waitForFunction('window.__reportReady === true', {
      timeout: REPORT_READY_TIMEOUT_MS,
      polling: 250
    })

    // Belt-and-braces: idle the network briefly so any in-flight image
    // or font request settles before we snapshot.
    await page.waitForNetworkIdle({ idleTime: NETWORK_IDLE_MS, timeout: 5000 }).catch(() => {
      /* not fatal — __reportReady is the source of truth */
    })

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: headerTemplate(window, auth.user.email),
      footerTemplate: footerTemplate(),
      margin: { top: '18mm', bottom: '18mm', left: '10mm', right: '10mm' }
    })
  })

  await logAuditAction(event, 'export', 'analytics_report', null, {
    window,
    bytes: pdf.length
  })

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Length', pdf.length)
  setHeader(event, 'Content-Disposition', `attachment; filename="${pdfFilename(window)}"`)
  setHeader(event, 'Cache-Control', 'no-store')

  return pdf
})
