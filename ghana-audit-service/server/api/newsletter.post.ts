import validator from 'validator'
import { eq } from 'drizzle-orm'
import { validateCSRF, createCSRFError } from '../utils/csrf'
import { getDatabase, schema } from '../database'
import { getClientIP } from '../utils/rateLimiter'
import { analyseBodyFields, highestSeverity } from '../utils/analytics/fuzzPatterns'
import { recordIncident } from '../utils/analytics/recordIncident'

export default defineEventHandler(async (event) => {
  // Validate CSRF token
  if (!validateCSRF(event)) {
    throw createCSRFError()
  }

  const body = await readBody(event)

  // Body-field fuzz scan. Runs before validation so we capture the raw
  // payload regardless of whether it would pass format checks. Flag-only.
  if (body && typeof body === 'object') {
    const fuzzMatches = analyseBodyFields(body as Record<string, unknown>)
    if (fuzzMatches.length > 0) {
      const stash = event.context.analytics
      recordIncident({
        kind: 'fuzz_attempt',
        severity: highestSeverity(fuzzMatches),
        ipHash: stash?.ipHash ?? null,
        uaHash: stash?.uaHash ?? null,
        routePattern: '/api/newsletter',
        routePath: '/api/newsletter',
        details: { source: 'body', matches: fuzzMatches }
      })
    }
  }

  // Validate request body
  if (!body || !body.email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email is required'
    })
  }

  // Sanitize and validate email
  const rawEmail = String(body.email || '').trim()

  // Normalize email (lowercase, remove dots from gmail, etc.)
  const normalizedEmail = validator.normalizeEmail(rawEmail, {
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    outlookdotcom_remove_subaddress: false,
    yahoo_remove_subaddress: false,
    icloud_remove_subaddress: false
  })

  if (!normalizedEmail || !validator.isEmail(normalizedEmail)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid email format'
    })
  }

  // Additional validation: check email length
  if (normalizedEmail.length > 254) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email address is too long'
    })
  }

  // Escape for safe storage (prevents XSS if displayed)
  const email = validator.escape(normalizedEmail)

  // Get database connection
  const db = getDatabase()
  if (!db) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Database connection not available'
    })
  }

  // Check if already subscribed
  const existingRows = await db
    .select()
    .from(schema.newsletterSubscribers)
    .where(eq(schema.newsletterSubscribers.email, email))
    .limit(1)
  const existing = existingRows[0]

  if (existing) {
    // If previously unsubscribed, resubscribe them
    if (existing.unsubscribedAt) {
      await db
        .update(schema.newsletterSubscribers)
        .set({
          unsubscribedAt: null,
          subscribedAt: new Date()
        })
        .where(eq(schema.newsletterSubscribers.email, email))

      console.log(`[Newsletter] Re-subscription: ${email}`)

      return {
        success: true,
        message: 'Welcome back! You have been re-subscribed to our newsletter.'
      }
    }

    return {
      success: true,
      message: 'You are already subscribed to our newsletter!'
    }
  }

  // Get client info for logging
  const ipAddress = getClientIP(event)
  const userAgent = getHeader(event, 'user-agent') || null

  // Add new subscriber to database
  await db.insert(schema.newsletterSubscribers).values({
    email,
    subscribedAt: new Date(),
    confirmed: false,
    ipAddress,
    userAgent
  })

  console.log(`[Newsletter] New subscription: ${email}`)

  return {
    success: true,
    message: 'Thank you for subscribing to our newsletter!'
  }
})
