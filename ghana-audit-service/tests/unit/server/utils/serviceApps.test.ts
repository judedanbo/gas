import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { serviceAppSchema } from '~/server/utils/validation'
import {
  resolveAppTranslation,
  serviceAppLocale,
  transformAdminServiceApp,
  transformServiceApp,
  transformServiceAppSummary
} from '~/server/utils/transformServiceApp'
import { isDuplicateSlugError } from '~/server/utils/serviceAppAdmin'
import type { StoredServiceApp } from '~/server/utils/serviceAppStore'
import { SEED_SERVICE_APPS, seedServiceAppsSql } from '~/server/database/seeds/data/service-apps'
import { emptyAppContent, emptyAppTranslation } from '~/utils/serviceApps'

function seedInput(index: number) {
  const app = SEED_SERVICE_APPS[index]
  return {
    slug: app.slug,
    url: app.url,
    logoUrl: app.logoUrl,
    privacyUrl: app.privacyUrl,
    sortOrder: app.sortOrder,
    isActive: true,
    translations: { en: app.en }
  }
}

describe('seeded apps', () => {
  it('start with CitizensEye at its old address, then the Tracker', () => {
    expect(SEED_SERVICE_APPS.map((app) => [app.slug, app.url])).toEqual([
      ['citizenseye', 'https://www.appsheet.com/start/5b1b9364-12e7-4613-a082-26cebb71f29f'],
      ['tracker', 'https://tracker.audit.gov.gh']
    ])
  })

  it('pass the same validation as an admin save', () => {
    for (const index of SEED_SERVICE_APPS.keys()) {
      const parsed = serviceAppSchema.safeParse(seedInput(index))
      expect(parsed.success ? null : parsed.error.issues).toBeNull()
    }
  })

  it('are what migration 0013 inserts', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'server/database/migrations/0013_service_apps.sql'),
      'utf8'
    )
    expect(migration).toContain(seedServiceAppsSql())
  })
})

describe('serviceAppSchema', () => {
  const minimal = {
    slug: ' Tracker ',
    url: 'https://tracker.audit.gov.gh',
    translations: { en: { name: 'Tracker', summary: 'Follow recommendations.' } }
  }

  it('fills defaults and normalises the address', () => {
    const parsed = serviceAppSchema.parse(minimal)
    expect(parsed.slug).toBe('tracker')
    expect(parsed.logoUrl ?? null).toBeNull()
    expect(parsed.isActive).toBe(true)
    expect(parsed.sortOrder).toBe(0)
    expect(parsed.imageUrl ?? null).toBeNull()
    expect(parsed.translations.en.tagline).toBe('')
    expect(parsed.translations.en.content).toEqual(emptyAppContent())
    expect(parsed.translations.ak).toBeUndefined()
  })

  it('drops an Akan version with nothing in it', () => {
    const parsed = serviceAppSchema.parse({
      ...minimal,
      translations: { ...minimal.translations, ak: emptyAppTranslation() }
    })
    expect(parsed.translations.ak).toBeUndefined()

    const withName = serviceAppSchema.parse({
      ...minimal,
      translations: { ...minimal.translations, ak: { name: 'Tracker (Akan)' } }
    })
    expect(withName.translations.ak?.name).toBe('Tracker (Akan)')
    expect(withName.translations.ak?.summary).toBe('')
  })

  it('reports problems by field, down to section items', () => {
    const parsed = serviceAppSchema.safeParse({
      slug: 'contact',
      url: 'javascript:alert(1)',
      logoUrl: 'javascript:alert(1)',
      privacyUrl: '//evil.example',
      translations: {
        en: {
          name: '',
          summary: 'x',
          content: { faqs: { items: [{ question: 'Q?', answer: ' ' }] } }
        }
      }
    })
    expect(parsed.success).toBe(false)
    const paths = parsed.success ? [] : parsed.error.issues.map((issue) => issue.path.join('.'))
    expect(paths).toEqual(
      expect.arrayContaining([
        'slug',
        'url',
        'logoUrl',
        'privacyUrl',
        'translations.en.name',
        'translations.en.content.faqs.items.0.answer'
      ])
    )
  })

  it('takes an uploaded or https logo, and none at all', () => {
    for (const logoUrl of ['/uploads/images/tracker-logo.png', 'https://cdn.audit.gov.gh/l.png']) {
      expect(serviceAppSchema.parse({ ...minimal, logoUrl }).logoUrl).toBe(logoUrl)
    }
    expect(serviceAppSchema.parse({ ...minimal, logoUrl: '' }).logoUrl ?? null).toBeNull()
    expect(
      serviceAppSchema.safeParse({ ...minimal, logoUrl: 'http://x.example/l.png' }).success
    ).toBe(false)
  })

  it('only takes absolute web addresses for the app itself', () => {
    expect(serviceAppSchema.safeParse({ ...minimal, url: '/tracker' }).success).toBe(false)
    expect(
      serviceAppSchema.safeParse({ ...minimal, url: 'http://intranet.audit.gov.gh' }).success
    ).toBe(true)
  })

  it('caps the number of items in a section', () => {
    const items = Array.from({ length: 13 }, (_, i) => ({
      icon: 'heroicons:eye',
      title: `Feature ${i}`,
      description: ''
    }))
    const parsed = serviceAppSchema.safeParse({
      ...minimal,
      translations: { en: { ...minimal.translations.en, content: { features: { items } } } }
    })
    expect(parsed.success ? [] : parsed.error.issues.map((i) => i.path.join('.'))).toContain(
      'translations.en.content.features.items'
    )
  })
})

function storedApp(overrides: Partial<StoredServiceApp> = {}): StoredServiceApp {
  const english = {
    ...emptyAppTranslation(),
    name: 'Audit Recommendations Tracker',
    tagline: 'Follow the action taken',
    summary: 'Follow audit recommendations.',
    body: '<p>Intro</p>',
    content: {
      ...emptyAppContent(),
      faqs: { title: '', intro: '', items: [{ question: 'Q?', answer: 'A.' }] }
    }
  }
  return {
    id: 2,
    slug: 'tracker',
    url: 'https://tracker.audit.gov.gh',
    logoUrl: null,
    imageUrl: null,
    privacyUrl: null,
    sortOrder: 2,
    isActive: true,
    createdAt: new Date('2026-11-24T10:00:00Z'),
    updatedAt: new Date('2026-11-24T11:00:00Z'),
    createdBy: 1,
    updatedBy: 1,
    translations: { en: english },
    ...overrides
  }
}

describe('transformServiceApp', () => {
  it('serves English to every language without its own text', () => {
    expect(serviceAppLocale('ak')).toBe('ak')
    expect(serviceAppLocale('ee')).toBe('en')
    expect(serviceAppLocale(undefined)).toBe('en')
    const app = storedApp()
    expect(resolveAppTranslation(app, 'ak')).toEqual(app.translations.en)
  })

  it('builds the card, with the GAS logo for an app without one', () => {
    expect(transformServiceAppSummary(storedApp())).toEqual({
      slug: 'tracker',
      path: '/tracker',
      url: 'https://tracker.audit.gov.gh',
      logoUrl: '/images/logo-no-bg.png',
      name: 'Audit Recommendations Tracker',
      tagline: 'Follow the action taken',
      summary: 'Follow audit recommendations.',
      launchLabel: null
    })
  })

  it("uses the app's own logo when it has one", () => {
    const app = storedApp({ logoUrl: '/uploads/images/tracker-logo.png' })
    expect(transformServiceAppSummary(app).logoUrl).toBe('/uploads/images/tracker-logo.png')
    expect(transformServiceApp(app).logoUrl).toBe('/uploads/images/tracker-logo.png')
  })

  it('builds the landing page, mixing in Akan where it was entered', () => {
    const app = storedApp({
      imageUrl: '/uploads/images/tracker.png',
      translations: {
        en: storedApp().translations.en!,
        ak: { ...emptyAppTranslation(), name: 'Tracker (Akan)' }
      }
    })
    const page = transformServiceApp(app, 'ak')
    expect(page.name).toBe('Tracker (Akan)')
    expect(page.summary).toBe('Follow audit recommendations.')
    expect(page.body).toBe('<p>Intro</p>')
    expect(page.headline).toBeNull()
    // An image with no description is named after the app.
    expect(page.imageAlt).toBe('Tracker (Akan)')
    expect(page.content.faqs.items).toHaveLength(1)
  })

  it('gives the admin panel both languages as entered', () => {
    const admin = transformAdminServiceApp(storedApp())
    // The admin sees what was uploaded — nothing — not the fallback.
    expect(admin.logoUrl).toBeNull()
    expect(admin.translations.ak).toBeUndefined()
    expect(admin.createdAt).toBe('2026-11-24T10:00:00.000Z')
    expect(admin.translations.en.name).toBe('Audit Recommendations Tracker')
  })
})

describe('isDuplicateSlugError', () => {
  it('spots a duplicate app address, wrapped or not', () => {
    const driver = {
      code: 'ER_DUP_ENTRY',
      message: "Duplicate entry 'tracker' for key 'service_apps.idx_service_apps_slug'"
    }
    expect(isDuplicateSlugError(driver)).toBe(true)
    expect(isDuplicateSlugError(new Error('Failed query', { cause: driver }))).toBe(true)
    expect(isDuplicateSlugError({ code: 'ER_DUP_ENTRY', message: 'idx_service_app_locale' })).toBe(
      false
    )
    expect(isDuplicateSlugError(new Error('boom'))).toBe(false)
  })
})
