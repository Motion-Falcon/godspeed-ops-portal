import Handlebars from "handlebars";

interface EmploymentAgreementEmailVars {
  recipientName: string;
  consentUrl: string;
  loginUrl: string;
  portalName?: string;
}

const templateSource = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Employment Agreement - Action Required</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f8f9fa; color: #222; margin: 0; padding: 0; }
      .container { background: #fff; max-width: 600px; margin: 40px auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 32px 24px; }
      h2 { color: #2e7d32; margin-top: 0; }
      .info-box { background-color: #e8f5e9; border: 1px solid #c8e6c9; border-radius: 6px; padding: 16px; margin: 20px 0; text-align: center; }
      .info-title { font-size: 16px; font-weight: bold; color: #2e7d32; margin-bottom: 4px; }
      .info-text { color: #388e3c; margin: 0; font-size: 14px; }
      .options-container { margin: 24px 0; }
      .option { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-bottom: 12px; }
      .option-title { font-size: 14px; font-weight: bold; color: #1e293b; margin-bottom: 8px; }
      .option-desc { font-size: 13px; color: #64748b; margin-bottom: 12px; }
      .button-container { text-align: center; }
      .button-primary { display: inline-block; background-color: #1976d2; color: white !important; padding: 12px 24px; text-decoration: none !important; border-radius: 5px; font-weight: bold; font-size: 14px; }
      .button-secondary { display: inline-block; background-color: #f1f5f9; color: #1e293b !important; padding: 12px 24px; text-decoration: none !important; border-radius: 5px; font-weight: bold; border: 1px solid #cbd5e1; font-size: 14px; }
      .warning { background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 16px; margin: 20px 0; border-radius: 4px; }
      .warning-title { font-weight: bold; color: #e65100; margin-bottom: 8px; }
      .warning-text { color: #e65100; margin: 0; font-size: 13px; }
      .steps { margin: 16px 0; padding-left: 20px; }
      .steps li { margin-bottom: 8px; color: #475569; font-size: 14px; }
      .footer { font-size: 12px; color: #888; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>Your Account Has Been Verified!</h2>

      <p>Hello {{recipientName}},</p>

      <div class="info-box">
        <div class="info-title">Email Verification Complete</div>
        <p class="info-text">Your account has been successfully verified.</p>
      </div>

      <p>Before you can access your account, you need to review and sign the <strong>Employment Agreement</strong>. Please choose one of the options below:</p>

      <div class="options-container">
        <div class="option">
          <div class="option-title">Option 1: Sign Directly</div>
          <p class="option-desc">Use this link to go directly to the employment agreement, review it, and sign immediately.</p>
          <div class="button-container">
            <a href="{{consentUrl}}" class="button-primary" style="color: white !important; text-decoration: none;">Review & Sign Agreement</a>
          </div>
        </div>

        <div class="option">
          <div class="option-title">Option 2: Sign via Your Account</div>
          <p class="option-desc">Log in to your account and you will be guided to the employment agreement before accessing the portal.</p>
          <div class="button-container">
            <a href="{{loginUrl}}" class="button-secondary" style="text-decoration: none;">Log In to Your Account</a>
          </div>
        </div>
      </div>

      <p><strong>Next steps after signing:</strong></p>
      <ol class="steps">
        <li>Review and sign the employment agreement</li>
        <li>Complete your profile</li>
        <li>Start using the portal</li>
      </ol>

      <div class="warning">
        <div class="warning-title">Important:</div>
        <p class="warning-text">The direct agreement link above is unique to you and should not be shared with others. You will not be able to access your account until the employment agreement is signed.</p>
      </div>

      <p>If you have any questions, please contact our support team.</p>

      <p>Best regards,<br><b>The {{portalName}} Team</b></p>

      <div class="footer">
        This is an automated message from {{portalName}}. If you believe this message was sent in error, please contact our support team.
      </div>
    </div>
  </body>
</html>
`;

const compiledTemplate = Handlebars.compile(templateSource);

export function employmentAgreementHtmlTemplate(vars: EmploymentAgreementEmailVars): string {
  const portalName = process.env.PORTAL_NAME || 'Ops Portal';
  return compiledTemplate({
    ...vars,
    portalName
  });
}

export function employmentAgreementTextTemplate(vars: EmploymentAgreementEmailVars): string {
  const portalName = process.env.PORTAL_NAME || 'Ops Portal';
  return `
Your Account Has Been Verified!

Hello ${vars.recipientName},

Your account has been successfully verified.

Before you can access your account, you need to review and sign the Employment Agreement. You have two options:

OPTION 1: SIGN DIRECTLY
Use this link to go directly to the employment agreement:
${vars.consentUrl}

OPTION 2: SIGN VIA YOUR ACCOUNT
Log in to your account and you will be guided to the agreement:
${vars.loginUrl}

NEXT STEPS AFTER SIGNING:
1. Review and sign the employment agreement
2. Complete your profile
3. Start using the portal

IMPORTANT: The direct agreement link above is unique to you and should not be shared with others. You will not be able to access your account until the employment agreement is signed.

If you have any questions, please contact our support team.

Best regards,
The ${portalName} Team

---
This is an automated message from ${portalName}. Please do not reply to this email.
  `.trim();
}
