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
              console.log('[EmailNotifier] Sending email:', {
                to: email.to,
                subject: email.subject,
                from: process.env.DEFAULT_FROM_EMAIL,
              });
              await sgMail.send({ from: process.env.DEFAULT_FROM_EMAIL as string, ...email, text });
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