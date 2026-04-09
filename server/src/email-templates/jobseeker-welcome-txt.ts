import { getPortalName, textFooter } from "./_layout.js";

export function jobseekerWelcomeTextTemplate(vars: Record<string, any>): string {
  const portalName = getPortalName();
  const firstName = vars.first_name || "there";
  const portalUrl = vars.portal_url || "";

  return `Subject: Welcome to ${portalName}! Your profile is now active.

Hi ${firstName},

Welcome to the ${portalName} network! We are thrilled to have you on board. Your jobseeker profile is now officially active.

To ensure our recruiters can match you with the right employers as quickly as possible, please log in and make sure your resume and work history are completely up to date:
${portalUrl ? `\nAccess your portal:\n${portalUrl}\n` : ""}
We partner with top companies to find great candidates like you. If you need any help navigating the portal or updating your information, just reply to this email and our team will assist you.

We look forward to working with you!

Best regards,
The Team at ${portalName}

${textFooter(portalName)}`.trim();
}
