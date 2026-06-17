import { generatePassword, generateInvitationToken, hashPassword } from './password'
import { sendInvitationEmail } from './email'

// How long an invitation link remains valid.
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface PreparedInvitation {
  /** Plaintext initial password — surfaced once, never stored in the clear. */
  password: string
  /** bcrypt hash to persist on the user row. */
  passwordHash: string
  /** Opaque single-use token to persist and embed in the accept link. */
  token: string
  /** Absolute expiry for the token. */
  expiresAt: Date
}

/**
 * Generate a fresh initial password + invitation token for a user. The caller
 * is responsible for persisting `passwordHash`, `token` and `expiresAt`.
 */
export async function prepareInvitation(): Promise<PreparedInvitation> {
  const password = generatePassword()
  const passwordHash = await hashPassword(password)
  const token = generateInvitationToken()
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS)
  return { password, passwordHash, token, expiresAt }
}

/**
 * Build the public URL a user visits to accept their invitation.
 */
export function buildAcceptUrl(token: string): string {
  const config = useRuntimeConfig()
  const base = String(config.public?.siteUrl || 'https://audit.gov.gh').replace(/\/$/, '')
  return `${base}/admin/accept-invitation?token=${encodeURIComponent(token)}`
}

/**
 * Send (or resend) an invitation email. Returns whether the email was
 * actually dispatched (false when SMTP is not configured).
 */
export async function dispatchInvitationEmail(params: {
  email: string
  name: string
  password: string
  token: string
}): Promise<boolean> {
  return sendInvitationEmail({
    email: params.email,
    name: params.name,
    password: params.password,
    acceptUrl: buildAcceptUrl(params.token)
  })
}
