import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Route configuration tests
 * These tests verify that all route files exist and are properly structured.
 * For full rendering tests, run E2E tests with: npm run test:e2e
 *
 * Note: E2E tests require Playwright browser dependencies to be installed.
 * Run `npx playwright install-deps` (requires sudo) to install them.
 */

const rootDir = process.cwd()

// Static routes that should exist
const staticRoutes = [
  { path: 'pages/index.vue', name: 'Homepage' },
  { path: 'pages/about/index.vue', name: 'About Index' },
  { path: 'pages/about/the-service.vue', name: 'About The Service' },
  { path: 'pages/about/management-team.vue', name: 'Management Team' },
  { path: 'pages/about/departmental-profile.vue', name: 'Departmental Profile' },
  { path: 'pages/about/past-auditors-general.vue', name: 'Past Auditors General' },
  { path: 'pages/reports/index.vue', name: 'Reports Index' },
  { path: 'pages/reports/[id].vue', name: 'Report Detail' },
  { path: 'pages/publications/index.vue', name: 'Publications Index' },
  { path: 'pages/publications/press-statements.vue', name: 'Press Statements' },
  { path: 'pages/publications/press-statements/[slug].vue', name: 'Press Statement Detail' },
  { path: 'pages/publications/bulletins.vue', name: 'Bulletins' },
  { path: 'pages/publications/bulletins/[slug].vue', name: 'Bulletin Detail' },
  { path: 'pages/publications/guidelines.vue', name: 'Guidelines' },
  { path: 'pages/publications/guidelines/[slug].vue', name: 'Guideline Detail' },
  { path: 'pages/publications/amis-manuals.vue', name: 'AMIS Manuals' },
  { path: 'pages/publications/amis-manuals/[slug].vue', name: 'AMIS Manual Detail' },
  { path: 'pages/publications/applicable-laws.vue', name: 'Applicable Laws' },
  { path: 'pages/publications/pfm-strategy.vue', name: 'PFM Strategy' },
  { path: 'pages/media/index.vue', name: 'Media Index' },
  { path: 'pages/media/news/index.vue', name: 'News Index' },
  { path: 'pages/media/news/[slug].vue', name: 'News Detail' },
  { path: 'pages/media/events.vue', name: 'Events' },
  { path: 'pages/media/gallery.vue', name: 'Gallery' },
  { path: 'pages/media/videos.vue', name: 'Videos' },
  { path: 'pages/careers/index.vue', name: 'Careers Index' },
  { path: 'pages/careers/[slug].vue', name: 'Career Detail' },
  { path: 'pages/careers/tenders.vue', name: 'Tenders' },
  { path: 'pages/citizenseye/index.vue', name: 'CitizensEye Index' },
  { path: 'pages/citizenseye/privacy.vue', name: 'CitizensEye Privacy' },
  { path: 'pages/contact.vue', name: 'Contact' },
  { path: 'pages/search.vue', name: 'Search' },
  { path: 'pages/accessibility.vue', name: 'Accessibility' },
  { path: 'pages/privacy-policy.vue', name: 'Privacy Policy' },
  { path: 'pages/terms.vue', name: 'Terms of Service' }
]

// Required layout files
const layoutFiles = ['layouts/default.vue', 'layouts/minimal.vue']

// Required component directories
const componentDirectories = ['components/ui', 'components/common', 'components/home']

describe('Route Files Exist', () => {
  for (const route of staticRoutes) {
    it(`${route.name} page file exists (${route.path})`, () => {
      const fullPath = path.join(rootDir, route.path)
      expect(fs.existsSync(fullPath)).toBe(true)
    })
  }
})

describe('Layout Files Exist', () => {
  for (const layoutFile of layoutFiles) {
    it(`${layoutFile} exists`, () => {
      const fullPath = path.join(rootDir, layoutFile)
      expect(fs.existsSync(fullPath)).toBe(true)
    })
  }
})

describe('Component Directories Exist', () => {
  for (const dir of componentDirectories) {
    it(`${dir} directory exists`, () => {
      const fullPath = path.join(rootDir, dir)
      expect(fs.existsSync(fullPath)).toBe(true)
      expect(fs.statSync(fullPath).isDirectory()).toBe(true)
    })
  }
})

describe('Page File Structure', () => {
  for (const route of staticRoutes) {
    it(`${route.name} has valid Vue SFC structure`, () => {
      const fullPath = path.join(rootDir, route.path)
      const content = fs.readFileSync(fullPath, 'utf-8')

      // Should have a template section
      expect(content).toMatch(/<template>/)
      expect(content).toMatch(/<\/template>/)

      // Should have a script section (with setup for composition API)
      expect(content).toMatch(/<script/)
    })
  }
})

describe('API Routes Exist', () => {
  const apiRoutes = [
    'server/api/reports/index.ts',
    'server/api/reports/[id].ts',
    'server/api/news/index.ts',
    'server/api/news/[slug].ts',
    'server/api/publications/index.ts',
    'server/api/publications/[id].ts',
    'server/api/vacancies/index.ts',
    'server/api/vacancies/[slug].ts',
    'server/api/search.ts',
    'server/api/events.ts',
    'server/api/gallery.ts',
    'server/api/videos.ts',
    'server/api/tenders.ts',
    'server/api/regional-offices.ts',
    'server/api/newsletter.post.ts',
    'server/api/csrf.get.ts'
  ]

  for (const apiRoute of apiRoutes) {
    it(`${apiRoute} exists`, () => {
      const fullPath = path.join(rootDir, apiRoute)
      expect(fs.existsSync(fullPath)).toBe(true)
    })
  }
})

describe('Configuration Files', () => {
  it('nuxt.config.ts exists and has required modules', () => {
    const configPath = path.join(rootDir, 'nuxt.config.ts')
    expect(fs.existsSync(configPath)).toBe(true)

    const content = fs.readFileSync(configPath, 'utf-8')
    expect(content).toContain('@nuxtjs/i18n')
    expect(content).toContain('@nuxtjs/tailwindcss')
    expect(content).toContain('@nuxt/icon')
  })

  it('tailwind.config.ts exists', () => {
    const configPath = path.join(rootDir, 'tailwind.config.ts')
    expect(fs.existsSync(configPath)).toBe(true)
  })

  it('tsconfig.json exists', () => {
    const configPath = path.join(rootDir, 'tsconfig.json')
    expect(fs.existsSync(configPath)).toBe(true)
  })
})

describe('i18n Locale Files', () => {
  const localeFiles = ['i18n/locales/en.json', 'i18n/locales/ak.json']

  for (const localeFile of localeFiles) {
    it(`${localeFile} exists and is valid JSON`, () => {
      const fullPath = path.join(rootDir, localeFile)
      expect(fs.existsSync(fullPath)).toBe(true)

      const content = fs.readFileSync(fullPath, 'utf-8')
      expect(() => JSON.parse(content)).not.toThrow()
    })
  }
})
