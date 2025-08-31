export function onboardingReminderHtmlTemplate(vars: Record<string, any>) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Complete Your Account Setup - Action Required</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 30px; color: #333;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    
    <h2 style="color: #2c3e50; margin-top: 0;">Complete Your Account Setup${vars.name ? `, ${vars.name}` : ''}</h2>

    <p>We noticed that you haven't finished setting up your account yet. Your email has been verified, but there are a few more steps to complete your onboarding.</p>

    <div style="background: #fff3e0; padding: 16px; border-left: 4px solid #ff9800; margin: 20px 0; border-radius: 4px;">
      <strong>Action Required:</strong> Please complete your account setup to gain full access to the platform.
    </div>

    <p>To complete your onboarding, please click the button below:</p>

    <p style="text-align: center; margin: 24px 0;">
      <a href="${vars.onboarding_url}" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Complete Account Setup</a>
    </p>

    <p>If you have any questions or need assistance, please don't hesitate to reach out to our support team.</p>

    <p>Best regards,<br><strong>The Godspeed Team</strong></p>

    <div style="font-size: 12px; color: #888; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
      This email was sent because you have an incomplete account setup. If you believe this message was sent in error, please contact our support team.
    </div>
  </div>
</body>
</html>
`;
}
