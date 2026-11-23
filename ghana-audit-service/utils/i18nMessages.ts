/**
 * Helpers for working with interface messages as flat `dotted.key → text`
 * maps — the shape the admin translation editor and the `ui_translations`
 * table use — and for converting to and from the nested shape of
 * `i18n/locales/*.json`. Shared by the server and the admin pages.
 */
export type FlatMessages = Record<string, string>
export interface NestedMessages {
  [key: string]: string | NestedMessages
}

/** Nested messages → flat map. Non-string leaves (arrays, numbers) are skipped. */
export function flattenMessages(messages: unknown, prefix = '', out: FlatMessages = {}) {
  if (!messages || typeof messages !== 'object' || Array.isArray(messages)) return out
  for (const [key, value] of Object.entries(messages as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out[path] = value
    else flattenMessages(value, path, out)
  }
  return out
}

const UNSAFE_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

/** Flat map → nested messages. Keys that would collide with a parent are dropped. */
export function unflattenMessages(flat: FlatMessages): NestedMessages {
  const root: NestedMessages = {}
  for (const [path, value] of Object.entries(flat)) {
    const segments = path.split('.')
    if (segments.some((segment) => !segment || UNSAFE_SEGMENTS.has(segment))) continue

    let node = root
    let blocked = false
    for (const segment of segments.slice(0, -1)) {
      const next = node[segment]
      if (next === undefined) {
        const child: NestedMessages = {}
        node[segment] = child
        node = child
      } else if (typeof next === 'string') {
        blocked = true
        break
      } else {
        node = next
      }
    }
    const leaf = segments[segments.length - 1]
    if (!blocked && typeof node[leaf] !== 'object') node[leaf] = value
  }
  return root
}

/** The `{named}` placeholders in a message, sorted and de-duplicated. */
export function messagePlaceholders(message: string): string[] {
  const names = new Set<string>()
  for (const match of message.matchAll(/\{\s*([A-Za-z0-9_.-]+)\s*\}/g)) names.add(match[1])
  return [...names].sort()
}

/**
 * Placeholders the English text has that the translation lacks, and the other
 * way round. A translation that drops `{count}` silently loses the number; one
 * that invents `{total}` renders a blank.
 */
export function placeholderMismatch(source: string, translation: string) {
  const expected = messagePlaceholders(source)
  const actual = messagePlaceholders(translation)
  return {
    missing: expected.filter((name) => !actual.includes(name)),
    unknown: actual.filter((name) => !expected.includes(name))
  }
}

/**
 * Characters vue-i18n treats as syntax. A stray one makes the message fail to
 * compile, which would surface as an error on the public page that uses it —
 * so saves are rejected rather than stored.
 *
 *  - `{` / `}` must form `{name}` placeholders;
 *  - `@` starts a linked message (`@:other.key`), which the site doesn't use;
 *  - `|` separates plural forms and is only allowed where English has it too.
 *
 * Returns a human-readable problem, or null when the text is safe to store.
 */
export function messageSyntaxProblem(translation: string, source = ''): string | null {
  const withoutPlaceholders = translation.replace(/\{\s*[A-Za-z0-9_.-]+\s*\}/g, '')
  if (/[{}]/.test(withoutPlaceholders)) {
    return 'Curly braces may only be used for placeholders such as {count}.'
  }
  if (translation.includes('@') && !source.includes('@')) {
    return 'The @ character has a special meaning here and cannot be used.'
  }
  if (translation.includes('|') && !source.includes('|')) {
    return 'The | character separates plural forms and cannot be used in this text.'
  }
  return null
}
