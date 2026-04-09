import { wrapInLayout, S, getPortalName, accentBtn, ACCENT_BLUE } from "./_layout.js";

const btn = accentBtn(ACCENT_BLUE);

/** Preview-only render — substitutes real values for Supabase Go-template variables. */
export function recruiterInvitationHtmlTemplate(vars: Record<string, any>): string {
  const portalName = getPortalName();
  const name = vars.name || "Chris Johnson";
  const confirmationUrl = vars.confirmation_url || "#";

  const body = `
<p style="${S.p}">Hi <strong style="${S.strong}">${name}</strong>,</p>

<p style="${S.p}">You've been invited to join the <strong style="${S.strong}">${portalName}</strong> network as a <strong style="${S.strong}">Recruiter</strong>. We're excited to have you on board.</p>

<p style="${S.p}">Click the button below to accept your invitation and get started:</p>

<div style="${S.btnWrap}">
  <a href="${confirmationUrl}" style="${btn}">Accept Invitation</a>
</div>

<p style="${S.p}">Once you accept your invite, you'll be asked to:</p>
<ol style="margin:0 0 16px;padding-left:20px;font-size:15px;color:#333333;line-height:1.8;">
  <li><strong style="${S.strong}">Verify your phone number</strong> with a One-Time Password (OTP)</li>
  <li><strong style="${S.strong}">Set your account password</strong> to secure your profile</li>
</ol>

<p style="${S.p}">After completing these steps, you'll have full access to the <strong style="${S.strong}">Recruiter Dashboard</strong>.</p>

<p style="${S.p}">This invitation is unique to your email and cannot be shared. If you did not expect this invitation, you can safely ignore this email.</p>

<p style="${S.pLast}">Best regards,<br><strong style="${S.strong}">The Team at ${portalName}</strong></p>
`;

  return wrapInLayout("You've Been Invited to Join as a Recruiter", body, portalName, ACCENT_BLUE);
}
