import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  getAssignmentFromEmail,
  getNoReplyFromEmail,
} from "../middleware/emailNotifier.js";

// Import all HTML templates
import { confirmSignupHtmlTemplate } from "../email-templates/confirm-signup-html.js";
import { recruiterInvitationHtmlTemplate } from "../email-templates/recruiter-invitation-html.js";
import { consentHtmlTemplate, generateConsentTextTemplate } from "../email-templates/consent-html.js";
import { employmentAgreementHtmlTemplate, employmentAgreementTextTemplate } from "../email-templates/employment-agreement-html.js";
import { invoiceHtmlTemplate, invoiceTextTemplate } from "../email-templates/invoice-html.js";
import { jobseekerAssignmentHtmlTemplate } from "../email-templates/jobseeker-assignment-html.js";
import { jobseekerRemovalHtmlTemplate } from "../email-templates/jobseeker-removal-html.js";
import { jobseekerWelcomeHtmlTemplate } from "../email-templates/jobseeker-welcome-html.js";
import { onboardingReminderHtmlTemplate } from "../email-templates/onboarding-reminder-html.js";
import { timesheetHtmlTemplate } from "../email-templates/timesheet-html.js";

// Import all text templates
import { jobseekerAssignmentTextTemplate } from "../email-templates/jobseeker-assignment-txt.js";
import { jobseekerRemovalTextTemplate } from "../email-templates/jobseeker-removal-txt.js";
import { jobseekerWelcomeTextTemplate } from "../email-templates/jobseeker-welcome-txt.js";
import { onboardingReminderTextTemplate } from "../email-templates/onboarding-reminder-txt.js";
import { timesheetTextTemplate } from "../email-templates/timesheet-txt.js";

const router = Router();

// Middleware: require super admin
function requireSuperAdmin(req: Request, res: Response, next: Function) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const userRoles = req.user.user_metadata?.user_role;
  if (!Array.isArray(userRoles) || !userRoles.includes("superadmin")) {
    return res.status(403).json({ error: "Access denied. Super admin only." });
  }
  next();
}

function getTemplateFromEmail(templateId: string): string {
  if (templateId === "jobseeker-assignment" || templateId === "jobseeker-removal") {
    return getAssignmentFromEmail();
  }

  return getNoReplyFromEmail();
}

// Helper: build CC list from ENV
function getInvoiceCcEmails(): string[] {
  return (process.env.INVOICE_CC_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

// Template registry with sample data — ordered to match the email-triggers table
interface TemplateEntry {
  id: string;
  name: string;
  subject: string;
  description: string;
  service: "sendgrid" | "supabase";
  tone: "success" | "negative" | "neutral";
  triggerRef: string;
  attachments: string[];
  /** If true, CC list is dynamically built per-client record */
  dynamicCc?: boolean;
  sampleData: Record<string, any>;
  renderHtml: (data: Record<string, any>) => string;
  renderText: ((data: Record<string, any>) => string) | null;
}

const TEMPLATES: TemplateEntry[] = [
  // #1 — Recruiter Invitation (Supabase)
  {
    id: "recruiter-invitation",
    name: "Recruiter Invitation",
    subject: "You've Been Invited to Join as a Recruiter",
    description: "Sent by Supabase Auth when a recruiter is invited via inviteUserByEmail. Managed in the Supabase dashboard email templates.",
    service: "supabase",
    tone: "neutral",
    triggerRef: "#1",
    attachments: [],
    sampleData: {
      name: "Chris Johnson",
      confirmation_url: "https://portal.example.com/complete-signup?token=sample",
    },
    renderHtml: (data) => recruiterInvitationHtmlTemplate(data),
    renderText: null,
  },
  // #3 — Confirm Signup / Email Verification (Supabase)
  {
    id: "confirm-signup",
    name: "Confirm Signup (Email Verification)",
    subject: "Confirm Your Email & Complete Your Setup",
    description: "Sent automatically by Supabase Auth when a new jobseeker account is created, or when a verification resend is requested. Managed in the Supabase dashboard email templates.",
    service: "supabase",
    tone: "neutral",
    triggerRef: "#3",
    attachments: [],
    sampleData: {
      name: "Alex Johnson",
      confirmation_url: "https://portal.example.com/confirm?token=sample",
    },
    renderHtml: (data) => confirmSignupHtmlTemplate(data),
    renderText: null,
  },
  // #2b, #15 — Onboarding Reminder (SendGrid)
  {
    id: "onboarding-reminder",
    name: "Onboarding Reminder",
    subject: "Complete Your Account Setup - Action Required",
    description: "Sent in two scenarios: (#2b) when a recruiter has verified their email but not completed onboarding; (#15) on a jobseeker's first login if they have not yet completed their profile.",
    service: "sendgrid",
    tone: "neutral",
    triggerRef: "#2b, #15",
    attachments: [],
    sampleData: {
      name: "Chris Johnson",
      onboarding_url: "https://portal.example.com/complete-signup",
    },
    renderHtml: (data) => onboardingReminderHtmlTemplate(data),
    renderText: (data) => onboardingReminderTextTemplate(data),
  },
  // #4 — Jobseeker Welcome (SendGrid)
  {
    id: "jobseeker-welcome",
    name: "Jobseeker Welcome",
    subject: "Welcome to Ops Portal",
    description: "Sent when a new jobseeker profile is created by a recruiter.",
    service: "sendgrid",
    tone: "success",
    triggerRef: "#4",
    attachments: ["Welcome Documents (from storage)"],
    sampleData: {
      first_name: "Alex",
      portal_url: "https://portal.example.com",
    },
    renderHtml: (data) => jobseekerWelcomeHtmlTemplate(data),
    renderText: (data) => jobseekerWelcomeTextTemplate(data),
  },
  // #5 — Jobseeker Position Assignment (SendGrid)
  {
    id: "jobseeker-assignment",
    name: "Jobseeker Position Assignment",
    subject: "Assignment Confirmation: Warehouse Associate at Acme Logistics Inc. (Toronto)",
    description: "Sent when a jobseeker is assigned to a new position.",
    service: "sendgrid",
    tone: "success",
    triggerRef: "#5",
    attachments: [],
    sampleData: {
      jobseeker_first_name: "Michael",
      title: "Warehouse Associate",
      client_name: "Acme Logistics Inc.",
      city: "Toronto",
      province: "Ontario",
      street_address: "123 Industrial Blvd",
      postal_code: "M5V 2T6",
      employment_type: "Full-Time",
      employment_term: "Contract",
      task_time: "8:00 AM - 4:00 PM",
      regular_pay_rate: "18.50",
      payrate_type: "Hourly",
      start_date: "April 15, 2026",
      end_date: "October 15, 2026",
      position_category: "Warehouse & Logistics",
      experience: "1-2 years",
      number_of_positions: "3",
    },
    renderHtml: (data) => jobseekerAssignmentHtmlTemplate(data),
    renderText: (data) => jobseekerAssignmentTextTemplate(data),
  },
  // #6 — Jobseeker Position Removal (SendGrid)
  {
    id: "jobseeker-removal",
    name: "Jobseeker Position Removal",
    subject: "Update Regarding Your Position Assignment",
    description: "Sent when a jobseeker is removed from a position assignment.",
    service: "sendgrid",
    tone: "negative",
    triggerRef: "#6",
    attachments: [],
    sampleData: {
      jobseeker_first_name: "Sarah",
      title: "Administrative Assistant",
      city: "Vancouver",
      province: "British Columbia",
      employment_type: "Part-Time",
      employment_term: "Temporary",
      start_date: "March 1, 2026",
      end_date: "June 30, 2026",
      position_category: "Office & Administration",
      experience: "Entry Level",
      number_of_positions: "1",
    },
    renderHtml: (data) => jobseekerRemovalHtmlTemplate(data),
    renderText: (data) => jobseekerRemovalTextTemplate(data),
  },
  // #7, #8, #9 — Timesheet Summary (SendGrid)
  {
    id: "timesheet",
    name: "Timesheet Summary",
    subject: "Timesheet Summary - Timesheet #TS-2026-0107",
    description: "Sent when a timesheet is submitted, re-sent, or updated. Contains the full hours and pay breakdown.",
    service: "sendgrid",
    tone: "neutral",
    triggerRef: "#7, #8, #9",
    attachments: [],
    sampleData: {
      is_updated: false,
      invoice_number: "TS-2026-0107",
      jobseeker_name: "Michael Chen",
      jobseeker_email: "michael.chen@example.com",
      week_start_date: "March 31, 2026",
      week_end_date: "April 6, 2026",
      generated_date: "April 7, 2026",
      position_title: "Warehouse Associate",
      daily_hours: [
        { date: "2026-03-31", hours: 8 },
        { date: "2026-04-01", hours: 8 },
        { date: "2026-04-02", hours: 7.5 },
        { date: "2026-04-03", hours: 8 },
        { date: "2026-04-04", hours: 8 },
        { date: "2026-04-05", hours: 0 },
        { date: "2026-04-06", hours: 0 },
      ],
      total_regular_hours: 39.5,
      total_overtime_hours: 0,
      regular_pay_rate: 18.5,
      premium_pay_rate: 0,
      overtime_pay_rate: 27.75,
      bonus_amount: 0,
      deduction_amount: 0,
      cash_deduction_percentage: 0,
      cash_deduction_amount: 0,
      total_jobseeker_pay: 730.75,
      overtime_enabled: true,
    },
    renderHtml: (data) => timesheetHtmlTemplate(data),
    renderText: (data) => timesheetTextTemplate(data),
  },
  // #10 — Invoice (SendGrid)
  {
    id: "invoice",
    name: "Invoice",
    subject: "Invoice #INV-2026-0042 for Acme Corporation",
    description: "Sent when an invoice is generated and emailed to a client.",
    service: "sendgrid",
    tone: "neutral",
    triggerRef: "#10",
    attachments: ["Invoice PDF", "Supporting Documents (if any)"],
    dynamicCc: true,
    sampleData: {
      invoiceNumber: "INV-2026-0042",
      invoiceDate: "April 9, 2026",
      dueDate: "April 23, 2026",
      clientName: "Acme Corporation",
      clientEmail: "billing@acme.example.com",
      grandTotal: "3,450.00",
      currency: "CAD",
      messageOnInvoice: "Thank you for your business. Payment is due within 14 days.",
    },
    renderHtml: (data) => invoiceHtmlTemplate(data as any),
    renderText: (data) => invoiceTextTemplate(data as any),
  },
  // #11, #12 — Digital Consent Request (SendGrid)
  {
    id: "consent",
    name: "Digital Consent Request",
    subject: "Digital Consent Request: Employment Agreement 2026",
    description: "Sent when a digital consent request is created or resent for a user to review and sign.",
    service: "sendgrid",
    tone: "neutral",
    triggerRef: "#11, #12",
    attachments: [],
    sampleData: {
      recipientName: "John Doe",
      documentName: "Employment Agreement 2026",
      consentUrl: "https://portal.example.com/consent/abc123",
    },
    renderHtml: (data) => consentHtmlTemplate(data as any),
    renderText: (data) => generateConsentTextTemplate(data as any),
  },
  // #13, #14 — Employment Agreement (SendGrid)
  {
    id: "employment-agreement",
    name: "Employment Agreement",
    subject: "Action Required: Sign Your Employment Agreement",
    description: "Sent when a jobseeker's email is confirmed (#14, alongside the welcome email) or when a recruiter creates a profile (#13), prompting the jobseeker to sign the employment agreement.",
    service: "sendgrid",
    tone: "success",
    triggerRef: "#13, #14",
    attachments: [],
    sampleData: {
      recipientName: "Jane Smith",
      consentUrl: "https://portal.example.com/consent/agreement123",
      loginUrl: "https://portal.example.com/login",
    },
    renderHtml: (data) => employmentAgreementHtmlTemplate(data as any),
    renderText: (data) => employmentAgreementTextTemplate(data as any),
  },
];

// GET /api/email-templates — List all templates
router.get("/", authenticateToken, requireSuperAdmin, (_req: Request, res: Response) => {
  const ccEmails = getInvoiceCcEmails();

  const list = TEMPLATES.map(({ id, name, subject, description, service, tone, triggerRef, attachments, dynamicCc, renderText }) => ({
    id,
    name,
    subject,
    description,
    service,
    tone,
    triggerRef,
    attachments,
    from: getTemplateFromEmail(id),
    cc: id === "invoice" ? ccEmails : [],
    dynamicCc: dynamicCc || false,
    hasTextVersion: renderText !== null,
  }));
  res.json(list);
});

// GET /api/email-templates/:templateId/preview — Render a template with sample data
router.get("/:templateId/preview", authenticateToken, requireSuperAdmin, (req: Request, res: Response) => {
  const { templateId } = req.params;
  const template = TEMPLATES.find((t) => t.id === templateId);

  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }

  const ccEmails = getInvoiceCcEmails();

  try {
    const html = template.renderHtml(template.sampleData);
    const text = template.renderText ? template.renderText(template.sampleData) : null;

    res.json({
      id: template.id,
      name: template.name,
      subject: template.subject,
      description: template.description,
      service: template.service,
      tone: template.tone,
      triggerRef: template.triggerRef,
      attachments: template.attachments,
      from: getTemplateFromEmail(template.id),
      cc: template.id === "invoice" ? ccEmails : [],
      dynamicCc: template.dynamicCc || false,
      html,
      text,
      sampleData: template.sampleData,
    });
  } catch (err: any) {
    console.error(`Error rendering template ${templateId}:`, err);
    res.status(500).json({ error: "Failed to render template", details: err.message });
  }
});

export default router;
