import nodemailer from 'nodemailer';
import { config } from '../config.js';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{ filename: string; path: string }>;
}

function createTransport() {
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  });
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const transport = createTransport();
  await transport.sendMail({
    from: config.EMAIL_FROM,
    to: opts.to,
    bcc: config.COMPLIANCE_BCC || undefined,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments,
  });
}
