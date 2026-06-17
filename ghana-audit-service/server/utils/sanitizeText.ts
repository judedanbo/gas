import DOMPurify from 'isomorphic-dompurify'

/**
 * Reduce an untrusted free-text field to safe plain text.
 *
 * Strips ALL HTML — tags and the content of dangerous elements like
 * `<script>` — but keeps the human-readable text. Crucially it returns the
 * DOM fragment's `textContent` (literal characters) rather than DOMPurify's
 * serialized HTML, so the result is NOT entity-encoded. That makes the stored
 * value safe under any render path (including a future raw-HTML render) while
 * still rendering correctly through consumers that escape on output (Vue
 * interpolation, the email `escapeHtml`) — i.e. no double-escaping of `&`/`<`/`'`.
 */
export function stripHtmlToText(input: string | null | undefined): string {
  if (!input) return ''
  const fragment = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_DOM_FRAGMENT: true
  })
  return (fragment.textContent ?? '').trim()
}
