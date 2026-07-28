import { describe, it, expect } from 'vitest'
import {
  contactSubmissionColumns,
  newsletterSubscriberColumns
} from '~/server/utils/dtoColumns'

// These projections exist to keep PII columns out of admin API responses.
// Pinning the exact key sets means adding a leaked column (ipAddress,
// userAgent, phone) — or silently dropping a DTO field — fails the build.
describe('dtoColumns', () => {
  it('contactSubmissionColumns matches the ContactSubmission DTO exactly', () => {
    expect(Object.keys(contactSubmissionColumns).sort()).toEqual([
      'email',
      'id',
      'message',
      'name',
      'respondedAt',
      'respondedBy',
      'status',
      'subject',
      'submittedAt'
    ])
  })

  it('newsletterSubscriberColumns matches the NewsletterSubscriber DTO exactly', () => {
    expect(Object.keys(newsletterSubscriberColumns).sort()).toEqual([
      'confirmed',
      'email',
      'id',
      'subscribedAt',
      'unsubscribedAt'
    ])
  })
})
