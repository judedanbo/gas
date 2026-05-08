import validator from 'validator'
import { validateCSRF, createCSRFError } from '../utils/csrf'
import { getDatabase, schema } from '../database'
import { getClientIP } from '../utils/rateLimiter'
import { sendContactNotification } from '../utils/email'

export default defineEventHandler(async (event) => {
  // Validate CSRF token
  if (!validateCSRF(event)) {
    throw createCSRFError()
  }

  const body = await readBody(event)

  // Validate required fields
  const errors: Record<string, string> = {}

  // Name validation
  const name = String(body?.name || '').trim()
  if (!name) {
    errors.name = 'Full name is required'
  } else if (name.length > 255) {
    errors.name = 'Name must be less than 255 characters'
  }

  // Email validation
  const rawEmail = String(body?.email || '').trim()
  if (!rawEmail) {
    errors.email = 'Email address is required'
  } else {
    const normalizedEmail = validator.normalizeEmail(rawEmail, {
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false
    })

    if (!normalizedEmail || !validator.isEmail(normalizedEmail)) {
      errors.email = 'Please enter a valid email address'
    } else if (normalizedEmail.length > 255) {
      errors.email = 'Email address is too long'
    }
  }

  // Phone validation (optional)
  const phone = String(body?.phone || '').trim() || null
  if (phone && phone.length > 50) {
    errors.phone = 'Phone number must be less than 50 characters'
  }

  // Subject validation
  const subject = String(body?.subject || '').trim()
  if (!subject) {
    errors.subject = 'Please select a subject'
  } else if (subject.length > 500) {
    errors.subject = 'Subject must be less than 500 characters'
  }

  // Message validation
  const message = String(body?.message || '').trim()
  if (!message) {
    errors.message = 'Message is required'
  } else if (message.length < 10) {
    errors.message = 'Message must be at least 10 characters'
  } else if (message.length > 10000) {
    errors.message = 'Message must be less than 10,000 characters'
  }

  // Return validation errors if any
  if (Object.keys(errors).length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors }
    })
  }

  // Sanitize inputs for safe storage
  const sanitizedName = validator.escape(name)
  const sanitizedEmail = validator.escape(
    validator.normalizeEmail(rawEmail, {
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false
    }) || rawEmail
  )
  const sanitizedPhone = phone ? validator.escape(phone) : null
  const sanitizedSubject = validator.escape(subject)
  // Don't escape message content to preserve formatting, but it will be escaped on display
  const sanitizedMessage = message

  // Get database connection
  const db = getDatabase()
  if (!db) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Database connection not available'
    })
  }

  // Get client IP for logging
  const ipAddress = getClientIP(event)

  // Insert contact submission into database
  await db.insert(schema.contactSubmissions).values({
    name: sanitizedName,
    email: sanitizedEmail,
    phone: sanitizedPhone,
    subject: sanitizedSubject,
    message: sanitizedMessage,
    submittedAt: new Date(),
    ipAddress,
    status: 'pending'
  })

  console.log(`[Contact] New submission from: ${sanitizedEmail} - Subject: ${sanitizedSubject}`)

  // Send notification email to info@audit.gov.gh (non-blocking — don't fail the request if email fails)
  sendContactNotification({
    name: sanitizedName,
    email: sanitizedEmail,
    phone: sanitizedPhone,
    subject: sanitizedSubject,
    message: sanitizedMessage
  }).catch((err) => {
    console.error('[Contact] Failed to send notification email:', err)
  })

  return {
    success: true,
    message: 'Thank you for your message! We will get back to you within 2-3 business days.'
  }
})
