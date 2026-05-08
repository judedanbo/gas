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
