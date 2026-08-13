import { htmlToPlainText } from './htmlToPlainText'

export interface BioSection {
  heading: string | null
  /** HTML when `isHtml` is true (render via `v-html` + `sanitizeHtml`), else plain text. */
  content: string
  /** Whether `content` carries markup. Drives the render path on profile pages. */
  isHtml: boolean
}

/**
 * Bios arrive in two formats and both are live in the database:
 *
 * - **Plain text** with `## Heading` markers — what the seeds write.
 * - **HTML** — what the admin TipTap editor saves (`<p>`, `<ul>`, `<strong>`, `<a>`).
 *
 * The HTML flavour has no `## ` markers, so it used to fall through as a single
 * plain-text section and got escaped by `{{ }}`, showing raw tags to the reader.
 * Sniff the format and tell the caller which render path to take.
 */
export function parseBioSections(bio: string): BioSection[] {
  if (!bio.trim()) return []

  return looksLikeHtml(bio) ? parseHtmlSections(bio) : parsePlainTextSections(bio)
}

/**
 * True when the string carries real markup. Requires a recognisable tag rather than
 * a bare `<`, so a plain-text bio containing "audits < 5% of entities" stays plain.
 */
function looksLikeHtml(bio: string): boolean {
  return /<(?:[a-z][a-z0-9-]*)(?:\s[^>]*)?\/?>/i.test(bio)
}

function parsePlainTextSections(bio: string): BioSection[] {
  const [preamble, ...rest] = bio.split(/^## /m)
  const sections: BioSection[] = []

  if (preamble.trim()) {
    sections.push({ heading: null, content: preamble.trim(), isHtml: false })
  }

  for (const part of rest) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const newlineIndex = trimmed.indexOf('\n')
    if (newlineIndex === -1) continue
    const heading = trimmed.slice(0, newlineIndex).trim()
    const content = trimmed.slice(newlineIndex + 1).trim()
    if (!content) continue
    sections.push({ heading, content, isHtml: false })
  }

  return sections
}

/** `<h1>`–`<h4>` blocks, used as section breaks the same way `## ` is in plain text. */
const HTML_HEADING = /<h([1-4])(?:\s[^>]*)?>([\s\S]*?)<\/h\1\s*>/gi

/**
 * Split HTML on heading elements so imported content keeps the sectioned card layout.
 *
 * The admin editor runs StarterKit with `heading: false`, so bios authored there have
 * no headings and collapse to one untitled section — which is the correct result, not
 * a fallback. Headings only appear in migrated/pasted content.
 */
function parseHtmlSections(bio: string): BioSection[] {
  const sections: BioSection[] = []
  let cursor = 0
  let pendingHeading: string | null = null

  HTML_HEADING.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = HTML_HEADING.exec(bio)) !== null) {
    pushHtmlSection(sections, pendingHeading, bio.slice(cursor, match.index))
    pendingHeading = htmlToPlainText(match[2]) || null
    cursor = match.index + match[0].length
  }

  pushHtmlSection(sections, pendingHeading, bio.slice(cursor))

  return sections
}

/**
 * Append a section, dropping any whose body is only markup (e.g. the empty `<p></p>`
 * TipTap leaves behind). A heading with no body would render as a bare card title.
 */
function pushHtmlSection(sections: BioSection[], heading: string | null, content: string): void {
  const trimmed = content.trim()
  if (!trimmed || !htmlToPlainText(trimmed)) return
  sections.push({ heading, content: trimmed, isHtml: true })
}
