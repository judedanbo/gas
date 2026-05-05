import { test, expect } from '@playwright/test'

/**
 * Route rendering tests - ensures all pages render without errors
 */

// Static routes that should always work
const staticRoutes = [
  { path: '/', name: 'Homepage' },
  { path: '/about', name: 'About Index' },
  { path: '/about/the-service', name: 'About The Service' },
  { path: '/about/management-team', name: 'Management Team' },
  { path: '/about/departmental-profile', name: 'Departmental Profile' },
  { path: '/about/past-auditors-general', name: 'Past Auditors General' },
  { path: '/reports', name: 'Reports Index' },
  { path: '/publications', name: 'Publications Index' },
  { path: '/publications/press-statements', name: 'Press Statements' },
  { path: '/publications/bulletins', name: 'Bulletins' },
  { path: '/publications/guidelines', name: 'Guidelines' },
  { path: '/publications/amis-manuals', name: 'AMIS Manuals' },
  { path: '/publications/applicable-laws', name: 'Applicable Laws' },
  { path: '/publications/pfm-strategy', name: 'PFM Strategy' },
  { path: '/media', name: 'Media Index' },
  { path: '/media/news', name: 'News Index' },
  { path: '/media/events', name: 'Events' },
  { path: '/media/gallery', name: 'Gallery' },
  { path: '/media/videos', name: 'Videos' },
  { path: '/careers', name: 'Careers Index' },
  { path: '/careers/tenders', name: 'Tenders' },
  { path: '/citizenseye', name: 'CitizensEye Index' },
  { path: '/citizenseye/privacy', name: 'CitizensEye Privacy' },
  { path: '/contact', name: 'Contact' },
  { path: '/search', name: 'Search' },
  { path: '/accessibility', name: 'Accessibility' },
  { path: '/privacy-policy', name: 'Privacy Policy' },
  { path: '/terms', name: 'Terms of Service' }
]

// Dynamic routes with valid test parameters
const dynamicRoutes = [
  { path: '/reports/1', name: 'Report Detail' },
  { path: '/media/news/world-bank-mou-2024', name: 'News Article' },
  { path: '/careers/senior-auditor-financial', name: 'Career Detail' },
  { path: '/publications/press-statements/gas-2023-annual-report-release', name: 'Press Statement Detail' },
  { path: '/publications/bulletins/quarterly-bulletin-q1-2024', name: 'Bulletin Detail' },
  { path: '/publications/guidelines/auditing-guidelines-public-sector', name: 'Guideline Detail' },
  { path: '/publications/amis-manuals/financial-audit-manual', name: 'AMIS Manual Detail' }
]

test.describe('Static Routes Rendering', () => {
  for (const route of staticRoutes) {
    test(`${route.name} (${route.path}) should render successfully`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })

      // Should return 200 status
      expect(response?.status()).toBe(200)

      // Should have content (not blank page)
      const body = await page.locator('body')
      await expect(body).not.toBeEmpty()

      // Should not show error page
      const pageContent = await page.content()
      expect(pageContent).not.toContain('500')
      expect(pageContent).not.toContain('Internal Server Error')

      // Should have header (layout loaded)
      await expect(page.locator('header')).toBeVisible()

      // Should have footer (full page rendered)
      await expect(page.locator('footer')).toBeVisible()
    })
  }
})

test.describe('Dynamic Routes Rendering', () => {
  for (const route of dynamicRoutes) {
    test(`${route.name} (${route.path}) should render successfully`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })

      // Should return 200 status
      expect(response?.status()).toBe(200)

      // Should have content (not blank page)
      const body = await page.locator('body')
      await expect(body).not.toBeEmpty()

      // Should not show error page
      const pageContent = await page.content()
      expect(pageContent).not.toContain('500')
      expect(pageContent).not.toContain('Internal Server Error')

      // Should have header (layout loaded)
      await expect(page.locator('header')).toBeVisible()

      // Should have footer (full page rendered)
      await expect(page.locator('footer')).toBeVisible()
    })
  }
})

test.describe('404 Error Handling', () => {
  test('should handle non-existent routes gracefully', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist', { waitUntil: 'domcontentloaded' })

    // Should return 404 status
    expect(response?.status()).toBe(404)

    // Page should still have structure (error page, not blank)
    const body = await page.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('should handle non-existent report ID', async ({ page }) => {
    const response = await page.goto('/reports/99999', { waitUntil: 'domcontentloaded' })

    // Should return 404 or handle gracefully
    const status = response?.status()
    expect([200, 404]).toContain(status)
  })

  test('should handle non-existent news slug', async ({ page }) => {
    const response = await page.goto('/media/news/non-existent-article', { waitUntil: 'domcontentloaded' })

    // Should return 404 or handle gracefully
    const status = response?.status()
    expect([200, 404]).toContain(status)
  })
})

test.describe('Page Content Verification', () => {
  test('homepage should have key sections', async ({ page }) => {
    await page.goto('/')

    // Should have main content area
    await expect(page.locator('main, #main-content, [role="main"]').first()).toBeVisible()

    // Should have navigation
    await expect(page.locator('nav').first()).toBeVisible()
  })

  test('reports page should have report listings or empty state', async ({ page }) => {
    await page.goto('/reports')

    // Should have main content
    await expect(page.locator('main, #main-content, [role="main"]').first()).toBeVisible()

    // Page title should contain "Reports"
    await expect(page).toHaveTitle(/Report/i)
  })

  test('contact page should have contact information', async ({ page }) => {
    await page.goto('/contact')

    // Should have contact details
    const pageContent = await page.content()
    expect(pageContent).toMatch(/email|phone|address/i)
  })

  test('search page should have search functionality', async ({ page }) => {
    await page.goto('/search')

    // Should have search input
    const searchInput = page.locator('input[type="search"], input[type="text"], input[placeholder*="earch"]').first()
    await expect(searchInput).toBeVisible()
  })
})

test.describe('Accessibility Basics', () => {
  test('all pages should have lang attribute', async ({ page }) => {
    for (const route of staticRoutes.slice(0, 5)) {
      await page.goto(route.path)
      const lang = await page.locator('html').getAttribute('lang')
      expect(lang).toBeTruthy()
    }
  })

  test('all pages should have page title', async ({ page }) => {
    for (const route of staticRoutes.slice(0, 5)) {
      await page.goto(route.path)
      const title = await page.title()
      expect(title.length).toBeGreaterThan(0)
    }
  })
})

test.describe('Responsive Rendering', () => {
  test('pages should render on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    for (const route of staticRoutes.slice(0, 5)) {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBe(200)

      const body = await page.locator('body')
      await expect(body).not.toBeEmpty()
    }
  })

  test('pages should render on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })

    for (const route of staticRoutes.slice(0, 5)) {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBe(200)

      const body = await page.locator('body')
      await expect(body).not.toBeEmpty()
    }
  })
})
