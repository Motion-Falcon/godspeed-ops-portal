import Handlebars from "handlebars";
import { wrapInLayout, ensureHelpers, S, getPortalName, textFooter, ACCENT_BLUE, accentBtn } from "./_layout.js";

const btn = accentBtn(ACCENT_BLUE);

ensureHelpers();

const bodySource = `
<p style="${S.p}">Hi{{#if name}} {{name}}{{/if}},</p>

<p style="${S.p}">It looks like you haven't finished setting up your account yet. Your email has been verified, but there are a few more steps to complete.</p>

<div style="${S.notice}">
  <strong>Action needed:</strong> Please complete your account setup to get full access to the platform.
</div>

<div style="${S.btnWrap}">
  <a href="{{onboarding_url}}" style="${btn}">Complete Account Setup</a>
</div>

<p style="${S.p}">If you need any help, feel free to reach out to our support team.</p>

<p style="${S.pLast}">Best regards,<br><strong style="${S.strong}">The Team at {{portalName}}</strong></p>
`;

const compiledBody = Handlebars.compile(bodySource);

export function onboardingReminderHtmlTemplate(vars: Record<string, any>): string {
  const portalName = getPortalName();
  const body = compiledBody({ ...vars, portalName });
  return wrapInLayout("Complete Your Account Setup", body, portalName, ACCENT_BLUE);
}
