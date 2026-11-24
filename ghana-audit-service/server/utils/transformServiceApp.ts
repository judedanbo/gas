import type { ServiceApp, ServiceAppSummary } from '~/types'
import type { AdminServiceApp } from '~/types/admin'
import {
  appLogoUrl,
  appPath,
  emptyAppTranslation,
  mergeAppTranslation,
  type AppTranslation
} from '../../utils/serviceApps'
import type { ServiceAppLocale, StoredServiceApp } from './serviceAppStore'

/** The language the public site asked for; app text exists in English and Akan. */
export function serviceAppLocale(value: unknown): ServiceAppLocale {
  return value === 'ak' ? 'ak' : 'en'
}

/** An app's text in `locale`, with anything that language leaves empty in English. */
export function resolveAppTranslation(
  app: StoredServiceApp,
  locale: ServiceAppLocale
): AppTranslation {
  const english = app.translations.en ?? emptyAppTranslation()
  const own = locale === 'en' ? null : app.translations[locale]
  return own ? mergeAppTranslation(own, english) : english
}

const orNull = (value: string) => (value.trim() ? value : null)

export function transformServiceAppSummary(
  app: StoredServiceApp,
  locale: ServiceAppLocale = 'en'
): ServiceAppSummary {
  const text = resolveAppTranslation(app, locale)
  return {
    slug: app.slug,
    path: appPath(app.slug),
    url: app.url,
    logoUrl: appLogoUrl(app.logoUrl),
    name: text.name,
    tagline: orNull(text.tagline),
    summary: text.summary,
    launchLabel: orNull(text.launchLabel)
  }
}

export function transformServiceApp(
  app: StoredServiceApp,
  locale: ServiceAppLocale = 'en'
): ServiceApp {
  const text = resolveAppTranslation(app, locale)
  return {
    ...transformServiceAppSummary(app, locale),
    headline: orNull(text.headline),
    body: orNull(text.body),
    imageUrl: app.imageUrl || null,
    // An image without a description is still named after the app.
    imageAlt: text.imageAlt.trim() || text.name,
    privacyUrl: app.privacyUrl || null,
    ctaTitle: orNull(text.ctaTitle),
    ctaText: orNull(text.ctaText),
    content: text.content
  }
}

/** The admin panel's view of an app: every stored field, both languages as entered. */
export function transformAdminServiceApp(app: StoredServiceApp): AdminServiceApp {
  const iso = (value: Date | string) =>
    value instanceof Date ? value.toISOString() : new Date(value).toISOString()
  return {
    id: app.id,
    slug: app.slug,
    url: app.url,
    logoUrl: app.logoUrl,
    imageUrl: app.imageUrl,
    privacyUrl: app.privacyUrl,
    sortOrder: app.sortOrder,
    isActive: app.isActive,
    createdBy: app.createdBy,
    updatedBy: app.updatedBy,
    createdAt: iso(app.createdAt),
    updatedAt: iso(app.updatedAt),
    translations: {
      en: app.translations.en ?? emptyAppTranslation(),
      ...(app.translations.ak ? { ak: app.translations.ak } : {})
    }
  }
}
