/**
 * HTML sanitization for CMS-authored rich text.
 *
 * Content edited in the admin TipTap editor is stored as raw HTML and rendered
 * on public pages via `v-html`. Even though authors are authenticated, that HTML
 * must be sanitized before it reaches a visitor's browser — a compromised admin
 * account or a malformed payload should never be able to inject executable markup.
 *
 * Uses `isomorphic-dompurify` so the same call works during SSR (jsdom) and on the
 * client (native DOM). We keep DOMPurify's well-vetted default allowlist rather than
 * a hand-rolled one, and add a single hardening rule: any link opening in a new tab
 * gets `rel="noopener noreferrer"` to prevent reverse tabnabbing via `window.opener`.
 */
import DOMPurify from 'isomorphic-dompurify'

// Harden links that open in a new tab. addHook is idempotent per hook name + fn,
// but registering once at module load keeps it from stacking on repeated imports.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/**
 * Sanitize a CMS HTML string for safe rendering via `v-html`.
 * Returns an empty string for nullish input so callers can bind it directly.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return ''
  // ADD_ATTR keeps `target` through the allowlist pass so the afterSanitizeAttributes
  // hook above can see `target="_blank"` and attach a safe `rel`.
  return DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true }, ADD_ATTR: ['target'] })
}
