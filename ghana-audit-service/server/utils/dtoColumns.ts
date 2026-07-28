import { schema } from '../database'

/**
 * Explicit column projections for entities whose tables hold more than their
 * admin DTO exposes. Passing these to .select() keeps PII out of API
 * responses at the query level — a bare .select() on these tables would leak
 * ipAddress/userAgent/phone, which types/admin.ts deliberately omits.
 */

/** Matches types/admin.ts ContactSubmission (omits phone, ipAddress). */
export const contactSubmissionColumns = {
  id: schema.contactSubmissions.id,
  name: schema.contactSubmissions.name,
  email: schema.contactSubmissions.email,
  subject: schema.contactSubmissions.subject,
  message: schema.contactSubmissions.message,
  status: schema.contactSubmissions.status,
  respondedAt: schema.contactSubmissions.respondedAt,
  respondedBy: schema.contactSubmissions.respondedBy,
  submittedAt: schema.contactSubmissions.submittedAt
}

/** Matches types/admin.ts NewsletterSubscriber (omits confirmedAt, ipAddress, userAgent). */
export const newsletterSubscriberColumns = {
  id: schema.newsletterSubscribers.id,
  email: schema.newsletterSubscribers.email,
  confirmed: schema.newsletterSubscribers.confirmed,
  subscribedAt: schema.newsletterSubscribers.subscribedAt,
  unsubscribedAt: schema.newsletterSubscribers.unsubscribedAt
}
