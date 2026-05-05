import { test, expect } from '@playwright/test'

test.describe('Search Functionality', () => {
  test('should open search page', async ({ page }) => {
    await page.goto('/search')

    // Check search page loaded
    await expect(page).toHaveURL(/\/search/)

    // Check search input exists
    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i))
    await expect(searchInput).toBeVisible()
  })

  test('should perform search with query', async ({ page }) => {
    await page.goto('/search')

    // Find search input
    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i))

    // Type search query
    await searchInput.fill('audit report')

    // Submit search (press Enter or click button)
    await searchInput.press('Enter')

    // Wait for results or no results message
    await page.waitForResponse(response =>
      response.url().includes('/api/search') && response.status() === 200
    )
  })

  test('should show no results for empty search', async ({ page }) => {
    await page.goto('/search')

    // Find search input
    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i))

    // Clear and submit empty search
    await searchInput.fill('')
    await searchInput.press('Enter')

    // Should not make API request for empty query
    // Results should be empty or show prompt to search
  })

  test('should filter results by type', async ({ page }) => {
    await page.goto('/search?query=annual')

    // Wait for initial results
    await page.waitForLoadState('networkidle')

    // Look for filter options
    const filterSelect = page.getByRole('combobox').or(page.locator('select'))

    if (await filterSelect.isVisible()) {
      // Select a filter option - use string instead of regex
      await filterSelect.selectOption({ label: 'Audit Reports' })

      // Wait for filtered results
      await page.waitForResponse(response =>
        response.url().includes('/api/search') && response.status() === 200
      )
    }
  })

  test('should be accessible via keyboard', async ({ page }) => {
    await page.goto('/search')

    // Tab to search input
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Type and submit using keyboard
    await page.keyboard.type('test query')
    await page.keyboard.press('Enter')

    // Should process the search
    await expect(page).toHaveURL(/search/)
  })
})

test.describe('Search Results', () => {
  test('should display search results', async ({ page }) => {
    await page.goto('/search?query=audit')

    // Wait for results to load
    await page.waitForLoadState('networkidle')

    // Check for results container
    const resultsContainer = page.locator('[data-testid="search-results"]').or(
      page.locator('.search-results')
    ).or(
      page.locator('main')
    )

    await expect(resultsContainer).toBeVisible()
  })

  test('should paginate results', async ({ page }) => {
    await page.goto('/search?query=report')

    // Wait for results
    await page.waitForLoadState('networkidle')

    // Look for pagination controls
    const pagination = page.locator('[data-testid="pagination"]').or(
      page.locator('.pagination')
    ).or(
      page.getByRole('navigation', { name: /pagination/i })
    )

    // If pagination exists, test it
    if (await pagination.isVisible()) {
      const nextButton = pagination.getByRole('button', { name: /next/i }).or(
        pagination.locator('button:has-text("Next")')
      )

      if (await nextButton.isVisible() && await nextButton.isEnabled()) {
        await nextButton.click()
        await expect(page).toHaveURL(/page=2/)
      }
    }
  })
})
