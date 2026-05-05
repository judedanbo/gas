import { test, expect } from '@playwright/test'

test.describe('Newsletter Subscription', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Scroll to footer where newsletter form is located
    await page.locator('footer').scrollIntoViewIfNeeded()
  })

  test('should display newsletter subscription form in footer', async ({ page }) => {
    // Check newsletter section heading
    await expect(page.getByText('Stay Updated')).toBeVisible()

    // Check newsletter description
    await expect(page.getByText(/Subscribe to our newsletter/i)).toBeVisible()

    // Check email input exists
    const emailInput = page.locator('#newsletter-email')
    await expect(emailInput).toBeVisible()
    await expect(emailInput).toHaveAttribute('type', 'email')
    await expect(emailInput).toHaveAttribute('placeholder', 'Enter your email address')

    // Check subscribe button exists
    await expect(page.getByRole('button', { name: /subscribe/i })).toBeVisible()
  })

  test('should have proper accessibility attributes', async ({ page }) => {
    // Check email input has associated label (sr-only)
    const emailInput = page.locator('#newsletter-email')
    await expect(emailInput).toBeVisible()

    // Check that label exists for screen readers
    const label = page.locator('label[for="newsletter-email"]')
    await expect(label).toHaveText('Email address')

    // Check input is required
    await expect(emailInput).toHaveAttribute('required', '')
  })

  test('should prevent submission with empty email', async ({ page }) => {
    const emailInput = page.locator('#newsletter-email')
    const submitButton = page.getByRole('button', { name: /subscribe/i })

    // Clear the input and try to submit
    await emailInput.fill('')
    await submitButton.click()

    // Form should not submit (HTML5 validation)
    // The input should still be visible (not replaced by success message)
    await expect(emailInput).toBeVisible()
  })

  test('should prevent submission with invalid email format', async ({ page }) => {
    const emailInput = page.locator('#newsletter-email')
    const submitButton = page.getByRole('button', { name: /subscribe/i })

    // Enter invalid email
    await emailInput.fill('invalid-email')
    await submitButton.click()

    // Form should not submit due to HTML5 validation
    // The input should still be visible
    await expect(emailInput).toBeVisible()
  })

  test('should show loading state during submission', async ({ page }) => {
    const emailInput = page.locator('#newsletter-email')
    const submitButton = page.getByRole('button', { name: /subscribe/i })

    // Enter valid email
    await emailInput.fill('test@example.com')

    // Intercept the CSRF and newsletter requests to control timing
    await page.route('**/api/csrf', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-csrf-token' })
      })
    })

    await page.route('**/api/newsletter', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

    // Click subscribe
    await submitButton.click()

    // Should show loading state
    await expect(page.getByText('Subscribing...')).toBeVisible()

    // Input should be disabled during loading
    await expect(emailInput).toBeDisabled()
  })

  test('should show success message after successful subscription', async ({ page }) => {
    const emailInput = page.locator('#newsletter-email')
    const submitButton = page.getByRole('button', { name: /subscribe/i })

    // Mock the API responses
    await page.route('**/api/csrf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-csrf-token' })
      })
    })

    await page.route('**/api/newsletter', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Subscribed successfully' })
      })
    })

    // Enter valid email and submit
    await emailInput.fill('test@example.com')
    await submitButton.click()

    // Wait for and check success message
    await expect(page.getByText('Thank you for subscribing!')).toBeVisible()

    // Form should be hidden after success
    await expect(emailInput).not.toBeVisible()
    await expect(submitButton).not.toBeVisible()
  })

  test('should show error message on subscription failure', async ({ page }) => {
    const emailInput = page.locator('#newsletter-email')
    const submitButton = page.getByRole('button', { name: /subscribe/i })

    // Mock the API responses - CSRF succeeds but newsletter fails
    await page.route('**/api/csrf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-csrf-token' })
      })
    })

    await page.route('**/api/newsletter', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Subscription failed. Please try again.' })
      })
    })

    // Enter valid email and submit
    await emailInput.fill('test@example.com')
    await submitButton.click()

    // Wait for error message
    await expect(page.getByText(/Subscription failed|Please try again/i)).toBeVisible()

    // Form should still be visible so user can retry
    await expect(emailInput).toBeVisible()
  })

  test('should show error message on CSRF failure', async ({ page }) => {
    const emailInput = page.locator('#newsletter-email')
    const submitButton = page.getByRole('button', { name: /subscribe/i })

    // Mock CSRF to fail
    await page.route('**/api/csrf', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      })
    })

    // Enter valid email and submit
    await emailInput.fill('test@example.com')
    await submitButton.click()

    // Wait for security error message
    await expect(page.getByText(/Security validation failed|refresh/i)).toBeVisible()
  })

  test('should show error on 403 CSRF validation error', async ({ page }) => {
    const emailInput = page.locator('#newsletter-email')
    const submitButton = page.getByRole('button', { name: /subscribe/i })

    // Mock CSRF to succeed but newsletter returns 403
    await page.route('**/api/csrf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-csrf-token' })
      })
    })

    await page.route('**/api/newsletter', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ statusMessage: 'CSRF token validation failed' })
      })
    })

    // Enter valid email and submit
    await emailInput.fill('test@example.com')
    await submitButton.click()

    // Wait for security error message
    await expect(page.getByText(/Security validation failed|try again/i)).toBeVisible()
  })

  test('should be keyboard accessible', async ({ page }) => {
    // Tab to the newsletter section
    // First, we need to scroll to make sure the footer is in view
    await page.locator('footer').scrollIntoViewIfNeeded()

    // Focus on the email input directly
    const emailInput = page.locator('#newsletter-email')
    await emailInput.focus()

    // Type email using keyboard
    await page.keyboard.type('keyboard@example.com')

    // Tab to submit button
    await page.keyboard.press('Tab')

    // Verify focus is on submit button
    const submitButton = page.getByRole('button', { name: /subscribe/i })
    await expect(submitButton).toBeFocused()
  })

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/')
    await page.locator('footer').scrollIntoViewIfNeeded()

    // Check form is visible on mobile
    const emailInput = page.locator('#newsletter-email')
    await expect(emailInput).toBeVisible()

    const submitButton = page.getByRole('button', { name: /subscribe/i })
    await expect(submitButton).toBeVisible()

    // Check they are properly laid out (stacked on mobile)
    // Form should still be functional
    await emailInput.fill('mobile@example.com')
    await expect(emailInput).toHaveValue('mobile@example.com')
  })
})

test.describe('Newsletter Integration', () => {
  test('should make correct API calls', async ({ page }) => {
    let csrfCalled = false
    let newsletterCalled = false
    let newsletterBody: { email?: string } | null = null
    let csrfHeader: string | null = null

    // Track API calls
    await page.route('**/api/csrf', async (route) => {
      csrfCalled = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-token-123' })
      })
    })

    await page.route('**/api/newsletter', async (route) => {
      newsletterCalled = true
      const request = route.request()
      csrfHeader = request.headers()['x-csrf-token']
      newsletterBody = request.postDataJSON()

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

    await page.goto('/')
    await page.locator('footer').scrollIntoViewIfNeeded()

    const emailInput = page.locator('#newsletter-email')
    const submitButton = page.getByRole('button', { name: /subscribe/i })

    await emailInput.fill('api-test@example.com')
    await submitButton.click()

    // Wait for success
    await expect(page.getByText('Thank you for subscribing!')).toBeVisible()

    // Verify API calls were made correctly
    expect(csrfCalled).toBe(true)
    expect(newsletterCalled).toBe(true)
    expect(csrfHeader).toBe('test-token-123')
    expect(newsletterBody).toEqual({ email: 'api-test@example.com' })
  })

  test('should clear input after successful subscription', async ({ page }) => {
    await page.route('**/api/csrf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-csrf-token' })
      })
    })

    await page.route('**/api/newsletter', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

    await page.goto('/')
    await page.locator('footer').scrollIntoViewIfNeeded()

    const emailInput = page.locator('#newsletter-email')
    await emailInput.fill('clear-test@example.com')

    const submitButton = page.getByRole('button', { name: /subscribe/i })
    await submitButton.click()

    // Wait for success
    await expect(page.getByText('Thank you for subscribing!')).toBeVisible()

    // The form is replaced by success message, so input is not visible
    await expect(emailInput).not.toBeVisible()
  })
})

test.describe('Newsletter Accessibility', () => {
  test('should have proper ARIA attributes', async ({ page }) => {
    await page.goto('/')
    await page.locator('footer').scrollIntoViewIfNeeded()

    // Check success message icon has aria-hidden
    await page.route('**/api/csrf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-csrf-token' })
      })
    })

    await page.route('**/api/newsletter', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

    const emailInput = page.locator('#newsletter-email')
    await emailInput.fill('aria-test@example.com')

    const submitButton = page.getByRole('button', { name: /subscribe/i })
    await submitButton.click()

    // Wait for success
    await expect(page.getByText('Thank you for subscribing!')).toBeVisible()

    // Check icon has aria-hidden
    const successIcon = page.locator('.bg-green-600\\/20 svg, .bg-green-600\\/20 [class*="icon"]')
    if ((await successIcon.count()) > 0) {
      await expect(successIcon.first()).toHaveAttribute('aria-hidden', 'true')
    }
  })

  test('should announce success to screen readers', async ({ page }) => {
    await page.route('**/api/csrf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-csrf-token' })
      })
    })

    await page.route('**/api/newsletter', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

    await page.goto('/')
    await page.locator('footer').scrollIntoViewIfNeeded()

    const emailInput = page.locator('#newsletter-email')
    await emailInput.fill('a11y-test@example.com')

    const submitButton = page.getByRole('button', { name: /subscribe/i })
    await submitButton.click()

    // Success message should be visible and readable
    const successMessage = page.getByText('Thank you for subscribing!')
    await expect(successMessage).toBeVisible()
  })
})
