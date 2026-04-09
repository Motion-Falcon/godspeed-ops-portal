import { wrapInLayout, S, getPortalName, accentBtn, ACCENT_BLUE } from "./_layout.js";

const btn = accentBtn(ACCENT_BLUE);

/** Preview-only render — substitutes real values for Supabase Go-template variables. */
export function confirmSignupHtmlTemplate(vars: Record<string, any>): string {
  const portalName = getPortalName();
  const name = vars.name || "Alex Johnson";
  const confirmationUrl = vars.confirmation_url || "#";

  const body = `
<p style="${S.p}">Hi <strong style="${S.strong}">${name}</strong>,</p>

<p style="${S.p}">Thanks for signing up. Please confirm your email address to complete your setup.</p>

<div style="${S.btnWrap}">
  <a href="${confirmationUrl}" style="${btn}">Confirm Your Email</a>
</div>

<p style="${S.p}">Once confirmed and logged in, you'll need to complete your <strong style="${S.strong}">Jobseeker Profile</strong>. This is required to start matching with job opportunities.</p>

<table style="${S.table}">
  <tr><td style="${S.td}">Browse and apply for job opportunities</td></tr>
  <tr><td style="${S.td}">Get matched with positions that fit your skills</td></tr>
  <tr><td style="${S.td}">Track your application status</td></tr>
  <tr><td style="padding:10px 12px;font-size:14px;color:#1a1a1a;">Communicate directly with recruiters</td></tr>
</table>

<div style="${S.notice}">
  Didn't sign up? You can safely ignore this email.
</div>

<p style="${S.pLast}">Best regards,<br><strong style="${S.strong}">The Team at ${portalName}</strong></p>
`;

  return wrapInLayout("Confirm Your Email", body, portalName, ACCENT_BLUE);
}
