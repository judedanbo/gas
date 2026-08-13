/**
 * Flatten CMS rich text to plain text.
 *
 * Content authored in the admin TipTap editor is stored as HTML. Pages that can
 * render markup use `v-html` + `sanitizeHtml()`, but plenty of surfaces cannot:
 * card teasers, `line-clamp`ed excerpts, `<meta>` descriptions and JSON-LD. Those
 * render through Vue interpolation, which escapes the markup — so without this the
 * reader sees literal `<p>` / `<strong>` tags instead of the prose.
 *
 * Shared by client components and the server-side `transform*` DTO shapers, so an
 * excerpt reads the same wherever it was built.
 *
 * Deliberately parses rather than regex-strips. Hand-rolled `replace(/<[^>]*>/g, '')`
 * filters — which this replaced in four places — are defeated by malformed markup
 * such as `<<script>script>`, where removing the inner match reassembles a live tag.
 * DOMPurify is already a dependency (see `sanitizeHtml.ts`) and works under SSR and
 * in the browser, so the parse is the same one the browser would do.
 */
import DOMPurify from 'isomorphic-dompurify'

/**
 * Elements the browser lays out as a break. Their boundaries become a space, because
 * dropping tags outright turns `<p>One</p><p>Two</p>` into "OneTwo". Inline elements
 * are deliberately absent so mid-word emphasis like `end<em>ing</em>` stays "ending".
 */
const BLOCK_ELEMENTS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'BR',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TR',
  'UL'
])

const ELEMENT_NODE = 1
const TEXT_NODE = 3

function collectText(node: Node, out: string[]): void {
  if (node.nodeType === TEXT_NODE) {
    out.push(node.nodeValue ?? '')
    return
  }
  if (node.nodeType !== ELEMENT_NODE) return

  const isBlock = BLOCK_ELEMENTS.has((node as Element).tagName)
  if (isBlock) out.push(' ')
  for (const child of Array.from(node.childNodes)) collectText(child, out)
  if (isBlock) out.push(' ')
}

/**
 * Convert an HTML (or already-plain) string to single-spaced plain text.
 * Entities are resolved by the parser, so `&amp;` arrives as a literal `&` and does
 * not double-escape when Vue escapes the result on render.
 * Returns `''` for nullish input so callers can bind the result directly.
 */
export function htmlToPlainText(input: string | null | undefined): string {
  if (!input) return ''

  // Plenty of stored content is already plain — a string with no `<` and no `&` has
  // neither markup nor entities, so parsing it could only collapse whitespace. Skip
  // the parse; these run per item on list endpoints.
  if (!input.includes('<') && !input.includes('&')) {
    return input.replace(/\s+/g, ' ').trim()
  }

  // Scripting and styling are dropped with their content by the html profile, so
  // `<script>` bodies never surface as prose.
  const fragment = DOMPurify.sanitize(input, {
    USE_PROFILES: { html: true },
    RETURN_DOM_FRAGMENT: true
  })

  const parts: string[] = []
  for (const child of Array.from(fragment.childNodes)) collectText(child, parts)

  return parts.join('').replace(/\s+/g, ' ').trim()
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
