import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createError, isError } from 'h3'
import { internalError, safeError } from '~/server/utils/errors'

// safeError/internalError log the real cause via the logger (which calls
// console.error). Silence it here and assert behaviour on the returned error.
let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  errorSpy.mockRestore()
})

// A realistic raw DB error — the kind whose text must never reach the client.
const SQL_ERROR = new Error(
  "ER_DUP_ENTRY: Duplicate entry 'admin@audit.gov.gh' for key 'users.email'"
)

describe('internalError', () => {
  it('returns a generic 500 and never exposes the raw error text', () => {
    const err = internalError('admin:test', SQL_ERROR)
    expect(err.statusCode).toBe(500)
    expect(err.statusMessage).toBe('Internal Server Error')
    // The client-visible message is generic — no SQL detail.
    expect(err.message).toBe('Something went wrong. Please try again.')
    const serialized = JSON.stringify({
      statusMessage: err.statusMessage,
      message: err.message,
      data: err.data
    })
    expect(serialized).not.toContain('ER_DUP_ENTRY')
    expect(serialized).not.toContain('users.email')
  })

  it('logs the real cause server-side', () => {
    internalError('admin:test', SQL_ERROR)
    expect(errorSpy).toHaveBeenCalled()
    expect(errorSpy.mock.calls.flat().join(' ')).toContain('ER_DUP_ENTRY')
  })

  it('accepts a custom client-facing message', () => {
    const err = internalError('contact', SQL_ERROR, 'Failed to submit your message')
    expect(err.message).toBe('Failed to submit your message')
  })
})

describe('safeError', () => {
  it('preserves an intentional H3 error unchanged (4xx messages still reach the client)', () => {
    const original = createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid email or password'
    })
    const result = safeError('admin:login', original)
    expect(result).toBe(original)
    expect(result.statusCode).toBe(401)
    expect(result.message).toBe('Invalid email or password')
    // An intentional error must not be logged as an internal failure.
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('genericizes a raw DB/SQL error into a clean 500', () => {
    const result = safeError('admin:reports', SQL_ERROR)
    expect(isError(result)).toBe(true)
    expect(result.statusCode).toBe(500)
    expect(result.message).toBe('Something went wrong. Please try again.')
    expect(JSON.stringify(result)).not.toContain('ER_DUP_ENTRY')
  })

  it('genericizes non-Error throws (e.g. a thrown string)', () => {
    const result = safeError('admin:reports', 'connection string: mysql://root:pw@db')
    expect(result.statusCode).toBe(500)
    expect(result.message).toBe('Something went wrong. Please try again.')
    expect(JSON.stringify(result)).not.toContain('mysql://')
  })
})
