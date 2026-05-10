import { describe, it, expect } from 'vitest'
import { isProbingPath } from '../../../../server/utils/analytics/probingPaths'

describe('analytics/probingPaths', () => {
  it('matches dotenv variants', () => {
    expect(isProbingPath('/.env')).toBe(true)
    expect(isProbingPath('/.env.local')).toBe(true)
    expect(isProbingPath('/.env.production')).toBe(true)
    expect(isProbingPath('/.env.backup')).toBe(true)
  })

  it('matches WordPress probes', () => {
    expect(isProbingPath('/wp-login.php')).toBe(true)
    expect(isProbingPath('/wp-admin')).toBe(true)
    expect(isProbingPath('/wp-config.php')).toBe(true)
    expect(isProbingPath('/wp-admin/admin.php')).toBe(true)
    expect(isProbingPath('/wp-content/plugins/some-plugin/file.php')).toBe(true)
    expect(isProbingPath('/xmlrpc.php')).toBe(true)
  })

  it('matches phpMyAdmin variants', () => {
    expect(isProbingPath('/phpmyadmin')).toBe(true)
    expect(isProbingPath('/phpMyAdmin')).toBe(true)
    expect(isProbingPath('/pma')).toBe(true)
    expect(isProbingPath('/phpmyadmin/index.php')).toBe(true)
  })

  it('matches git/svn/secret leaks', () => {
    expect(isProbingPath('/.git')).toBe(true)
    expect(isProbingPath('/.git/config')).toBe(true)
    expect(isProbingPath('/.git/HEAD')).toBe(true)
    expect(isProbingPath('/.svn/entries')).toBe(true)
    expect(isProbingPath('/.aws/credentials')).toBe(true)
    expect(isProbingPath('/.ssh/id_rsa')).toBe(true)
  })

  it('matches Spring/Java actuator probes', () => {
    expect(isProbingPath('/actuator')).toBe(true)
    expect(isProbingPath('/actuator/env')).toBe(true)
    expect(isProbingPath('/actuator/health')).toBe(true)
  })

  it('strips query and fragment before matching', () => {
    expect(isProbingPath('/.env?cb=12345')).toBe(true)
    expect(isProbingPath('/wp-login.php#anchor')).toBe(true)
  })

  it('does not match legitimate site paths', () => {
    expect(isProbingPath('/')).toBe(false)
    expect(isProbingPath('/reports')).toBe(false)
    expect(isProbingPath('/reports/123')).toBe(false)
    expect(isProbingPath('/about/management-team')).toBe(false)
    expect(isProbingPath('/admin/users')).toBe(false) // we DO have an /admin
    expect(isProbingPath('/api/admin/users')).toBe(false)
    expect(isProbingPath('/api/news/some-article')).toBe(false)
    expect(isProbingPath('/news/wp-related-event')).toBe(false) // not a probe just because it contains "wp"
    expect(isProbingPath('/contact')).toBe(false)
  })

  it('handles empty / falsy input safely', () => {
    expect(isProbingPath('')).toBe(false)
  })
})
