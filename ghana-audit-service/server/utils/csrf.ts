import type { H3Event } from 'h3'
import { getCookie, setCookie, getHeader } from 'h3'
import { randomBytes } from 'crypto'

const CSRF_COOKIE_NAME = 'gas_csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Set CSRF token in a secure, HTTP-only cookie
 */
export function setCSRFCookie(event: H3Event): string {
  const token = generateCSRFToken()
  setCookie(event, CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60, // 1 hour
    path: '/'
  })
  return token
}

/**
 * Get the CSRF token from the cookie
 */
export function getCSRFTokenFromCookie(event: H3Event): string | undefined {
  return getCookie(event, CSRF_COOKIE_NAME)
}

/**
 * Validate CSRF token from header against cookie
 * Returns true if tokens match, false otherwise
 */
export function validateCSRF(event: H3Event): boolean {
  const cookieToken = getCookie(event, CSRF_COOKIE_NAME)
  const headerToken = getHeader(event, CSRF_HEADER_NAME)

  // Both tokens must be present
  if (!cookieToken || !headerToken) {
    return false
  }

  // Tokens must match (constant-time comparison to prevent timing attacks)
  if (cookieToken.length !== headerToken.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < cookieToken.length; i++) {
    result |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i)
  }

  return result === 0
}

/**
 * Create error response for CSRF validation failure
 */
export function createCSRFError() {
  return createError({
    statusCode: 403,
    statusMessage: 'CSRF token validation failed'
  })
}
