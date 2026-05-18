import jwt, { type SignOptions } from 'jsonwebtoken'

export interface JWTPayload {
  userId: number
  email: string
  role: 'admin' | 'editor' | 'viewer'
  /** Opaque server-side session id (maps to admin_sessions.session_id). */
  sid: string
  iat?: number
  exp?: number
}

/**
 * Get JWT secret from environment
 */
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return secret
}

/**
 * Parse JWT expiry from environment (e.g., "7d", "24h", "1h")
 */
function getExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || '7d'
}

/**
 * Sign a JWT token with user payload.
 *
 * Pass `expiresInSeconds` to pin the token's lifetime to the session's
 * absolute timeout so the JWT and the server-side session expire together.
 * Falls back to JWT_EXPIRES_IN when omitted.
 */
export function signToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  expiresInSeconds?: number
): string {
  const secret = getJWTSecret()
  const expiresIn = (expiresInSeconds ?? getExpiresIn()) as SignOptions['expiresIn']

  return jwt.sign(payload as object, secret, { expiresIn })
}

/**
 * Verify and decode a JWT token
 * Returns null if token is invalid or expired
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = getJWTSecret()
    const decoded = jwt.verify(token, secret) as JWTPayload
    return decoded
  } catch {
    return null
  }
}

/**
 * Decode a token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload
    return decoded
  } catch {
    return null
  }
}

/**
 * Get token expiry timestamp in milliseconds
 */
export function getTokenExpiry(token: string): number | null {
  const decoded = decodeToken(token)
  if (decoded?.exp) {
    return decoded.exp * 1000
  }
  return null
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string): boolean {
  const expiry = getTokenExpiry(token)
  if (!expiry) return true
  return Date.now() >= expiry
}
