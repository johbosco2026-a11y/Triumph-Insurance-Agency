import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]!));
}

export async function sendSecurityEmail(to: string, subject: string, html: string) {
  if (!resend) {
    if (process.env.NODE_ENV === 'production') throw new Error('RESEND_API_KEY is required in production');
    return { id: 'development-email', skipped: true };
  }
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error('RESEND_FROM_EMAIL is required when email delivery is enabled');
  return resend.emails.send({ from, to, subject, html });
}
