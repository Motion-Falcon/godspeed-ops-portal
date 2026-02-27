export function jobseekerWelcomeTextTemplate(vars: Record<string, any>) {
  const portalName = process.env.PORTAL_NAME || "Ops Portal";
  const firstName = vars.first_name || "there";
  const portalUrl = vars.portal_url || "";

  return `Subject: Welcome to ${portalName}

Hi ${firstName},

Your jobseeker profile has been added successfully.

${portalUrl ? `You can access the portal here:\n${portalUrl}\n` : ""}
If you have any questions, please reply to this email and our team will help you.

Best regards,
The ${portalName} Team`;
}
