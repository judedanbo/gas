import { describe, it, expect, vi, beforeAll } from 'vitest'
import {
  moduleForPath,
  resolveUserModules,
  userHasModule,
  requireModuleAccess,
  MODULE_KEYS
} from '../../../server/utils/modules'

// modules.ts uses the Nitro auto-imported `createError` (only at call time,
// inside requireModuleAccess) — stub it before any test runs.
beforeAll(() => {
  vi.stubGlobal('createError', (opts: Record<string, unknown>) =>
    Object.assign(new Error(String(opts.message ?? 'error')), opts)
  )
})

describe('moduleForPath', () => {
  it('maps first segment under /api/admin to a module', () => {
    expect(moduleForPath('/api/admin/reports')).toBe('reports')
    expect(moduleForPath('/api/admin/news')).toBe('content')
    expect(moduleForPath('/api/admin/tenders')).toBe('careers')
    expect(moduleForPath('/api/admin/offices')).toBe('organization')
    expect(moduleForPath('/api/admin/videos')).toBe('media')
    expect(moduleForPath('/api/admin/audit-logs')).toBe('analytics')
    expect(moduleForPath('/api/admin/newsletter')).toBe('communications')
  })

  it('resolves nested and dynamic routes on the first segment', () => {
    expect(moduleForPath('/api/admin/reports/5')).toBe('reports')
    expect(moduleForPath('/api/admin/reports/5/history')).toBe('reports')
    expect(moduleForPath('/api/admin/gallery/albums/2')).toBe('media')
    expect(moduleForPath('/api/admin/news/check-slug')).toBe('content')
  })

  it('strips a trailing query string', () => {
    expect(moduleForPath('/api/admin/reports?page=1&perPage=20')).toBe('reports')
  })

  it('returns null for un-gated and unknown segments', () => {
    expect(moduleForPath('/api/admin/auth/me')).toBeNull()
    expect(moduleForPath('/api/admin/upload')).toBeNull()
    expect(moduleForPath('/api/admin/users')).toBeNull()
    expect(moduleForPath('/api/admin/users/3')).toBeNull()
    expect(moduleForPath('/api/admin/something-new')).toBeNull()
    expect(moduleForPath('/api/admin')).toBeNull()
  })
})

describe('resolveUserModules', () => {
  it('gives admins every module regardless of stored value', () => {
    expect(resolveUserModules('admin', null)).toEqual([...MODULE_KEYS])
    expect(resolveUserModules('admin', [])).toEqual([...MODULE_KEYS])
    expect(resolveUserModules('admin', ['content'])).toEqual([...MODULE_KEYS])
  })

  it('returns the stored list for non-admins', () => {
    expect(resolveUserModules('editor', ['content', 'media'])).toEqual(['content', 'media'])
    expect(resolveUserModules('viewer', ['reports'])).toEqual(['reports'])
  })

  it('treats null/empty as no access for non-admins', () => {
    expect(resolveUserModules('editor', null)).toEqual([])
    expect(resolveUserModules('viewer', [])).toEqual([])
  })

  it('filters out unknown module keys', () => {
    expect(resolveUserModules('editor', ['content', 'bogus', 'media'])).toEqual([
      'content',
      'media'
    ])
  })
})

function fakeEvent(user: unknown) {
  return { context: { auth: user ? { user } : undefined } } as never
}

describe('userHasModule', () => {
  it('is false when unauthenticated', () => {
    expect(userHasModule(fakeEvent(null), 'content')).toBe(false)
  })

  it('is always true for admins', () => {
    expect(userHasModule(fakeEvent({ role: 'admin', modules: [] }), 'reports')).toBe(true)
  })

  it('checks the module list for non-admins', () => {
    const ev = fakeEvent({ role: 'editor', modules: ['content'] })
    expect(userHasModule(ev, 'content')).toBe(true)
    expect(userHasModule(ev, 'reports')).toBe(false)
  })
})

describe('requireModuleAccess', () => {
  it('throws a 403 when the user lacks the module', () => {
    const ev = fakeEvent({ role: 'viewer', modules: ['reports'] })
    expect(() => requireModuleAccess(ev, 'content')).toThrowError(/access to the content module/)
    try {
      requireModuleAccess(ev, 'content')
    } catch (e) {
      expect((e as { statusCode: number }).statusCode).toBe(403)
    }
  })

  it('does not throw when the user has the module (or is admin)', () => {
    expect(() =>
      requireModuleAccess(fakeEvent({ role: 'editor', modules: ['content'] }), 'content')
    ).not.toThrow()
    expect(() =>
      requireModuleAccess(fakeEvent({ role: 'admin', modules: [] }), 'media')
    ).not.toThrow()
  })
})
