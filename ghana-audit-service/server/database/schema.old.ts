import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

/**
 * Newsletter subscribers table
 * Stores email addresses of users who have subscribed to the newsletter
 */
export const newsletterSubscribers = sqliteTable('newsletter_subscribers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  subscribedAt: integer('subscribed_at', { mode: 'timestamp' }).notNull(),
  confirmed: integer('confirmed', { mode: 'boolean' }).notNull().default(false),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
  unsubscribedAt: integer('unsubscribed_at', { mode: 'timestamp' }),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent')
})

/**
 * Rate limit entries table
 * Stores rate limiting data for API endpoints
 */
export const rateLimitEntries = sqliteTable('rate_limit_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  identifier: text('identifier').notNull(),
  route: text('route').notNull(),
  count: integer('count').notNull().default(1),
  resetTime: integer('reset_time').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})

/**
 * Contact form submissions table
 * Stores messages submitted through the contact form
 */
export const contactSubmissions = sqliteTable('contact_submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  status: text('status').notNull().default('pending'), // pending, read, responded, archived
  respondedAt: integer('responded_at', { mode: 'timestamp' })
})

// Type exports for use in API routes
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect
export type NewNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert
export type RateLimitEntry = typeof rateLimitEntries.$inferSelect
export type NewRateLimitEntry = typeof rateLimitEntries.$inferInsert
export type ContactSubmission = typeof contactSubmissions.$inferSelect
export type NewContactSubmission = typeof contactSubmissions.$inferInsert
