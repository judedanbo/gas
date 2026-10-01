import { test, expect } from '@playwright/test'

/**
 * Content-Security-Policy regression guard (SECURITY-ASSESSMENT.md L-4 + M-1).
 *
 * L-4: `img-src` must keep `data:`. @nuxt/icon renders icons in CSS mode as
 *      `data:image/svg+xml` URIs, so dropping `data:` silently blocks ~40 icons
 *      site-wide (the original L-4 regression). This guard fails if that happens.
 * M-1: `script-src` must stay nonce-based with no `'unsafe-inline'` / `'unsafe-eval'`.
 *      The header assertion below also fails if those are ever reintroduced.
 *
 * The pages below exercise header + footer + content icons. The header/footer render
 * without any DB-backed data, so this guard does not depend on seeded content.
 */

// Substring present in every Chromium CSP-violation console message. Matching this
// (rather than all console errors) keeps the test stable against pre-existing,
// unrelated noise observed in this app (`_payload.json` 404s, hydration mismatches).
const CSP_VIOLATION = /content security policy/i

const targetPages = [
  { path: '/', name: 'Homepage' },
  { path: '/contact', name: 'Contact' }
]

/** Parse a CSP header string into a { directive: value } map. */
function parseCsp(csp: string): Record<string, string> {
  const directives: Record<string, string> = {}
  for (const part of csp.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const firstSpace = trimmed.indexOf(' ')
    const name = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)
    directives[name] = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1)
  }
  return directives
}

test.describe('Content Security Policy', () => {
  for (const { path, name } of targetPages) {
    test(`${name} (${path}) — CSP header keeps img-src data: and a nonce-only script-src`, async ({
      page
    }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
      const csp = response?.headers()['content-security-policy'] ?? ''
      expect(csp, 'Content-Security-Policy header should be present').not.toBe('')

      const directives = parseCsp(csp)

      // L-4 — icons depend on data: URIs
      expect(directives['img-src'], 'img-src directive should be present').toBeTruthy()
      expect(directives['img-src']).toContain('data:')

      // M-1 — nonce-based, no unsafe-inline / unsafe-eval
      expect(directives['script-src'], 'script-src directive should be present').toBeTruthy()
      expect(directives['script-src']).toContain("'nonce-")
      expect(directives['script-src']).not.toContain("'unsafe-inline'")
      expect(directives['script-src']).not.toContain("'unsafe-eval'")

      // The PDF reader frames the file it downloaded (with progress) via a blob: URL
      expect(directives['frame-src'], 'frame-src directive should be present').toBeTruthy()
      expect(directives['frame-src']).toContain('blob:')
    })

    // Production serves these pages from the page cache (server/plugins/pageCache.ts):
    // the second request is a cache hit, which must still get its own nonce, in the
    // header and on every nonce'd tag, rather than the one baked in at render time.
    test(`${name} (${path}) — every response gets a fresh nonce matching its HTML`, async ({
      request
    }) => {
      const nonces: string[] = []
      for (let i = 0; i < 2; i++) {
        const response = await request.get(path)
        expect(response.ok()).toBe(true)

        const csp = response.headers()['content-security-policy'] ?? ''
        const nonce = /'nonce-([^']+)'/.exec(csp)?.[1]
        expect(nonce, 'script-src should carry a nonce').toBeTruthy()

        const html = await response.text()
        const tagNonces = new Set([...html.matchAll(/\snonce="([^"]+)"/g)].map((m) => m[1]))
        expect([...tagNonces]).toEqual([nonce])
        nonces.push(nonce!)
      }
      expect(nonces[1]).not.toBe(nonces[0])
    })

    test(`${name} (${path}) — renders with no CSP violations`, async ({ page }) => {
      const violations: string[] = []
      page.on('console', (msg) => {
        if (CSP_VIOLATION.test(msg.text())) violations.push(msg.text())
      })

      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle')

      expect(violations, `Unexpected CSP violations:\n${violations.join('\n')}`).toEqual([])
    })
  }
})
