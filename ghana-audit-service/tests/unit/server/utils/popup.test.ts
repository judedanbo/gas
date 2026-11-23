import { describe, it, expect } from 'vitest'
import { transformPopup } from '../../../../server/utils/transformPopup'
import { popupSchema } from '../../../../server/utils/validation'

const row = {
  id: 7,
  title: 'Audit Week 2026',
  imageUrl: '/uploads/images/20261123-abc.png',
  altText: 'Audit Week runs 1–5 December',
  linkUrl: '/media/events',
  openInNewTab: false,
  startsAt: new Date('2026-12-01T00:00:00Z'),
  endsAt: null,
  displaySeconds: 30,
  isDismissible: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 3,
  deletedAt: null
}

describe('transformPopup', () => {
  it('exposes only what the public pop-up needs', () => {
    expect(transformPopup(row)).toEqual({
      id: 7,
      title: 'Audit Week 2026',
      imageUrl: '/uploads/images/20261123-abc.png',
      altText: 'Audit Week runs 1–5 December',
      linkUrl: '/media/events',
      openInNewTab: false,
      displaySeconds: 30,
      isDismissible: false
    })
  })

  it('falls back to the title when there is no image description', () => {
    expect(transformPopup({ ...row, altText: null }).altText).toBe('Audit Week 2026')
    expect(transformPopup({ ...row, altText: '   ' }).altText).toBe('Audit Week 2026')
  })

  it('omits an empty link', () => {
    expect(transformPopup({ ...row, linkUrl: null }).linkUrl).toBeUndefined()
  })
})

describe('popupSchema', () => {
  const valid = { title: 'Audit Week', imageUrl: '/uploads/images/a.png' }

  it('defaults to 30 seconds, not dismissible, active, no schedule', () => {
    const parsed = popupSchema.parse(valid)
    expect(parsed.displaySeconds).toBe(30)
    expect(parsed.isDismissible).toBe(false)
    expect(parsed.isActive).toBe(true)
    expect(parsed.openInNewTab).toBe(false)
    expect(parsed.startsAt ?? null).toBeNull()
    expect(parsed.endsAt ?? null).toBeNull()
  })

  it('accepts a custom display time and rejects out-of-range ones', () => {
    expect(popupSchema.parse({ ...valid, displaySeconds: 10 }).displaySeconds).toBe(10)
    expect(popupSchema.safeParse({ ...valid, displaySeconds: 0 }).success).toBe(false)
    expect(popupSchema.safeParse({ ...valid, displaySeconds: 301 }).success).toBe(false)
    expect(popupSchema.safeParse({ ...valid, displaySeconds: 2.5 }).success).toBe(false)
  })

  it('requires a title and an image', () => {
    expect(popupSchema.safeParse({ ...valid, title: ' ' }).success).toBe(false)
    expect(popupSchema.safeParse({ ...valid, imageUrl: '' }).success).toBe(false)
  })

  it.each(['/reports', '/ak/reports?year=2025', 'https://example.com/x', 'http://example.com'])(
    'accepts link %s',
    (linkUrl) => {
      expect(popupSchema.safeParse({ ...valid, linkUrl }).success).toBe(true)
    }
  )

  it.each([
    'javascript:alert(1)',
    '//evil.example',
    '/\\evil.example',
    'data:text/html,x',
    'reports'
  ])('rejects link %s', (linkUrl) => {
    expect(popupSchema.safeParse({ ...valid, linkUrl }).success).toBe(false)
  })

  it('treats an empty link and empty dates as unset', () => {
    const parsed = popupSchema.parse({ ...valid, linkUrl: '', startsAt: '', endsAt: '' })
    expect(parsed.linkUrl).toBeNull()
    expect(parsed.startsAt).toBeNull()
    expect(parsed.endsAt).toBeNull()
  })

  it('rejects remote images that are not https, and script URLs', () => {
    expect(popupSchema.safeParse({ ...valid, imageUrl: 'http://example.com/a.png' }).success).toBe(
      false
    )
    expect(popupSchema.safeParse({ ...valid, imageUrl: 'javascript:alert(1)' }).success).toBe(false)
    expect(popupSchema.safeParse({ ...valid, imageUrl: 'https://example.com/a.png' }).success).toBe(
      true
    )
  })

  it('rejects an end that is not after the start', () => {
    const result = popupSchema.safeParse({
      ...valid,
      startsAt: '2026-12-05T00:00:00.000Z',
      endsAt: '2026-12-01T00:00:00.000Z'
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['endsAt'])
  })

  it('rejects unparseable dates', () => {
    expect(popupSchema.safeParse({ ...valid, startsAt: 'next tuesday-ish' }).success).toBe(false)
  })
})
