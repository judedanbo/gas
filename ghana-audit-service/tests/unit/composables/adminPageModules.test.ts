import { describe, it, expect } from 'vitest'
import { moduleForAdminPage } from '../../../composables/useAdminAuth'

describe('moduleForAdminPage', () => {
  it('gates the home carousel and site statistics pages on the content module', () => {
    expect(moduleForAdminPage('/admin/carousel')).toBe('content')
    expect(moduleForAdminPage('/admin/site-stats')).toBe('content')
    expect(moduleForAdminPage('/admin/site-stats/3/edit')).toBe('content')
  })

  it('leaves the dashboard, profile and users pages un-gated', () => {
    expect(moduleForAdminPage('/admin')).toBeNull()
    expect(moduleForAdminPage('/admin/profile')).toBeNull()
    expect(moduleForAdminPage('/admin/users')).toBeNull()
  })
})
