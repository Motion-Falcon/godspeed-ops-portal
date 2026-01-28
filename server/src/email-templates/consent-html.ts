import Handlebars from "handlebars";

interface ConsentEmailTemplateVars {
  recipientName: string;
  documentName: string;
  consentUrl: string;
  portalName?: string;
}

const templateSource = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Digital Consent Request</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f8f9fa; color: #222; margin: 0; padding: 0; }
      .container { background: #fff; max-width: 600px; margin: 40px auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 32px 24px; }
      h2 { color: #2e7d32; margin-top: 0; }
      .document-info { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0; text-align: center; }
      .document-name { font-size: 18px; font-weight: bold; color: #1e293b; margin-bottom: 8px; }
      .button-container { text-align: center; margin: 24px 0; }
      .button { display: inline-block; background-color: #1976d2; color: white !important; padding: 12px 24px; text-decoration: none !important; border-radius: 5px; font-weight: bold; }
      .warning { background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 16px; margin: 20px 0; border-radius: 4px; }
      .warning-title { font-weight: bold; color: #e65100; margin-bottom: 8px; }
      .warning-text { color: #e65100; margin: 0; }
      .footer { font-size: 12px; color: #888; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>Digital Consent Request</h2>
      <p>Hello {{recipientName}},</p>
      <p>You have received a digital consent request for the following document:</p>
      <div class="document-info">
        <div class="document-name">{{documentName}}</div>
        <p style="margin: 8px 0 0 0; color: #64748b;">Please review this document and provide your consent</p>
      </div>
      <p>Click the button below to review the document and provide your digital consent:</p>
      <div class="button-container">
        <a href="{{consentUrl}}" class="button" style="color: white !important; text-decoration: none;">Review & Provide Consent</a>
      </div>
      <div class="warning">
        <div class="warning-title">Important Security Notice:</div>
        <p class="warning-text">This link is unique to you and should not be shared with others. The link will expire if not used within a reasonable timeframe for security purposes.</p>
      </div>
      <p>If you have any questions about this consent request or need assistance, please contact our support team.</p>
      <p>Best regards,<br><b>The {{portalName}} Team</b></p>
      <div class="footer">
        This is an automated message from {{portalName}}. If you believe this message was sent in error, please contact our support team.
      </div>
    </div>
  </body>
</html>
`;

const compiledTemplate = Handlebars.compile(templateSource);

export function consentHtmlTemplate(vars: ConsentEmailTemplateVars): string {
  const portalName = process.env.PORTAL_NAME || 'Ops Portal';
  return compiledTemplate({
    ...vars,
    portalName
  });
}

export function generateConsentTextTemplate(vars: ConsentEmailTemplateVars): string {
  const portalName = process.env.PORTAL_NAME || 'Ops Portal';
  return `
Digital Consent Request

Hello ${vars.recipientName},

You have received a digital consent request for the following document:

${vars.documentName}

Please click the link below to review and provide your consent:

${vars.consentUrl}

IMPORTANT SECURITY NOTICE: This link is unique to you and should not be shared with others. The link will expire if not used within a reasonable timeframe for security purposes.

If you have any questions about this consent request or need assistance, please contact our support team.

Best regards,
${portalName} Team

---
This is an automated message from ${portalName}. Please do not reply to this email.
  `.trim();
}
