import { getPortalName, textFooter } from "./_layout.js";

export function onboardingReminderTextTemplate(vars: Record<string, any>): string {
  const portalName = getPortalName();
  return `Complete Your Account Setup

Hi${vars.name ? ` ${vars.name}` : ""},

It looks like you haven't finished setting up your account yet. Your email has been verified, but there are a few more steps to complete.

Action needed: Please complete your account setup to get full access to the platform.

Complete your setup here:
${vars.onboarding_url}

If you need any help, feel free to reach out to our support team.

Best regards,
The Team at ${portalName}

${textFooter(portalName)}`.trim();
}
