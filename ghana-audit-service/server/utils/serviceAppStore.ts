/**
 * Audit Service apps (service_apps + service_app_translations).
 *
 * The public site reads the published apps on every app page, the /apps hub,
 * the home page and global search, and pages/[slug].vue asks for any
 * single-segment address nothing else claims — so the public lookups are
 * answered from a short per-process cache instead of the database. A change
 * made in the admin panel is immediate on the pod that handled it and reaches
 * the others within SERVICE_APP_CACHE_TTL_MS.
 */
import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import type { ServiceAppRow, ServiceAppTranslationRow } from '../database/schema'
import { normaliseAppContent, type AppTranslation } from '../../utils/serviceApps'

export const SERVICE_APP_CACHE_TTL_MS = 30_000

export type ServiceAppLocale = 'en' | 'ak'

/** An app with its language versions, as stored. */
export interface StoredServiceApp extends ServiceAppRow {
  translations: Partial<Record<ServiceAppLocale, AppTranslation>>
}

export function toAppTranslation(row: ServiceAppTranslationRow): AppTranslation {
  return {
    name: row.name,
    tagline: row.tagline ?? '',
    summary: row.summary,
    headline: row.headline ?? '',
    body: row.body ?? '',
    launchLabel: row.launchLabel ?? '',
    imageAlt: row.imageAlt ?? '',
    ctaTitle: row.ctaTitle ?? '',
    ctaText: row.ctaText ?? '',
    content: normaliseAppContent(row.content)
  }
}

/**
 * Apps straight from the database, in display order (sort order, then id).
 * Pass `ids` to load particular apps, `activeOnly` for the published ones.
 */
export async function loadServiceApps(
  options: { activeOnly?: boolean; ids?: number[] } = {}
): Promise<StoredServiceApp[]> {
  const db = getDatabase()
  const conditions = []
  if (options.activeOnly) conditions.push(eq(schema.serviceApps.isActive, true))
  if (options.ids) {
    if (options.ids.length === 0) return []
    conditions.push(inArray(schema.serviceApps.id, options.ids))
  }

  const rows = await db
    .select()
    .from(schema.serviceApps)
    .where(and(...conditions))
    .orderBy(asc(schema.serviceApps.sortOrder), asc(schema.serviceApps.id))

  if (rows.length === 0) return []

  const translations = await db
    .select()
    .from(schema.serviceAppTranslations)
    .where(
      inArray(
        schema.serviceAppTranslations.appId,
        rows.map((row) => row.id)
      )
    )

  const byApp = new Map<number, StoredServiceApp['translations']>()
  for (const row of translations) {
    const entry = byApp.get(row.appId) ?? {}
    entry[row.locale] = toAppTranslation(row)
    byApp.set(row.appId, entry)
  }

  return rows.map((row) => ({ ...row, translations: byApp.get(row.id) ?? {} }))
}

// ── Cached public lookups ────────────────────────────────────────────────

let publishedCache: { value: StoredServiceApp[]; expires: number } | null = null
let publishedPending: Promise<StoredServiceApp[]> | null = null
// Bumped by every admin write, so a load that started before it isn't cached.
let generation = 0

export function invalidateServiceAppCache() {
  generation++
  publishedCache = null
  publishedPending = null
}

/**
 * Published apps (active, with an English version), in display order.
 *
 * Throws when the database can't be read and nothing is cached yet, so a
 * cached page never stores an empty list in place of the real one.
 */
export async function getPublishedServiceApps(): Promise<StoredServiceApp[]> {
  const now = Date.now()
  if (publishedCache && publishedCache.expires > now) return publishedCache.value
  if (publishedPending) return publishedPending

  const started = generation
  publishedPending = (async () => {
    try {
      const apps = (await loadServiceApps({ activeOnly: true })).filter(
        (app) => app.translations.en
      )
      // Only keep the answer if nothing invalidated the cache meanwhile.
      if (generation === started) {
        publishedCache = { value: apps, expires: Date.now() + SERVICE_APP_CACHE_TTL_MS }
      }
      return apps
    } catch (error) {
      // Keep serving the last good list rather than failing every page.
      if (publishedCache) return publishedCache.value
      throw error
    } finally {
      if (generation === started) publishedPending = null
    }
  })()
  return publishedPending
}

/** The published app at `/<slug>`, if there is one. */
export async function findPublishedServiceApp(slug: string): Promise<StoredServiceApp | null> {
  return (await getPublishedServiceApps()).find((app) => app.slug === slug) ?? null
}

// ── Admin writes ─────────────────────────────────────────────────────────

type Transaction = Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0]

function translationValues(appId: number, locale: ServiceAppLocale, text: AppTranslation) {
  const orNull = (value: string) => (value.trim() ? value : null)
  return {
    appId,
    locale,
    name: text.name,
    tagline: orNull(text.tagline),
    summary: text.summary,
    headline: orNull(text.headline),
    body: orNull(text.body),
    launchLabel: orNull(text.launchLabel),
    imageAlt: orNull(text.imageAlt),
    ctaTitle: orNull(text.ctaTitle),
    ctaText: orNull(text.ctaText),
    content: text.content
  }
}

/**
 * Replace an app's language versions: English is always written, Akan is
 * written when given and removed when not.
 */
export async function writeServiceAppTranslations(
  tx: Transaction,
  appId: number,
  translations: { en: AppTranslation; ak?: AppTranslation }
): Promise<void> {
  for (const locale of ['en', 'ak'] as const) {
    const text = translations[locale]
    if (!text) {
      await tx
        .delete(schema.serviceAppTranslations)
        .where(
          and(
            eq(schema.serviceAppTranslations.appId, appId),
            eq(schema.serviceAppTranslations.locale, locale)
          )
        )
      continue
    }
    const values = translationValues(appId, locale, text)
    await tx
      .insert(schema.serviceAppTranslations)
      .values(values)
      .onDuplicateKeyUpdate({ set: { ...values } })
  }
}

/** The app using `slug`, other than `excludeId`, if any. */
export async function findServiceAppBySlug(
  slug: string,
  excludeId?: number
): Promise<{ id: number } | null> {
  const [row] = await getDatabase()
    .select({ id: schema.serviceApps.id })
    .from(schema.serviceApps)
    .where(
      excludeId
        ? and(eq(schema.serviceApps.slug, slug), ne(schema.serviceApps.id, excludeId))
        : eq(schema.serviceApps.slug, slug)
    )
    .limit(1)
  return row ?? null
}
