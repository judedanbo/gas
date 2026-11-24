/**
 * Audit Service apps and websites (CitizensEye, the Recommendations Tracker, …).
 *
 * Each app is a row in `service_apps` managed at /admin/apps. It gets a landing
 * page at a top-level address (`/citizenseye`, `/tracker`) served by
 * pages/[slug].vue, and a card on the /apps hub. The landing page is built from
 * the fields below plus five optional sections; a section with no items is not
 * shown.
 *
 * Shared by the server (validation, transforms) and the client (admin form,
 * public pages) — keep it free of runtime imports other than the catalogue.
 */
import { CATALOG_CODES, DEFAULT_LANGUAGE_CODE } from './languageCatalog'

// ── Addresses ──────────────────────────────────────────────────────────────

export const APP_SLUG_MAX_LENGTH = 60

/** Lowercase words joined by single hyphens: `citizenseye`, `e-tracker`. */
export const APP_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Top-level addresses an app cannot take, because something else already
 * answers there: a page in pages/ (a file, or a folder with an index page), a
 * server route, a folder in public/, or a language prefix. Keep in step with
 * those — tests/unit/utils/serviceApps.test.ts fails when a new top-level page
 * or public folder is not listed here.
 *
 * `citizenseye` is deliberately absent: pages/citizenseye/ only holds the
 * privacy notice, and /citizenseye itself is the CitizensEye app's page.
 */
export const RESERVED_APP_SLUGS: readonly string[] = [
  // pages/
  'about',
  'accessibility',
  'admin',
  'advertisement',
  'apps',
  'careers',
  'contact',
  'index',
  'media',
  'privacy-policy',
  'publications',
  'reports',
  'search',
  'terms',
  // server routes and build output
  'api',
  'healthz',
  'readyz',
  'uploads',
  // public/
  'images',
  'img',
  'pwa-icons',
  'pdf'
]

/** Why `slug` can't be used as an app address, or null when it can. */
export function appSlugProblem(slug: string): string | null {
  if (!slug) return 'Enter an address'
  if (slug.length > APP_SLUG_MAX_LENGTH) {
    return `Use at most ${APP_SLUG_MAX_LENGTH} characters`
  }
  if (!APP_SLUG_PATTERN.test(slug)) {
    return 'Use lowercase letters, numbers and single hyphens only (e.g. citizenseye)'
  }
  if (RESERVED_APP_SLUGS.includes(slug)) {
    return `/${slug} is already a page on this website`
  }
  if (slug === DEFAULT_LANGUAGE_CODE || CATALOG_CODES.includes(slug)) {
    return `/${slug} is reserved for a language version of the website`
  }
  return null
}

/** Page address of an app on this site. */
export function appPath(slug: string): string {
  return `/${slug}`
}

// ── Logos ──────────────────────────────────────────────────────────────────

/** Shown for an app that has no logo of its own: the Ghana Audit Service seal. */
export const DEFAULT_APP_LOGO = '/images/logo-no-bg.png'

/** The logo to show for an app: its own when uploaded, otherwise the GAS logo. */
export function appLogoUrl(logoUrl: string | null | undefined): string {
  return logoUrl?.trim() || DEFAULT_APP_LOGO
}

// ── Icons ──────────────────────────────────────────────────────────────────

/**
 * Icons an admin can pick for a section item (a feature, a step, …). A fixed
 * list keeps the choice to icons that are bundled with the site (the names
 * below are plain literals, so the client icon bundle picks them up).
 */
export const APP_ICON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'heroicons:eye', label: 'Eye' },
  { value: 'heroicons:magnifying-glass-circle', label: 'Magnifying glass (circle)' },
  { value: 'heroicons:magnifying-glass', label: 'Magnifying glass' },
  { value: 'heroicons:document-magnifying-glass', label: 'Document search' },
  { value: 'heroicons:clipboard-document-check', label: 'Checklist' },
  { value: 'heroicons:clipboard-document-list', label: 'Clipboard list' },
  { value: 'heroicons:document-text', label: 'Document' },
  { value: 'heroicons:check-badge', label: 'Badge' },
  { value: 'heroicons:check', label: 'Tick' },
  { value: 'heroicons:chart-bar', label: 'Bar chart' },
  { value: 'heroicons:presentation-chart-line', label: 'Line chart' },
  { value: 'heroicons:arrow-trending-up', label: 'Trending up' },
  { value: 'heroicons:arrow-path', label: 'Refresh / follow-up' },
  { value: 'heroicons:table-cells', label: 'Table' },
  { value: 'heroicons:funnel', label: 'Filter' },
  { value: 'heroicons:pencil-square', label: 'Write' },
  { value: 'heroicons:pencil', label: 'Pencil' },
  { value: 'heroicons:paper-clip', label: 'Attachment' },
  { value: 'heroicons:cloud-arrow-up', label: 'Upload' },
  { value: 'heroicons:lock-closed', label: 'Lock' },
  { value: 'heroicons:shield-check', label: 'Shield' },
  { value: 'heroicons:finger-print', label: 'Fingerprint' },
  { value: 'heroicons:map-pin', label: 'Map pin' },
  { value: 'heroicons:globe-alt', label: 'Globe' },
  { value: 'heroicons:bell', label: 'Bell' },
  { value: 'heroicons:megaphone', label: 'Megaphone' },
  { value: 'heroicons:chat-bubble-left-right', label: 'Conversation' },
  { value: 'heroicons:device-phone-mobile', label: 'Phone' },
  { value: 'heroicons:computer-desktop', label: 'Computer' },
  { value: 'heroicons:squares-2x2', label: 'App grid' },
  { value: 'heroicons:user', label: 'Person' },
  { value: 'heroicons:user-group', label: 'People' },
  { value: 'heroicons:building-library', label: 'Government building' },
  { value: 'heroicons:building-office', label: 'Office building' },
  { value: 'heroicons:scale', label: 'Scales of justice' },
  { value: 'heroicons:currency-dollar', label: 'Money' },
  { value: 'heroicons:banknotes', label: 'Banknotes' },
  { value: 'heroicons:light-bulb', label: 'Light bulb' },
  { value: 'heroicons:question-mark-circle', label: 'Question mark' },
  { value: 'heroicons:exclamation-triangle', label: 'Warning' }
]

export function isAppIcon(value: string): boolean {
  return APP_ICON_OPTIONS.some((option) => option.value === value)
}

// ── Page content ───────────────────────────────────────────────────────────

export interface AppFeature {
  icon: string
  title: string
  description: string
}

export interface AppStep {
  /** Optional — an empty string shows the step number alone. */
  icon: string
  title: string
  description: string
}

/** A group of benefits for one audience ("For citizens", "For government"). */
export interface AppAudience {
  icon: string
  title: string
  points: string[]
}

export interface AppHighlight {
  icon: string
  title: string
}

export interface AppFaq {
  question: string
  answer: string
}

export interface AppSection<T> {
  /** Overrides the section's default heading when set. */
  title: string
  /** Short introduction under the heading. */
  intro: string
  items: T[]
}

export interface AppContent {
  features: AppSection<AppFeature>
  steps: AppSection<AppStep>
  audiences: AppSection<AppAudience>
  highlights: AppSection<AppHighlight>
  faqs: AppSection<AppFaq>
}

export type AppSectionKey = keyof AppContent

/** Landing page order. */
export const APP_SECTION_KEYS: readonly AppSectionKey[] = [
  'features',
  'steps',
  'audiences',
  'highlights',
  'faqs'
]

/** Most items a section may hold. */
export const APP_SECTION_LIMITS: Record<AppSectionKey, number> = {
  features: 12,
  steps: 8,
  audiences: 4,
  highlights: 16,
  faqs: 20
}

export const APP_AUDIENCE_MAX_POINTS = 12

export const APP_TEXT_LIMITS = {
  name: 150,
  tagline: 255,
  summary: 500,
  headline: 255,
  body: 20000,
  launchLabel: 100,
  imageAlt: 500,
  ctaTitle: 255,
  ctaText: 500,
  sectionTitle: 255,
  sectionIntro: 1000,
  itemTitle: 150,
  itemText: 1000,
  point: 300,
  question: 300,
  answer: 3000
} as const

/** The text of one language version of an app. */
export interface AppTranslation {
  name: string
  tagline: string
  /** One or two sentences: the hub card, search results and meta description. */
  summary: string
  /** Hero heading on the landing page. */
  headline: string
  /** Hero text (rich text HTML). */
  body: string
  /** Text of the button that opens the app; defaults to "Open {name}". */
  launchLabel: string
  /** Description of the app image, when there is one. */
  imageAlt: string
  ctaTitle: string
  ctaText: string
  content: AppContent
}

export function emptyAppSection<T>(): AppSection<T> {
  return { title: '', intro: '', items: [] }
}

export function emptyAppContent(): AppContent {
  return {
    features: emptyAppSection(),
    steps: emptyAppSection(),
    audiences: emptyAppSection(),
    highlights: emptyAppSection(),
    faqs: emptyAppSection()
  }
}

export function emptyAppTranslation(): AppTranslation {
  return {
    name: '',
    tagline: '',
    summary: '',
    headline: '',
    body: '',
    launchLabel: '',
    imageAlt: '',
    ctaTitle: '',
    ctaText: '',
    content: emptyAppContent()
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    : []
}

function section<T>(value: unknown, item: (raw: Record<string, unknown>) => T): AppSection<T> {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return { title: text(raw.title), intro: text(raw.intro), items: list(raw.items).map(item) }
}

/** True when a language version holds no text at all (nothing to store). */
export function isEmptyAppTranslation(translation: AppTranslation): boolean {
  const { content, ...fields } = translation
  return (
    Object.values(fields).every((value) => !value.trim()) &&
    APP_SECTION_KEYS.every((key) => {
      const section = content[key]
      return !section.title.trim() && !section.intro.trim() && section.items.length === 0
    })
  )
}

/**
 * Read stored page content (a JSON column) into the full shape, filling
 * anything missing with empty values, so older or partial rows still render.
 */
export function normaliseAppContent(raw: unknown): AppContent {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      value = null
    }
  }
  const content = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    features: section(content.features, (r) => ({
      icon: text(r.icon),
      title: text(r.title),
      description: text(r.description)
    })),
    steps: section(content.steps, (r) => ({
      icon: text(r.icon),
      title: text(r.title),
      description: text(r.description)
    })),
    audiences: section(content.audiences, (r) => ({
      icon: text(r.icon),
      title: text(r.title),
      points: Array.isArray(r.points)
        ? r.points.filter((p): p is string => typeof p === 'string')
        : []
    })),
    highlights: section(content.highlights, (r) => ({ icon: text(r.icon), title: text(r.title) })),
    faqs: section(content.faqs, (r) => ({ question: text(r.question), answer: text(r.answer) }))
  }
}

/**
 * Text for one language, with anything it leaves empty taken from English:
 * flat fields one by one, and each section as a whole when the language has no
 * items of its own (a section's heading and introduction fall back the same
 * way). Pass `fallback` = null for English itself.
 */
export function mergeAppTranslation(
  primary: AppTranslation,
  fallback: AppTranslation | null
): AppTranslation {
  if (!fallback) return primary
  const pick = (a: string, b: string) => (a.trim() ? a : b)
  const content = {} as Record<AppSectionKey, AppSection<unknown>>
  for (const key of APP_SECTION_KEYS) {
    const own = primary.content[key] as AppSection<unknown>
    const base = fallback.content[key] as AppSection<unknown>
    content[key] = {
      title: pick(own.title, base.title),
      intro: pick(own.intro, base.intro),
      items: own.items.length > 0 ? own.items : base.items
    }
  }
  return {
    name: pick(primary.name, fallback.name),
    tagline: pick(primary.tagline, fallback.tagline),
    summary: pick(primary.summary, fallback.summary),
    headline: pick(primary.headline, fallback.headline),
    body: pick(primary.body, fallback.body),
    launchLabel: pick(primary.launchLabel, fallback.launchLabel),
    imageAlt: pick(primary.imageAlt, fallback.imageAlt),
    ctaTitle: pick(primary.ctaTitle, fallback.ctaTitle),
    ctaText: pick(primary.ctaText, fallback.ctaText),
    content: content as unknown as AppContent
  }
}
