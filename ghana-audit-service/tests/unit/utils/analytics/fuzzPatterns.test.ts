import { describe, it, expect } from 'vitest'
import {
  analyseInput,
  analyseQueryString,
  analyseBodyFields,
  severityFor,
  highestSeverity
} from '../../../../server/utils/analytics/fuzzPatterns'

describe('analytics/fuzzPatterns', () => {
  describe('analyseInput — SQL injection', () => {
    it('matches classic OR-true patterns', () => {
      expect(analyseInput("' OR 1=1", 'q')?.kind).toBe('sqli')
      expect(analyseInput("admin' OR '1'='1", 'q')?.kind).toBe('sqli')
      expect(analyseInput("1' AND col=col", 'q')?.kind).toBe('sqli')
    })

    it('matches UNION SELECT', () => {
      expect(analyseInput("' UNION SELECT 1,2,3 --", 'q')?.kind).toBe('sqli')
      expect(analyseInput('UNION ALL SELECT username FROM users', 'q')?.kind).toBe('sqli')
    })

    it('matches stacked DROP/DELETE/UPDATE', () => {
      expect(analyseInput("'; DROP TABLE users", 'q')?.kind).toBe('sqli')
      expect(analyseInput('test; DELETE FROM users', 'q')?.kind).toBe('sqli')
    })

    it('matches time-based blind / schema enumeration', () => {
      expect(analyseInput("' OR sleep(5)=", 'q')?.kind).toBe('sqli')
      expect(analyseInput('SELECT * FROM information_schema.tables', 'q')?.kind).toBe('sqli')
    })

    it('does NOT trip on apostrophes in legitimate prose', () => {
      expect(analyseInput("John's report", 'q')).toBeNull()
      expect(analyseInput("We can't ship that", 'message')).toBeNull()
      expect(analyseInput("O'Brien & Sons", 'name')).toBeNull()
      expect(analyseInput("don't and won't", 'message')).toBeNull()
    })

    it('does NOT trip on plain hyphens or dashes', () => {
      expect(analyseInput('re-issue', 'q')).toBeNull()
      expect(analyseInput('audit-2023', 'q')).toBeNull()
    })
  })

  describe('analyseInput — XSS', () => {
    it('matches script tags', () => {
      expect(analyseInput('<script>alert(1)</script>', 'msg')?.kind).toBe('xss')
      expect(analyseInput('<SCRIPT >evil()</SCRIPT>', 'msg')?.kind).toBe('xss')
    })

    it('matches javascript: URI and event handlers', () => {
      expect(analyseInput('javascript:alert(1)', 'q')?.kind).toBe('xss')
      expect(analyseInput('<img src=x onerror=alert(1)>', 'q')?.kind).toBe('xss')
      expect(analyseInput('<svg onload=alert(1)>', 'q')?.kind).toBe('xss')
    })

    it('matches iframe and document.cookie', () => {
      expect(analyseInput('<iframe src=evil>', 'q')?.kind).toBe('xss')
      expect(analyseInput('document.cookie', 'q')?.kind).toBe('xss')
    })

    it('does NOT trip on legitimate text mentioning script', () => {
      // "script" alone (no <) is fine.
      expect(analyseInput('the script of the play', 'q')).toBeNull()
      expect(analyseInput('JavaScript engineer', 'q')).toBeNull()
    })
  })

  describe('analyseInput — path traversal', () => {
    it('matches dot-dot-slash variants', () => {
      expect(analyseInput('../../etc/passwd', 'file')?.kind).toBe('path_traversal')
      expect(analyseInput('..\\..\\windows', 'file')?.kind).toBe('path_traversal')
    })

    it('matches direct sensitive paths', () => {
      expect(analyseInput('/etc/passwd', 'q')?.kind).toBe('path_traversal')
      expect(analyseInput('c:\\windows\\system32', 'q')?.kind).toBe('path_traversal')
      expect(analyseInput('/proc/self/environ', 'q')?.kind).toBe('path_traversal')
    })

    it('does NOT trip on URLs with /etc in legitimate context', () => {
      expect(analyseInput('see chapter on infrastructure', 'q')).toBeNull()
    })
  })

  describe('analyseInput — SSRF', () => {
    it('matches non-http schemes at value start', () => {
      expect(analyseInput('file:///etc/passwd', 'url')?.kind).toBe('path_traversal')
      // Above is path_traversal because /etc/passwd matches first; try
      // a clean SSRF probe:
      expect(analyseInput('gopher://127.0.0.1', 'url')?.kind).toBe('ssrf')
      expect(analyseInput('dict://localhost:11211', 'url')?.kind).toBe('ssrf')
    })

    it('matches cloud metadata IP', () => {
      expect(analyseInput('http://169.254.169.254/latest', 'url')?.kind).toBe('ssrf')
      expect(analyseInput('https://metadata.google.internal/', 'url')?.kind).toBe('ssrf')
    })
  })

  describe('analyseInput — encoded payload heuristic', () => {
    it('fires on multiple percent-encoded suspicious tokens', () => {
      // %27 (') + %20 OR %20 + %3d (=) — encoded "' OR 1="
      expect(analyseInput('%27%20OR%201%3D1', 'q')?.kind).toBe('encoded_payload')
      // %3c%73%63%72%69%70%74 — encoded <script
      expect(analyseInput('%3cscript%3e', 'q')?.kind).toBe('encoded_payload')
    })

    it('does NOT fire on a single benign %20', () => {
      expect(analyseInput('hello%20world', 'q')).toBeNull()
    })
  })

  describe('analyseInput — length anomaly', () => {
    it('fires on inputs over 1024 chars', () => {
      const long = 'a'.repeat(1025)
      expect(analyseInput(long, 'q')?.kind).toBe('length_anomaly')
    })

    it('does NOT fire just under threshold', () => {
      expect(analyseInput('a'.repeat(1024), 'q')).toBeNull()
    })

    it('truncates the sample to 200 chars', () => {
      const m = analyseInput('a'.repeat(1500), 'q')
      expect(m).not.toBeNull()
      expect(m!.sample.length).toBe(200)
    })
  })

  describe('analyseInput — short inputs', () => {
    it('returns null for inputs under 4 chars', () => {
      expect(analyseInput('a', 'q')).toBeNull()
      expect(analyseInput("' ", 'q')).toBeNull()
      expect(analyseInput('', 'q')).toBeNull()
    })
  })

  describe('analyseQueryString', () => {
    it('parses and scans every field', () => {
      const matches = analyseQueryString("/api/reports?search='%20OR%201%3D1&category=audit")
      // Either the decoded sqli match or the encoded_payload should fire on `search`.
      expect(matches.length).toBeGreaterThanOrEqual(1)
      expect(matches.some((m) => m.field === 'search')).toBe(true)
    })

    it('returns empty for paths without a query string', () => {
      expect(analyseQueryString('/api/reports')).toEqual([])
      expect(analyseQueryString('/')).toEqual([])
    })

    it('returns empty when all fields are benign', () => {
      expect(analyseQueryString('/api/reports?page=2&perPage=10')).toEqual([])
      expect(analyseQueryString("/api/reports?search=John's%20report")).toEqual([])
    })

    it('detects xss in filter params', () => {
      const matches = analyseQueryString('/api/gallery?category=<script>alert(1)</script>')
      expect(matches[0]?.kind).toBe('xss')
      expect(matches[0]?.field).toBe('category')
    })
  })

  describe('analyseBodyFields', () => {
    it('scans string body fields', () => {
      const matches = analyseBodyFields({
        name: 'normal name',
        message: '<script>alert(1)</script>',
        email: 'a@b.c'
      })
      expect(matches).toHaveLength(1)
      expect(matches[0].kind).toBe('xss')
      expect(matches[0].field).toBe('message')
    })

    it('skips password-like fields to avoid false positives', () => {
      // A user password may legitimately contain SQL-shaped strings.
      const matches = analyseBodyFields({
        email: 'a@b.c',
        password: "' OR 1=1 --"
      })
      expect(matches).toHaveLength(0)
    })

    it('skips non-string fields', () => {
      const matches = analyseBodyFields({
        page: 2,
        active: true,
        tags: ['a', 'b']
      })
      expect(matches).toHaveLength(0)
    })

    it('returns empty for benign bodies', () => {
      const matches = analyseBodyFields({
        name: "John O'Brien",
        email: 'john@example.com',
        subject: 'Question about the 2023 audit',
        message: "I'd like to know more about the regional office mandate."
      })
      expect(matches).toHaveLength(0)
    })
  })

  describe('severityFor / highestSeverity', () => {
    it('maps families to expected severities', () => {
      expect(severityFor('sqli')).toBe('critical')
      expect(severityFor('path_traversal')).toBe('critical')
      expect(severityFor('xss')).toBe('warning')
      expect(severityFor('ssrf')).toBe('warning')
      expect(severityFor('encoded_payload')).toBe('warning')
      expect(severityFor('length_anomaly')).toBe('info')
    })

    it('picks the worst from a list', () => {
      expect(
        highestSeverity([
          { kind: 'length_anomaly', field: 'q', sample: '' },
          { kind: 'xss', field: 'q', sample: '' }
        ])
      ).toBe('warning')
      expect(
        highestSeverity([
          { kind: 'xss', field: 'q', sample: '' },
          { kind: 'sqli', field: 'q', sample: '' }
        ])
      ).toBe('critical')
      expect(highestSeverity([{ kind: 'length_anomaly', field: 'q', sample: '' }])).toBe('info')
      expect(highestSeverity([])).toBe('info')
    })
  })
})
