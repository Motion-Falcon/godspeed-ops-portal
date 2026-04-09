import Handlebars from "handlebars";
import { wrapInLayout, ensureHelpers, S, getPortalName, textFooter, ACCENT_BLUE, accentBtn } from "./_layout.js";

const btn = accentBtn(ACCENT_BLUE);

ensureHelpers();

interface ConsentEmailTemplateVars {
  recipientName: string;
  documentName: string;
  consentUrl: string;
  portalName?: string;
}

const bodySource = `
<p style="${S.p}">Hi {{recipientName}},</p>

<p style="${S.p}">We need your consent for the following document. Please take a moment to review it.</p>

<div style="${S.infoBox}text-align:center;">
  <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#1a1a1a;">{{documentName}}</p>
  <p style="margin:0;${S.muted}">Please review and provide your consent</p>
</div>

<div style="${S.btnWrap}">
  <a href="{{consentUrl}}" style="${btn}">Review &amp; Provide Consent</a>
</div>

<div style="${S.notice}">
  <strong>Please note:</strong> This link is unique to you and should not be shared. It will expire after a certain period for your security.
</div>

<p style="${S.p}">If you have any questions, feel free to reach out to our support team.</p>

<p style="${S.pLast}">Best regards,<br><strong style="${S.strong}">The Team at {{portalName}}</strong></p>
`;

const compiledBody = Handlebars.compile(bodySource);

export function consentHtmlTemplate(vars: ConsentEmailTemplateVars): string {
  const portalName = getPortalName();
  const body = compiledBody({ ...vars, portalName });
  return wrapInLayout("Digital Consent Request", body, portalName, ACCENT_BLUE);
}

export function generateConsentTextTemplate(vars: ConsentEmailTemplateVars): string {
  const portalName = getPortalName();
  return `Digital Consent Request

Hi ${vars.recipientName},

We need your consent for the following document. Please take a moment to review it.

Document: ${vars.documentName}

Review and provide your consent here:
${vars.consentUrl}

Please note: This link is unique to you and should not be shared. It will expire after a certain period for your security.

If you have any questions, feel free to reach out to our support team.

Best regards,
The Team at ${portalName}

${textFooter(portalName)}`.trim();
}
