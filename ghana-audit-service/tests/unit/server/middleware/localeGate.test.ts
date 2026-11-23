import { describe, it, expect, vi, beforeEach } from 'vitest'

const enabled = new Set<string>()

vi.mock('~/server/utils/languageStore', () => ({
  isLanguageEnabled: vi.fn(async (code: string) => enabled.has(code))
}))

const sendRedirect = vi.fn((_event: unknown, location: string, code: number) => ({
  location,
  code
}))
vi.mock('h3', () => ({
  sendRedirect: (event: unknown, location: string, code: number) =>
    sendRedirect(event, location, code)
}))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)

const gate = (await import('~/server/middleware/01-locale-gate')).default as unknown as (event: {
  path: string
}) => Promise<unknown>

beforeEach(() => {
  enabled.clear()
  sendRedirect.mockClear()
})

describe('locale gate middleware', () => {
  it('redirects a language that is not switched on to the English page', async () => {
    expect(await gate({ path: '/ak/reports/5?year=2024' })).toEqual({
      location: '/reports/5?year=2024',
      code: 302
    })
    expect(await gate({ path: '/ee' })).toEqual({ location: '/', code: 302 })
  })

  it('lets an enabled language through', async () => {
    enabled.add('ak')
    expect(await gate({ path: '/ak/reports' })).toBeUndefined()
    expect(sendRedirect).not.toHaveBeenCalled()
  })

  it('ignores English pages, APIs and look-alike paths', async () => {
    for (const path of ['/', '/reports', '/api/news', '/akan', '/admin/languages/ak']) {
      expect(await gate({ path })).toBeUndefined()
    }
    expect(sendRedirect).not.toHaveBeenCalled()
  })
})
