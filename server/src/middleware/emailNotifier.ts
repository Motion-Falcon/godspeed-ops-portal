import { Request, Response, NextFunction } from 'express';
import sgMail from '@sendgrid/mail';
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { fileURLToPath } from 'url';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EmailData {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

function getFormattedFromEmail(
  primaryEmail: string | undefined,
  fallbackEmail: string | undefined,
  defaultEmail: string,
): string {
  return formatFromEmail(primaryEmail || fallbackEmail || defaultEmail);
}

/**
 * Formats an email address with a display name
 * @param email - The email address
 * @param displayName - Optional display name (defaults to PORTAL_NAME env var or "HDGroup")
 * @returns Formatted email string like "HDGroup <email@example.com>"
 */
export function formatFromEmail(email: string, displayName?: string): string {
  // If email already contains a display name, return as is
  if (email.includes('<') && email.includes('>')) {
    return email;
  }
  // Use provided displayName, or fall back to environment variable, or default to "HDGroup"
  const brandName = displayName || process.env.PORTAL_NAME || '';
  return `${brandName} Ops Portal <${email}>`;
}

export function getNoReplyFromEmail(): string {
  return getFormattedFromEmail(
    process.env.NO_REPLY_FROM_EMAIL,
    process.env.DEFAULT_FROM_EMAIL,
    "noreply@example.com",
  );
}

export function getAssignmentFromEmail(): string {
  return getFormattedFromEmail(
    process.env.ASSIGNMENT_FROM_EMAIL,
    process.env.NO_REPLY_FROM_EMAIL || process.env.DEFAULT_FROM_EMAIL,
    "noreply@example.com",
  );
}

interface EmailNotifierOptions {
  onSuccessEmail?: (req: Request, res: Response) => EmailData | EmailData[] | null | Promise<EmailData | EmailData[] | null>;
}

export const emailNotifier = (options: EmailNotifierOptions = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', async () => {
      try {
        console.log('[EmailNotifier] Response finished for', req.method, req.originalUrl, 'Status:', res.statusCode);
        if (res.statusCode >= 200 && res.statusCode < 300 && options.onSuccessEmail) {
          console.log('[EmailNotifier] onSuccessEmail callback triggered');
          const emailData = await options.onSuccessEmail(req, res);
          if (emailData) {
            // Handle both single email and array of emails
            const emails = Array.isArray(emailData) ? emailData : [emailData];
            
            for (const email of emails) {
              // Ensure 'text' is always a string (required by SendGrid)
              const text = email.text ?? '';
              const fromEmail = email.from || getNoReplyFromEmail();
              console.log('[EmailNotifier] Sending email:', {
                to: email.to,
                subject: email.subject,
                from: fromEmail,
              });
              await sgMail.send({ from: fromEmail, ...email, text });
              console.log('[EmailNotifier] Email sent successfully to', email.to);
            }
          } else {
            console.log('[EmailNotifier] No emailData returned from onSuccessEmail, skipping email send.');
          }
        }
      } catch (err) {
        console.error('EmailNotifier: Failed to send success email:', err);
      }
    });
    next();
  };
};
