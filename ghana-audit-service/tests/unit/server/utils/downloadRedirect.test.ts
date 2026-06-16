import { describe, it, expect, afterEach } from 'vitest'
import { getRedirectAllowedHosts, isRedirectAllowed } from '~/server/utils/downloadRedirect'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('getRedirectAllowedHosts', () => {
  it('always includes the canonical live-site host', () => {
    delete process.env.DOWNLOAD_REDIRECT_ALLOWED_HOSTS
    expect(getRedirectAllowedHosts(null).has('audit.gov.gh')).toBe(true)
  })

  it('adds the configured site host (lowercased, from a full URL)', () => {
    delete process.env.DOWNLOAD_REDIRECT_ALLOWED_HOSTS
    const hosts = getRedirectAllowedHosts('https://Test.Audit.GOV.gh')
    expect(hosts.has('test.audit.gov.gh')).toBe(true)
    expect(hosts.has('audit.gov.gh')).toBe(true)
  })

  it('ignores an unparseable site URL but keeps the canonical host', () => {
    delete process.env.DOWNLOAD_REDIRECT_ALLOWED_HOSTS
    const hosts = getRedirectAllowedHosts('not a url')
    expect(hosts.has('audit.gov.gh')).toBe(true)
    expect(hosts.size).toBe(1)
  })

  it('unions in hosts from DOWNLOAD_REDIRECT_ALLOWED_HOSTS (trimmed, lowercased, blanks dropped)', () => {
    process.env.DOWNLOAD_REDIRECT_ALLOWED_HOSTS = ' Files.Example.com , , cdn.example.org '
    const hosts = getRedirectAllowedHosts('https://audit.gov.gh')
    expect(hosts.has('files.example.com')).toBe(true)
    expect(hosts.has('cdn.example.org')).toBe(true)
    expect(hosts.has('audit.gov.gh')).toBe(true)
  })
})

describe('isRedirectAllowed', () => {
  const allowed = new Set(['audit.gov.gh', 'test.audit.gov.gh'])

  it('allows an absolute https URL on an allowlisted host', () => {
    expect(isRedirectAllowed('https://audit.gov.gh/files/x.pdf', allowed)).toBe(true)
  })

  it('allows http as well as https on an allowlisted host', () => {
    expect(isRedirectAllowed('http://audit.gov.gh/files/x.pdf', allowed)).toBe(true)
  })

  it('matches the host case-insensitively', () => {
    expect(isRedirectAllowed('https://AUDIT.GOV.GH/x.pdf', allowed)).toBe(true)
  })

  it('denies a host that is not on the allowlist', () => {
    expect(isRedirectAllowed('https://evil.com/malware.pdf', allowed)).toBe(false)
  })

  it('denies a non-allowlisted subdomain', () => {
    expect(isRedirectAllowed('https://evil.audit.gov.gh.attacker.com/x.pdf', allowed)).toBe(false)
  })

  it('denies relative paths (not absolute URLs)', () => {
    expect(isRedirectAllowed('/uploads/publications/x.pdf', allowed)).toBe(false)
  })

  it('denies non-http(s) schemes even on an allowlisted host', () => {
    expect(isRedirectAllowed('javascript:alert(1)', allowed)).toBe(false)
    expect(isRedirectAllowed('file:///etc/passwd', allowed)).toBe(false)
  })

  it('denies malformed / empty input', () => {
    expect(isRedirectAllowed('http://', allowed)).toBe(false)
    expect(isRedirectAllowed('', allowed)).toBe(false)
    expect(isRedirectAllowed(null, allowed)).toBe(false)
    expect(isRedirectAllowed(undefined, allowed)).toBe(false)
  })

  it('denies userinfo-embedded host spoofing (real host is the attacker)', () => {
    expect(isRedirectAllowed('https://audit.gov.gh@evil.com/x.pdf', allowed)).toBe(false)
  })
})
