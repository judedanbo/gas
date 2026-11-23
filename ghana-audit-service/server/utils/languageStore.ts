/**
 * Site languages and admin-entered interface translations.
 *
 * English is built in and always on. Every other language is a row in
 * `languages` (added from the catalogue in utils/languageCatalog.ts) and is
 * only public while `isEnabled` is set. Interface text for a language is its
 * bundled file (Akan only), overlaid with the `ui_translations` rows entered
 * at /admin/languages; anything still missing falls back to English.
 *
 * The public lookups run on every page request (the locale gate middleware,
 * the language switcher, the message overlay), so they are answered from a
 * short per-process cache. A change made in the admin panel is immediate on
 * the pod that handled it and reaches the others within CACHE_TTL_MS.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { logError } from './logger'
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CATALOG,
  catalogLanguage,
  type CatalogLanguage
} from '../../utils/languageCatalog'
import {
  flattenMessages,
  unflattenMessages,
  type FlatMessages,
  type NestedMessages
} from '../../utils/i18nMessages'
import enMessages from '../../i18n/locales/en.json'
import akMessages from '../../i18n/locales/ak.json'

export const LANGUAGE_CACHE_TTL_MS = 30_000

/** A language as the public site sees it. */
export interface SiteLanguage {
  code: string
  name: string
  nativeName: string
  dir: 'ltr' | 'rtl'
  isDefault: boolean
}

export interface AdminLanguage extends SiteLanguage {
  isEnabled: boolean
  /** Ships a bundled message file, so it has text before anything is entered. */
  hasBundledMessages: boolean
  /** Message keys with a translation (bundled or entered). */
  translated: number
  /** Message keys in total (the English set). */
  total: number
  /** Translations entered in the admin panel. */
  overrides: number
  updatedAt: string | null
}

export interface TranslationEntry {
  key: string
  /** English text. */
  source: string
  /** Text from the language's bundled file, if it has one. */
  bundled: string | null
  /** Text entered in the admin panel; wins over `bundled`. */
  override: string | null
}

const DEFAULT_SITE_LANGUAGE: SiteLanguage = {
  code: DEFAULT_LANGUAGE.code,
  name: DEFAULT_LANGUAGE.name,
  nativeName: DEFAULT_LANGUAGE.nativeName,
  dir: DEFAULT_LANGUAGE.dir,
  isDefault: true
}

/** English messages as a flat map — the set of keys a language can translate. */
export const SOURCE_MESSAGES: FlatMessages = flattenMessages(enMessages)

const BUNDLED_MESSAGES: Record<string, FlatMessages> = {
  ak: flattenMessages(akMessages)
}

/** Bundled translations for a language, limited to keys English still has. */
export function bundledMessages(code: string): FlatMessages {
  const bundled = BUNDLED_MESSAGES[code]
  if (!bundled) return {}
  const out: FlatMessages = {}
  for (const key of Object.keys(SOURCE_MESSAGES)) {
    if (bundled[key]) out[key] = bundled[key]
  }
  return out
}

function toSiteLanguage(
  row: { code: string; name: string; nativeName: string },
  catalog: CatalogLanguage
): SiteLanguage {
  return {
    code: row.code,
    name: row.name,
    nativeName: row.nativeName,
    dir: catalog.dir,
    isDefault: false
  }
}

// ── Cached public lookups ────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T
  expires: number
}

let siteLanguagesCache: CacheEntry<SiteLanguage[]> | null = null
let siteLanguagesPending: Promise<SiteLanguage[]> | null = null
const overridesCache = new Map<string, CacheEntry<NestedMessages>>()

export function invalidateLanguageCache() {
  siteLanguagesCache = null
  siteLanguagesPending = null
  overridesCache.clear()
}

/**
 * English plus every enabled language, in display order.
 *
 * Never throws: if the database can't be read, the last known answer is kept
 * and, failing that, the site is English-only — a language is public only
 * when we positively know an admin switched it on.
 */
export async function getSiteLanguages(): Promise<SiteLanguage[]> {
  // Build-time prerendering has no database; those pages are English.
  if (import.meta.prerender) return [DEFAULT_SITE_LANGUAGE]

  const now = Date.now()
  if (siteLanguagesCache && siteLanguagesCache.expires > now) return siteLanguagesCache.value
  if (siteLanguagesPending) return siteLanguagesPending

  siteLanguagesPending = (async () => {
    try {
      const rows = await getDatabase()
        .select({
          code: schema.languages.code,
          name: schema.languages.name,
          nativeName: schema.languages.nativeName
        })
        .from(schema.languages)
        .where(eq(schema.languages.isEnabled, true))
        .orderBy(asc(schema.languages.sortOrder), asc(schema.languages.code))

      const value = [DEFAULT_SITE_LANGUAGE]
      for (const row of rows) {
        const catalog = catalogLanguage(row.code)
        if (catalog) value.push(toSiteLanguage(row, catalog))
      }
      siteLanguagesCache = { value, expires: Date.now() + LANGUAGE_CACHE_TTL_MS }
      return value
    } catch (error) {
      logError('languages', error)
      const value = siteLanguagesCache?.value ?? [DEFAULT_SITE_LANGUAGE]
      // Back off briefly rather than querying a struggling database per request.
      siteLanguagesCache = { value, expires: Date.now() + 5_000 }
      return value
    } finally {
      siteLanguagesPending = null
    }
  })()

  return siteLanguagesPending
}

export async function isLanguageEnabled(code: string): Promise<boolean> {
  if (code === DEFAULT_LANGUAGE.code) return true
  return (await getSiteLanguages()).some((language) => language.code === code)
}

/**
 * Admin-entered translations for an enabled language, nested like a locale
 * file, ready to merge over the bundled messages. Empty for English, unknown
 * or disabled languages, and when the database can't be read.
 */
export async function getMessageOverrides(code: string): Promise<NestedMessages> {
  if (code === DEFAULT_LANGUAGE.code || !(await isLanguageEnabled(code))) return {}

  const cached = overridesCache.get(code)
  if (cached && cached.expires > Date.now()) return cached.value

  try {
    const value = unflattenMessages(await loadOverrides(code))
    overridesCache.set(code, { value, expires: Date.now() + LANGUAGE_CACHE_TTL_MS })
    return value
  } catch (error) {
    logError('languages', error)
    return cached?.value ?? {}
  }
}

async function loadOverrides(code: string): Promise<FlatMessages> {
  const rows = await getDatabase()
    .select({ key: schema.uiTranslations.messageKey, value: schema.uiTranslations.value })
    .from(schema.uiTranslations)
    .where(eq(schema.uiTranslations.locale, code))

  const out: FlatMessages = {}
  for (const row of rows) {
    // Keys removed from en.json since the translation was entered are ignored.
    if (row.key in SOURCE_MESSAGES) out[row.key] = row.value
  }
  return out
}

// ── Admin: languages ─────────────────────────────────────────────────────

const TOTAL_KEYS = Object.keys(SOURCE_MESSAGES).length

/** How many keys have a translation, given the entered overrides. */
export function countTranslated(code: string, overrideKeys: Iterable<string>): number {
  const keys = new Set(Object.keys(bundledMessages(code)))
  for (const key of overrideKeys) {
    if (key in SOURCE_MESSAGES) keys.add(key)
  }
  return keys.size
}

export async function listAdminLanguages(): Promise<{
  languages: AdminLanguage[]
  available: CatalogLanguage[]
}> {
  const db = getDatabase()
  const rows = await db
    .select()
    .from(schema.languages)
    .orderBy(asc(schema.languages.sortOrder), asc(schema.languages.code))
  const keyRows = await db
    .select({ locale: schema.uiTranslations.locale, key: schema.uiTranslations.messageKey })
    .from(schema.uiTranslations)

  const keysByLocale = new Map<string, string[]>()
  for (const row of keyRows) {
    if (!(row.key in SOURCE_MESSAGES)) continue
    const keys = keysByLocale.get(row.locale)
    if (keys) keys.push(row.key)
    else keysByLocale.set(row.locale, [row.key])
  }

  const languages: AdminLanguage[] = [
    {
      ...DEFAULT_SITE_LANGUAGE,
      isEnabled: true,
      hasBundledMessages: true,
      translated: TOTAL_KEYS,
      total: TOTAL_KEYS,
      overrides: 0,
      updatedAt: null
    }
  ]
  const added = new Set<string>()
  for (const row of rows) {
    const catalog = catalogLanguage(row.code)
    // A row for a language the build no longer offers can't be served.
    if (!catalog) continue
    added.add(row.code)
    const keys = keysByLocale.get(row.code) ?? []
    languages.push({
      ...toSiteLanguage(row, catalog),
      isEnabled: row.isEnabled,
      hasBundledMessages: Boolean(catalog.file),
      translated: countTranslated(row.code, keys),
      total: TOTAL_KEYS,
      overrides: keys.length,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null
    })
  }

  return { languages, available: LANGUAGE_CATALOG.filter((entry) => !added.has(entry.code)) }
}

export async function findLanguageRow(code: string) {
  const [row] = await getDatabase()
    .select()
    .from(schema.languages)
    .where(eq(schema.languages.code, code))
    .limit(1)
  return row ?? null
}

/** Add a catalogue language, switched off. */
export async function addLanguage(
  catalog: CatalogLanguage,
  input: { name?: string; nativeName?: string },
  userId: number
) {
  const db = getDatabase()
  const [{ next }] = await db
    .select({ next: sql<number>`COALESCE(MAX(${schema.languages.sortOrder}), -1) + 1` })
    .from(schema.languages)

  await db.insert(schema.languages).values({
    code: catalog.code,
    name: input.name || catalog.name,
    nativeName: input.nativeName || catalog.nativeName,
    isEnabled: false,
    sortOrder: Number(next) || 0,
    updatedBy: userId
  })
  invalidateLanguageCache()
}

export async function updateLanguage(
  code: string,
  input: { name?: string; nativeName?: string; isEnabled?: boolean },
  userId: number
) {
  await getDatabase()
    .update(schema.languages)
    .set({ ...input, updatedBy: userId })
    .where(eq(schema.languages.code, code))
  invalidateLanguageCache()
}

/** Remove a language and every translation entered for it. */
export async function removeLanguage(code: string) {
  // ui_translations rows go with it (ON DELETE CASCADE).
  await getDatabase().delete(schema.languages).where(eq(schema.languages.code, code))
  invalidateLanguageCache()
}

// ── Admin: translations ──────────────────────────────────────────────────

export async function loadTranslationEntries(code: string): Promise<TranslationEntry[]> {
  const overrides = await loadOverrides(code)
  const bundled = bundledMessages(code)
  return Object.entries(SOURCE_MESSAGES).map(([key, source]) => ({
    key,
    source,
    bundled: bundled[key] ?? null,
    override: overrides[key] ?? null
  }))
}

/**
 * Apply a batch of edits: a string stores (or replaces) the entered
 * translation for a key, null removes it so the key falls back to the bundled
 * text or English. Returns what actually changed, for the audit log.
 */
export async function saveTranslations(
  code: string,
  changes: Record<string, string | null>,
  userId: number
): Promise<{ set: string[]; cleared: string[] }> {
  const current = await loadOverrides(code)
  const set: string[] = []
  const cleared: string[] = []
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) {
      if (key in current) cleared.push(key)
    } else if (current[key] !== value) {
      set.push(key)
    }
  }
  if (set.length === 0 && cleared.length === 0) return { set, cleared }

  await getDatabase().transaction(async (tx) => {
    if (set.length > 0) {
      await tx
        .insert(schema.uiTranslations)
        .values(
          set.map((key) => ({
            locale: code,
            messageKey: key,
            value: changes[key] as string,
            updatedBy: userId
          }))
        )
        .onDuplicateKeyUpdate({
          set: { value: sql`VALUES(\`value\`)`, updatedBy: userId }
        })
    }
    if (cleared.length > 0) {
      await tx
        .delete(schema.uiTranslations)
        .where(
          and(
            eq(schema.uiTranslations.locale, code),
            inArray(schema.uiTranslations.messageKey, cleared)
          )
        )
    }
    // Stamp the language so the admin list shows when it was last worked on.
    await tx
      .update(schema.languages)
      .set({ updatedBy: userId, updatedAt: new Date() })
      .where(eq(schema.languages.code, code))
  })

  invalidateLanguageCache()
  return { set, cleared }
}
