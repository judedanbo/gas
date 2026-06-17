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
