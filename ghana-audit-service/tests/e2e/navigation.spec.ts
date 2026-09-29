import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/')

    // Check page title
    await expect(page).toHaveTitle(/Ghana Audit Service/)

    // Check header is visible
    await expect(page.locator('header')).toBeVisible()

    // Check main navigation links (scoped to the header: the footer repeats them)
    const mainNav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(mainNav.getByRole('link', { name: /about/i })).toBeVisible()
    await expect(mainNav.getByRole('link', { name: /reports/i })).toBeVisible()
  })

  test('should navigate to About page', async ({ page }) => {
    await page.goto('/')

    // Click on About link
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: /about/i })
      .click()

    // Should be on about page
    await expect(page).toHaveURL(/\/about/)
  })

  test('should navigate to Reports page', async ({ page }) => {
    await page.goto('/')

    // Click on Reports link
    await page
      .getByRole('link', { name: /reports/i })
      .first()
      .click()

    // Should be on reports page
    await expect(page).toHaveURL(/\/reports/)
  })

  test('should have working skip to content link', async ({ page }) => {
    await page.goto('/')

    // Tab to skip link
    await page.keyboard.press('Tab')

    // Check skip link exists
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeVisible()
  })

  test('should toggle mobile menu on small screens', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Wait for hydration so the toggle's click handler is attached
    await page.waitForLoadState('networkidle')

    // Find and click mobile menu button
    const menuButton = page.getByRole('button', { name: /open menu/i })
    await expect(menuButton).toBeVisible()

    await menuButton.click()

    // Mobile menu is a dialog labelled "Menu"
    await expect(page.getByRole('dialog', { name: /menu/i })).toBeVisible()
  })
})

test.describe('Footer', () => {
  test('should display contact information', async ({ page }) => {
    await page.goto('/')

    // Scroll to footer
    await page.locator('footer').scrollIntoViewIfNeeded()

    // Check footer is visible
    await expect(page.locator('footer')).toBeVisible()

    // Check contact info exists (the header top bar repeats the address, so scope to the footer)
    await expect(page.locator('footer').getByText(/info@audit\.gov\.gh/i)).toBeVisible()
  })

  test('should have working social links', async ({ page }) => {
    await page.goto('/')

    // Scroll to footer
    await page.locator('footer').scrollIntoViewIfNeeded()

    // Check footer links exist
    const footerLinks = page.locator('footer a')
    const count = await footerLinks.count()

    expect(count).toBeGreaterThan(0)
  })
})
