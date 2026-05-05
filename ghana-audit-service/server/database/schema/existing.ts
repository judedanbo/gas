import {
  mysqlTable,
  int,
  varchar,
  datetime,
  boolean,
  text,
  bigint,
  mysqlEnum,
  index
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/**
 * Newsletter subscribers table
 * Stores email addresses of users who have subscribed to the newsletter
 */
export const newsletterSubscribers = mysqlTable(
  'newsletter_subscribers',
  {
    id: int('id').primaryKey().autoincrement(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    subscribedAt: datetime('subscribed_at').notNull(),
    confirmed: boolean('confirmed').notNull().default(false),
    confirmedAt: datetime('confirmed_at'),
    unsubscribedAt: datetime('unsubscribed_at'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent')
  },
  (table) => [index('idx_newsletter_email').on(table.email)]
)

/**
 * Rate limit entries table
 * Stores rate limiting data for API endpoints
 */
export const rateLimitEntries = mysqlTable(
  'rate_limit_entries',
  {
    id: int('id').primaryKey().autoincrement(),
    identifier: varchar('identifier', { length: 255 }).notNull(),
    route: varchar('route', { length: 255 }).notNull(),
    count: int('count').notNull().default(1),
    resetTime: bigint('reset_time', { mode: 'number' }).notNull(),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index('idx_rate_limit_identifier').on(table.identifier, table.route)]
)

/**
 * Contact form submissions table
 * Stores messages submitted through the contact form
 */
export const contactSubmissions = mysqlTable(
  'contact_submissions',
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }),
    subject: varchar('subject', { length: 500 }).notNull(),
    message: text('message').notNull(),
    submittedAt: datetime('submitted_at').notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    status: mysqlEnum('status', ['pending', 'read', 'responded', 'archived'])
      .notNull()
      .default('pending'),
    respondedAt: datetime('responded_at'),
    respondedBy: int('responded_by').references(() => users.id, { onDelete: 'set null' })
  },
  (table) => [
    index('idx_contact_status').on(table.status),
    index('idx_contact_submitted').on(table.submittedAt)
  ]
)

// Type exports
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect
export type NewNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert
export type RateLimitEntry = typeof rateLimitEntries.$inferSelect
export type NewRateLimitEntry = typeof rateLimitEntries.$inferInsert
export type ContactSubmission = typeof contactSubmissions.$inferSelect
export type NewContactSubmission = typeof contactSubmissions.$inferInsert
