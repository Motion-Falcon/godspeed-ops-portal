import { api } from "./index";

export interface EmailTemplateInfo {
  id: string;
  name: string;
  subject: string;
  description: string;
  service: "sendgrid" | "supabase";
  tone: "success" | "negative" | "neutral";
  triggerRef: string;
  attachments: string[];
  from: string;
  cc: string[];
  dynamicCc: boolean;
  hasTextVersion: boolean;
}

export interface EmailTemplatePreview {
  id: string;
  name: string;
  subject: string;
  description: string;
  service: "sendgrid" | "supabase";
  tone: "success" | "negative" | "neutral";
  triggerRef: string;
  attachments: string[];
  from: string;
  cc: string[];
  dynamicCc: boolean;
  html: string;
  text: string | null;
  sampleData: Record<string, any>;
}

export async function getEmailTemplates(): Promise<EmailTemplateInfo[]> {
  const { data } = await api.get("/api/email-templates");
  return data;
}

export async function getEmailTemplatePreview(templateId: string): Promise<EmailTemplatePreview> {
  const { data } = await api.get(`/api/email-templates/${encodeURIComponent(templateId)}/preview`);
  return data;
}
