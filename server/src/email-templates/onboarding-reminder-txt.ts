export function onboardingReminderTextTemplate(vars: Record<string, any>) {
  return `
Complete Your Account Setup${vars.name ? `, ${vars.name}` : ""}

We noticed that you haven't finished setting up your account yet. Your email has been verified, but there are a few more steps to complete your onboarding.

ACTION REQUIRED: Please complete your account setup to gain full access to the platform.

To complete your onboarding, please visit:
${vars.onboarding_url}

If you have any questions or need assistance, please don't hesitate to reach out to our support team.

Best regards,
The Motion Falcon Team

---
This email was sent because you have an incomplete account setup. If you believe this message was sent in error, please contact our support team.
  `;
}
