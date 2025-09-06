import Handlebars from 'handlebars';

interface ConsentEmailTemplateVars {
  recipientName: string;
  documentName: string;
  consentUrl: string;
}

const templateSource = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Digital Consent Request</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0; 
      padding: 0; 
      background-color: #f8f8f8;
    }
    .container { 
      max-width: 600px; 
      margin: 32px auto; 
      padding: 20px; 
      background-color: #f9f9f9; 
    }
    .content { 
      background-color: white; 
      padding: 32px; 
      border-radius: 8px; 
      box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
    }
    .header { 
      text-align: center; 
      margin-bottom: 32px; 
      border-bottom: 1px solid #eee;
      padding-bottom: 24px;
    }
    .logo { 
      font-size: 24px; 
      font-weight: bold; 
      color: #d97706; 
      margin-bottom: 8px;
    }
    .title {
      font-size: 28px;
      color: #2a4d8f;
      margin: 0;
      font-weight: 600;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 24px;
      color: #2a4d8f;
    }
    .document-info {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 20px;
      margin: 24px 0;
      text-align: center;
    }
    .document-name {
      font-size: 18px;
      font-weight: bold;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .button { 
      display: inline-block; 
      background-color: #d97706; 
      color: white; 
      padding: 14px 28px; 
      text-decoration: none; 
      border-radius: 6px; 
      font-weight: bold; 
      margin: 24px 0;
      font-size: 16px;
      transition: background-color 0.3s ease;
    }
    .button:hover {
      background-color: #b45309;
    }
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    .warning { 
      background-color: #fef3c7; 
      border-left: 4px solid #f59e0b; 
      padding: 16px; 
      margin: 24px 0;
      border-radius: 4px;
    }
    .warning-title {
      font-weight: bold;
      color: #92400e;
      margin-bottom: 8px;
    }
    .warning-text {
      color: #92400e;
      margin: 0;
    }
    .footer { 
      text-align: center; 
      margin-top: 32px; 
      font-size: 14px; 
      color: #666;
      border-top: 1px solid #eee;
      padding-top: 24px;
    }
    .signature {
      margin-top: 24px;
      font-size: 16px;
    }
    .company-name {
      font-weight: bold;
      color: #2a4d8f;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <div class="header">
        <div class="logo">Godspeed Ops Portal</div>
        <h1 class="title">Digital Consent Request</h1>
      </div>
      
      <p class="greeting">Hello {{recipientName}},</p>
      
      <p>You have received a digital consent request for the following document:</p>
      
      <div class="document-info">
        <div class="document-name">{{documentName}}</div>
        <p style="margin: 0; color: #64748b;">Please review this document and provide your consent</p>
      </div>
      
      <p>Click the button below to review the document and provide your digital consent:</p>
      
      <div class="button-container">
        <a href="{{consentUrl}}" class="button">Review & Provide Consent</a>
      </div>
      
      <div class="warning">
        <div class="warning-title">Important Security Notice:</div>
        <p class="warning-text">This link is unique to you and should not be shared with others. The link will expire if not used within a reasonable timeframe for security purposes.</p>
      </div>
      
      <p>If you have any questions about this consent request or need assistance, please contact our support team.</p>
      
      <div class="signature">
        <p>Best regards,<br><span class="company-name">Godspeed Team</span></p>
      </div>
    </div>
    
    <div class="footer">
      <p>This is an automated message from Godspeed Ops Portal.<br>
      Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`;

const compiledTemplate = Handlebars.compile(templateSource);

export function consentHtmlTemplate(vars: ConsentEmailTemplateVars): string {
  return compiledTemplate(vars);
}

export function generateConsentTextTemplate(vars: ConsentEmailTemplateVars): string {
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
Godspeed Team

---
This is an automated message from Godspeed Ops Portal. Please do not reply to this email.
  `.trim();
}
