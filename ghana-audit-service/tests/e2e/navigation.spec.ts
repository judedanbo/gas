import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/')

    // Check page title
    await expect(page).toHaveTitle(/Ghana Audit Service/)

    // Check header is visible
    await expect(page.locator('header')).toBeVisible()

    // Check main navigation links
    await expect(page.getByRole('link', { name: /about/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /reports/i })).toBeVisible()
  })

  test('should navigate to About page', async ({ page }) => {
    await page.goto('/')

    // Click on About link
    await page.getByRole('link', { name: /about/i }).first().click()

    // Should be on about page
    await expect(page).toHaveURL(/\/about/)
  })

  test('should navigate to Reports page', async ({ page }) => {
    await page.goto('/')

    // Click on Reports link
    await page.getByRole('link', { name: /reports/i }).first().click()

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

    // Find and click mobile menu button
    const menuButton = page.getByRole('button', { name: /menu/i })
    await expect(menuButton).toBeVisible()

    await menuButton.click()

    // Mobile menu should be visible
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
  })
})

test.describe('Footer', () => {
  test('should display contact information', async ({ page }) => {
    await page.goto('/')

    // Scroll to footer
    await page.locator('footer').scrollIntoViewIfNeeded()

    // Check footer is visible
    await expect(page.locator('footer')).toBeVisible()

    // Check contact info exists
    await expect(page.getByText(/info@audit\.gov\.gh/i)).toBeVisible()
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
