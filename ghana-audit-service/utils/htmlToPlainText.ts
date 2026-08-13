/**
 * Flatten CMS rich text to plain text.
 *
 * Content authored in the admin TipTap editor is stored as HTML. Pages that can
 * render markup use `v-html` + `sanitizeHtml()`, but plenty of surfaces cannot:
 * card teasers, `line-clamp`ed excerpts, `<meta>` descriptions and JSON-LD. Those
 * render through Vue interpolation, which escapes the markup — so without this the
 * reader sees literal `<p>` / `<strong>` tags instead of the prose.
 *
 * Shared by client components and the server-side `transform*` DTO shapers, so
 * an excerpt reads the same wherever it was built. Deliberately regex-based rather
 * than DOMPurify: the output is plain text that every consumer escapes on render,
 * and these run per-item on cached-but-hot list endpoints.
 *
 * Block-level boundaries become a space, which is the part hand-rolled strippers
 * kept getting wrong — deleting tags outright turns `<p>One</p><p>Two</p>` into
 * "OneTwo". Inline tags (`<strong>`, `<em>`, `<a>`) are removed without a
 * separator so mid-word emphasis like `end<em>ing</em>` survives intact.
 */

/** Closing block tags and `<br>` — the places where the browser would show a break. */
const BLOCK_BOUNDARY =
  /<\/(?:p|div|li|ul|ol|h[1-6]|tr|td|th|blockquote|section|article|header|footer|figcaption|figure|pre|address|dd|dt|dl|table|tbody|thead|tfoot)\s*>|<br\s*\/?>|<hr\s*\/?>/gi

/** Elements whose *content* is markup/scripting, not prose — drop them wholesale. */
const NON_PROSE_ELEMENT = /<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi

/** Named/numeric entities that survive tag removal and must be decoded for display. */
const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”'
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const codePoint =
        entity[1]?.toLowerCase() === 'x'
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10)
      // Ignore anything outside the Unicode range or in the surrogate block —
      // String.fromCodePoint throws on those, and a bad entity shouldn't 500 a page.
      if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return match
      if (codePoint >= 0xd800 && codePoint <= 0xdfff) return match
      return String.fromCodePoint(codePoint)
    }
    const decoded = ENTITIES[entity.toLowerCase()]
    return decoded === undefined ? match : decoded
  })
}

/**
 * Convert an HTML (or already-plain) string to single-spaced plain text.
 * Returns `''` for nullish input so callers can bind the result directly.
 */
export function htmlToPlainText(input: string | null | undefined): string {
  if (!input) return ''
  return decodeEntities(
    input
      .replace(NON_PROSE_ELEMENT, ' ')
      .replace(BLOCK_BOUNDARY, ' ')
      .replace(/<[^>]*>/g, '')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Plain-text excerpt capped at `maxLength`, cut on a word boundary.
 * Appends an ellipsis only when the text was actually shortened.
 */
export function htmlToExcerpt(input: string | null | undefined, maxLength: number): string {
  const text = htmlToPlainText(input)
  if (text.length <= maxLength) return text
  // Trim back to the last whole word so the excerpt never ends mid-word.
  const clipped = text.slice(0, maxLength).replace(/\s+\S*$/, '')
  return `${clipped || text.slice(0, maxLength)}…`
}
