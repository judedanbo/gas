import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (transporter) return transporter

  const config = useRuntimeConfig()
  const host = String(config.smtpHost || '')
  const user = String(config.smtpUser || '')
  const pass = String(config.smtpPass || '')
  if (!host || !user || !pass) {
    return null
  }

  const options: SMTPTransport.Options = {
    host,
    port: Number(config.smtpPort) || 587,
    secure: Number(config.smtpPort) === 465,
    auth: { user, pass }
  }
  transporter = nodemailer.createTransport(options)

  return transporter
}

interface ContactEmailParams {
  name: string
  email: string
  phone: string | null
  subject: string
  message: string
}

const subjectLabels: Record<string, string> = {
  general: 'General Inquiry',
  report: 'Report a Concern',
  audit: 'Audit Related',
  procurement: 'Procurement/Tenders',
  careers: 'Careers',
  media: 'Media/Press',
  other: 'Other'
}

export async function sendContactNotification(params: ContactEmailParams): Promise<void> {
  const mailer = getTransporter()
  if (!mailer) {
    console.warn('[Email] SMTP not configured — skipping contact notification email')
    return
  }

  const config = useRuntimeConfig()
  const fromAddress = String(config.smtpFrom || 'noreply@audit.gov.gh')
  const subjectLabel = subjectLabels[params.subject] || params.subject

  await mailer.sendMail({
    from: `"Ghana Audit Service Website" <${fromAddress}>`,
    to: 'info@audit.gov.gh',
    replyTo: params.email,
    subject: `Contact Form: ${subjectLabel} — from ${params.name}`,
    text: buildPlainText(params, subjectLabel),
    html: buildHtml(params, subjectLabel)
  })
}

interface InvitationEmailParams {
  email: string
  name: string
  password: string
  acceptUrl: string
}

/**
 * Send an invitation email to a newly created admin user. The email carries
 * the auto-generated initial password and a link to accept the invitation.
 *
 * Returns `true` if the email was dispatched, `false` if SMTP is not
 * configured (so callers can surface the credentials another way).
 */
export async function sendInvitationEmail(params: InvitationEmailParams): Promise<boolean> {
  const mailer = getTransporter()
  if (!mailer) {
    console.warn('[Email] SMTP not configured — skipping user invitation email')
    return false
  }

  const config = useRuntimeConfig()
  const fromAddress = String(config.smtpFrom || 'noreply@audit.gov.gh')

  await mailer.sendMail({
    from: `"Ghana Audit Service" <${fromAddress}>`,
    to: params.email,
    subject: 'You have been invited to the Ghana Audit Service Admin Portal',
    text: buildInvitationPlainText(params),
    html: buildInvitationHtml(params)
  })

  return true
}

function buildInvitationPlainText(params: InvitationEmailParams): string {
  return [
    `Hello ${params.name},`,
    '',
    'An account has been created for you on the Ghana Audit Service Admin Portal.',
    '',
    'To activate your account, accept the invitation using the link below:',
    params.acceptUrl,
    '',
    'Your temporary sign-in details are:',
    `Email: ${params.email}`,
    `Initial password: ${params.password}`,
    '',
    'After accepting the invitation, sign in with the initial password above.',
    'You will be able to change your password at any time.',
    '',
    'If you were not expecting this invitation, please ignore this email.',
    '',
    '---',
    'Ghana Audit Service'
  ].join('\n')
}

function buildInvitationHtml(params: InvitationEmailParams): string {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#006B3F;padding:20px;text-align:center;">
    <h1 style="color:#FCD116;margin:0;font-size:20px;">Ghana Audit Service</h1>
    <p style="color:#fff;margin:4px 0 0;font-size:14px;">Admin Portal Invitation</p>
  </div>
  <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;">
    <p style="margin-top:0;">Hello ${escapeHtml(params.name)},</p>
    <p>An account has been created for you on the Ghana Audit Service Admin Portal.
       To activate your account, accept the invitation below.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${escapeHtml(params.acceptUrl)}"
         style="display:inline-block;background:#006B3F;color:#fff;text-decoration:none;
                padding:12px 28px;border-radius:8px;font-weight:600;">
        Accept Invitation
      </a>
    </p>
    <p style="font-size:14px;color:#555;">Your temporary sign-in details:</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;font-weight:600;color:#555;">Email</td>
        <td style="padding:8px 12px;">${escapeHtml(params.email)}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;font-weight:600;color:#555;">Initial password</td>
        <td style="padding:8px 12px;font-family:monospace;font-size:15px;">${escapeHtml(params.password)}</td>
      </tr>
    </table>
    <p style="font-size:14px;color:#555;">
      After accepting the invitation, sign in with the initial password above.
      You can change your password at any time once signed in.
    </p>
    <p style="font-size:13px;color:#9ca3af;word-break:break-all;">
      If the button does not work, copy and paste this link into your browser:<br>
      ${escapeHtml(params.acceptUrl)}
    </p>
    <p style="margin-top:24px;font-size:12px;color:#9ca3af;">
      If you were not expecting this invitation, please ignore this email.
    </p>
  </div>
</div>`
}

function buildPlainText(params: ContactEmailParams, subjectLabel: string): string {
  const lines = [
    'New Contact Form Submission',
    '==========================',
    '',
    `Name: ${params.name}`,
    `Email: ${params.email}`,
    params.phone ? `Phone: ${params.phone}` : null,
    `Subject: ${subjectLabel}`,
    '',
    'Message:',
    '--------',
    params.message,
    '',
    '---',
    'This message was submitted via the Ghana Audit Service website contact form.'
  ]
  return lines.filter((l) => l !== null).join('\n')
}

function buildHtml(params: ContactEmailParams, subjectLabel: string): string {
  const phoneRow = params.phone
    ? `<tr><td style="padding:8px 12px;font-weight:600;color:#555;">Phone</td><td style="padding:8px 12px;">${escapeHtml(params.phone)}</td></tr>`
    : ''

  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#006B3F;padding:20px;text-align:center;">
    <h1 style="color:#FCD116;margin:0;font-size:20px;">Ghana Audit Service</h1>
    <p style="color:#fff;margin:4px 0 0;font-size:14px;">New Contact Form Submission</p>
  </div>
  <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;font-weight:600;color:#555;">Name</td>
        <td style="padding:8px 12px;">${escapeHtml(params.name)}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;font-weight:600;color:#555;">Email</td>
        <td style="padding:8px 12px;"><a href="mailto:${escapeHtml(params.email)}">${escapeHtml(params.email)}</a></td>
      </tr>
      ${phoneRow}
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;font-weight:600;color:#555;">Subject</td>
        <td style="padding:8px 12px;">${escapeHtml(subjectLabel)}</td>
      </tr>
    </table>
    <div style="background:#f9fafb;padding:16px;border-radius:8px;white-space:pre-wrap;">${escapeHtml(params.message)}</div>
    <p style="margin-top:24px;font-size:12px;color:#9ca3af;">
      Submitted via the Ghana Audit Service website contact form. Reply directly to this email to respond to the sender.
    </p>
  </div>
</div>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
