import puppeteer, { type Browser, type Page } from 'puppeteer-core'

/**
 * Singleton headless Chromium for server-side PDF rendering.
 *
 * One browser per Nitro process; each call to withPage() opens a fresh
 * incognito context, runs the caller, and closes the context. A semaphore
 * keeps concurrency bounded, and the browser is recycled after a soft
 * lifetime cap to keep memory in check on long-running processes.
 *
 * Local dev / prod containers must point PUPPETEER_EXECUTABLE_PATH at a
 * system Chromium binary (e.g. /usr/bin/chromium-browser on Alpine).
 */

const MAX_BROWSER_USES = 50
const MAX_BROWSER_AGE_MS = 30 * 60 * 1000
const MAX_CONCURRENT = 2

let browserPromise: Promise<Browser> | null = null
let browserUses = 0
let browserBornAt = 0

const queue: Array<() => void> = []
let active = 0

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++
    return
  }
  await new Promise<void>((resolve) => queue.push(resolve))
  active++
}

function release(): void {
  active--
  const next = queue.shift()
  if (next) next()
}

function getExecutablePath(): string {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim()
  if (fromEnv) return fromEnv
  throw new Error(
    'PUPPETEER_EXECUTABLE_PATH is not set. Point it at a system Chromium binary (e.g. /usr/bin/chromium-browser).'
  )
}

async function launchBrowser(): Promise<Browser> {
  const browser = await puppeteer.launch({
    executablePath: getExecutablePath(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none'
    ]
  })
  browserUses = 0
  browserBornAt = Date.now()
  return browser
}

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const stale =
      browserUses >= MAX_BROWSER_USES || Date.now() - browserBornAt >= MAX_BROWSER_AGE_MS
    if (!stale) return browserPromise

    const stale_p = browserPromise
    browserPromise = null
    stale_p
      .then((b) => b.close())
      .catch(() => {
        /* best effort */
      })
  }

  browserPromise = launchBrowser()
  return browserPromise
}

export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  await acquire()
  try {
    const browser = await getBrowser()
    browserUses++
    const context = await browser.createBrowserContext()
    try {
      const page = await context.newPage()
      return await fn(page)
    } finally {
      await context.close().catch(() => {
        /* best effort */
      })
    }
  } finally {
    release()
  }
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return
  const p = browserPromise
  browserPromise = null
  try {
    const b = await p
    await b.close()
  } catch {
    /* best effort */
  }
}
