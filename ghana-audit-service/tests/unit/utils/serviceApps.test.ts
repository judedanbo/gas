import { readdirSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  APP_ICON_OPTIONS,
  RESERVED_APP_SLUGS,
  appPath,
  appSlugProblem,
  emptyAppContent,
  emptyAppTranslation,
  isAppIcon,
  isEmptyAppTranslation,
  mergeAppTranslation,
  normaliseAppContent,
  type AppTranslation
} from '~/utils/serviceApps'
import { CATALOG_CODES } from '~/utils/languageCatalog'

const root = process.cwd()

describe('appSlugProblem', () => {
  it('accepts lowercase words joined by single hyphens', () => {
    for (const slug of ['citizenseye', 'tracker', 'e-tracker', 'amis2', 'a-b-c']) {
      expect(appSlugProblem(slug)).toBeNull()
    }
  })

  it('rejects anything that is not a plain lowercase address', () => {
    for (const slug of [
      '',
      'Tracker',
      'e_tracker',
      'e--tracker',
      '-tracker',
      'tracker-',
      'a/b',
      'wp-login.php'
    ]) {
      expect(appSlugProblem(slug)).not.toBeNull()
    }
    expect(appSlugProblem('a'.repeat(61))).toMatch(/at most 60/)
  })

  it('rejects addresses other pages already use', () => {
    expect(appSlugProblem('reports')).toBe('/reports is already a page on this website')
    expect(appSlugProblem('apps')).not.toBeNull()
    expect(appSlugProblem('api')).not.toBeNull()
  })

  it('rejects language prefixes, including English', () => {
    expect(appSlugProblem('en')).toMatch(/language version/)
    for (const code of CATALOG_CODES) expect(appSlugProblem(code)).toMatch(/language version/)
  })

  it('keeps /citizenseye available for the CitizensEye app', () => {
    // pages/citizenseye/ only holds the privacy notice.
    expect(appSlugProblem('citizenseye')).toBeNull()
    expect(appPath('citizenseye')).toBe('/citizenseye')
  })
})

describe('RESERVED_APP_SLUGS', () => {
  // A new top-level page, server route or public folder would be shadowed by an
  // app with the same address (or shadow it), so each one must be reserved.
  function topLevelNames(): string[] {
    const names: string[] = []
    for (const entry of readdirSync(resolve(root, 'pages'))) {
      const full = resolve(root, 'pages', entry)
      if (statSync(full).isDirectory()) {
        // A folder only claims /<name> when it has an index page.
        if (existsSync(resolve(full, 'index.vue'))) names.push(entry)
      } else if (entry.endsWith('.vue') && !entry.startsWith('[')) {
        names.push(entry.replace(/\.vue$/, ''))
      }
    }
    for (const entry of readdirSync(resolve(root, 'server/routes'))) {
      names.push(entry.replace(/\.(ts|js)$/, ''))
    }
    for (const entry of readdirSync(resolve(root, 'public'))) {
      if (statSync(resolve(root, 'public', entry)).isDirectory()) names.push(entry)
    }
    return names
  }

  it('lists every top-level page, server route and public folder', () => {
    const missing = topLevelNames().filter((name) => !RESERVED_APP_SLUGS.includes(name))
    expect(missing).toEqual([])
  })
})

describe('icons', () => {
  it('only offers distinct heroicons', () => {
    const values = APP_ICON_OPTIONS.map((option) => option.value)
    expect(new Set(values).size).toBe(values.length)
    expect(values.every((value) => value.startsWith('heroicons:'))).toBe(true)
    expect(isAppIcon('heroicons:eye')).toBe(true)
    expect(isAppIcon('mdi:eye')).toBe(false)
  })
})

describe('normaliseAppContent', () => {
  it('fills a missing or broken value with empty sections', () => {
    expect(normaliseAppContent(null)).toEqual(emptyAppContent())
    expect(normaliseAppContent('not json')).toEqual(emptyAppContent())
    expect(normaliseAppContent({ faqs: 'nope' })).toEqual(emptyAppContent())
  })

  it('reads stored JSON (string or parsed) and drops what does not fit', () => {
    const stored = {
      features: { title: 'Do', items: [{ icon: 'heroicons:eye', title: 'See', extra: 1 }, null] },
      audiences: { items: [{ icon: 'heroicons:user', title: 'You', points: ['a', 2, 'b'] }] }
    }
    for (const raw of [stored, JSON.stringify(stored)]) {
      const content = normaliseAppContent(raw)
      expect(content.features).toEqual({
        title: 'Do',
        intro: '',
        items: [{ icon: 'heroicons:eye', title: 'See', description: '' }]
      })
      expect(content.audiences.items[0].points).toEqual(['a', 'b'])
      expect(content.faqs).toEqual({ title: '', intro: '', items: [] })
    }
  })
})

function translation(overrides: Partial<AppTranslation> = {}): AppTranslation {
  return { ...emptyAppTranslation(), ...overrides }
}

describe('mergeAppTranslation', () => {
  const english = translation({
    name: 'Audit Recommendations Tracker',
    summary: 'Follow audit recommendations.',
    tagline: 'Follow the action taken',
    content: {
      ...emptyAppContent(),
      faqs: {
        title: '',
        intro: 'Common questions',
        items: [{ question: 'What is it?', answer: 'A tracker.' }]
      },
      features: {
        title: '',
        intro: '',
        items: [{ icon: 'heroicons:eye', title: 'See', description: '' }]
      }
    }
  })

  it('takes each empty field from English', () => {
    const akan = translation({ name: 'Tracker (Akan)', tagline: '   ' })
    const merged = mergeAppTranslation(akan, english)
    expect(merged.name).toBe('Tracker (Akan)')
    expect(merged.summary).toBe('Follow audit recommendations.')
    expect(merged.tagline).toBe('Follow the action taken')
  })

  it('uses a section of its own only when it has items', () => {
    const akan = translation({
      content: {
        ...emptyAppContent(),
        features: {
          title: 'Akan heading',
          intro: '',
          items: [{ icon: 'heroicons:bell', title: 'Akan item', description: '' }]
        }
      }
    })
    const merged = mergeAppTranslation(akan, english)
    expect(merged.content.features.title).toBe('Akan heading')
    expect(merged.content.features.items.map((i) => i.title)).toEqual(['Akan item'])
    // No Akan questions: the English ones, with their introduction.
    expect(merged.content.faqs.items).toEqual(english.content.faqs.items)
    expect(merged.content.faqs.intro).toBe('Common questions')
  })

  it('returns English as it is', () => {
    expect(mergeAppTranslation(english, null)).toBe(english)
  })
})

describe('isEmptyAppTranslation', () => {
  it('is true only when nothing at all was entered', () => {
    expect(isEmptyAppTranslation(emptyAppTranslation())).toBe(true)
    expect(isEmptyAppTranslation(translation({ name: '  ' }))).toBe(true)
    expect(isEmptyAppTranslation(translation({ ctaText: 'x' }))).toBe(false)
    const withIntro = translation()
    withIntro.content.steps.intro = 'Intro'
    expect(isEmptyAppTranslation(withIntro)).toBe(false)
  })
})
