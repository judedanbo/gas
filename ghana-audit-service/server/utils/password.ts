import bcrypt from 'bcrypt'
import { randomBytes, randomInt } from 'node:crypto'

const SALT_ROUNDS = 12

// Alphanumeric alphabet for generated passwords, with visually ambiguous
// characters removed (0/O, 1/l/I) so users can read them off an email
// reliably. No special characters by design.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/**
 * Generate a cryptographically-secure initial password.
 *
 * Produces an 8–10 character password using only unambiguous alphanumeric
 * characters (no special characters). Guarantees at least one uppercase
 * letter, one lowercase letter, and one digit so the result also satisfies
 * common strength checks.
 */
export function generatePassword(): string {
  const length = randomInt(8, 11) // 8, 9 or 10 characters
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'

  const required = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)]
  ]

  const chars: string[] = [...required]
  for (let i = chars.length; i < length; i++) {
    chars.push(PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)])
  }

  // Fisher–Yates shuffle so the guaranteed characters aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join('')
}

/**
 * Generate an opaque, single-use invitation token (hex string).
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Validate password strength
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePasswordStrength(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
