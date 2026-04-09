import Handlebars from "handlebars";
import { wrapInLayout, ensureHelpers, S, getPortalName, textFooter, ACCENT_GREEN, accentBtn, accentBtnOutline } from "./_layout.js";

const btn = accentBtn(ACCENT_GREEN);
const btnOutline = accentBtnOutline(ACCENT_GREEN);

ensureHelpers();

interface EmploymentAgreementEmailVars {
  recipientName: string;
  consentUrl: string;
  loginUrl: string;
  portalName?: string;
}

const bodySource = `
<p style="${S.p}">Hi {{recipientName}},</p>

<div style="${S.infoBox}text-align:center;">
  <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1a1a1a;">Account Verified</p>
  <p style="margin:0;${S.muted}">Your email has been successfully verified</p>
</div>

<p style="${S.p}">Before you can access your account, please review and sign the <strong style="${S.strong}">Employment Agreement</strong>. You can do this in one of two ways:</p>

<div style="margin:20px 0;">
  <div style="${S.infoBox}">
    <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1a1a1a;">Option 1 — Sign directly</p>
    <p style="margin:0 0 16px;${S.muted}">Go straight to the agreement, review it, and sign right away.</p>
    <div style="text-align:center;">
      <a href="{{consentUrl}}" style="${btn}">Review &amp; Sign Agreement</a>
    </div>
  </div>
</div>

<div style="margin:20px 0;">
  <div style="${S.infoBox}">
    <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1a1a1a;">Option 2 — Sign via your account</p>
    <p style="margin:0 0 16px;${S.muted}">Log in to your account and you'll be guided to the agreement.</p>
    <div style="text-align:center;">
      <a href="{{loginUrl}}" style="${btnOutline}">Log In to Your Account</a>
    </div>
  </div>
</div>

<h3 style="${S.h3}">What happens next</h3>
<p style="${S.p}">1. Review and sign the employment agreement<br>2. Complete your profile<br>3. Start using the portal</p>

<div style="${S.notice}">
  <strong>Please note:</strong> The direct signing link is unique to you and should not be shared. You won't be able to access your account until the agreement is signed.
</div>

<p style="${S.p}">If you have any questions, feel free to reach out to our support team.</p>

<p style="${S.pLast}">Best regards,<br><strong style="${S.strong}">The Team at {{portalName}}</strong></p>
`;

const compiledBody = Handlebars.compile(bodySource);

export function employmentAgreementHtmlTemplate(vars: EmploymentAgreementEmailVars): string {
  const portalName = getPortalName();
  const body = compiledBody({ ...vars, portalName });
  return wrapInLayout("Your Account Has Been Verified", body, portalName, ACCENT_GREEN);
}

export function employmentAgreementTextTemplate(vars: EmploymentAgreementEmailVars): string {
  const portalName = getPortalName();
  return `Your Account Has Been Verified

Hi ${vars.recipientName},

Your email has been successfully verified.

Before you can access your account, please review and sign the Employment Agreement. You have two options:

OPTION 1 — SIGN DIRECTLY
Go straight to the agreement:
${vars.consentUrl}

OPTION 2 — SIGN VIA YOUR ACCOUNT
Log in and you'll be guided to the agreement:
${vars.loginUrl}

What happens next:
1. Review and sign the employment agreement
2. Complete your profile
3. Start using the portal

Please note: The direct signing link is unique to you and should not be shared. You won't be able to access your account until the agreement is signed.

If you have any questions, feel free to reach out to our support team.

Best regards,
The Team at ${portalName}

${textFooter(portalName)}`.trim();
}
