import { setCSRFCookie } from '../utils/csrf'

/**
 * GET /api/csrf
 * Returns a CSRF token for use in forms and API requests
 * Also sets the token in a secure HTTP-only cookie
 */
export default defineEventHandler((event) => {
  const token = setCSRFCookie(event)

  return {
    token
  }
})
