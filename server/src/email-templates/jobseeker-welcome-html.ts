export function jobseekerWelcomeHtmlTemplate(vars: Record<string, any>) {
  const portalName = process.env.PORTAL_NAME || "Ops Portal";
  const firstName = vars.first_name || "there";
  const portalUrl = vars.portal_url || "";

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Welcome to ${portalName}</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color: #f5f7fb; margin: 0; padding: 24px; color: #1f2937;">
    <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 10px; padding: 28px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
      <h2 style="margin-top: 0; color: #111827;">Welcome to ${portalName}, ${firstName}</h2>

      <p style="line-height: 1.6; margin: 0 0 14px;">
        Your jobseeker profile has been added successfully.
      </p>

      <p style="line-height: 1.6; margin: 0 0 14px;">
        You can access the portal using the link below:
      </p>

      ${
        portalUrl
          ? `<p style="margin: 18px 0 24px;">
        <a href="${portalUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 20px; border-radius: 6px;">
          Open ${portalName}
        </a>
      </p>`
          : ""
      }

      <p style="line-height: 1.6; margin: 0 0 14px;">
        If you have any questions, please reply to this email and our team will help you.
      </p>

      <p style="line-height: 1.6; margin: 0;">
        Best regards,<br />
        The ${portalName} Team
      </p>
    </div>
  </body>
</html>
`;
}
