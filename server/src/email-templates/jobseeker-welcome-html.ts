import Handlebars from "handlebars";
import { wrapInLayout, ensureHelpers, S, getPortalName, textFooter, ACCENT_GREEN, accentBtn } from "./_layout.js";

const btn = accentBtn(ACCENT_GREEN);

ensureHelpers();

const bodySource = `
<p style="${S.p}">Hi {{firstName}},</p>

<p style="${S.p}">Welcome to the <strong style="${S.strong}">{{portalName}}</strong> network! We are thrilled to have you on board. Your jobseeker profile is now officially active.</p>

<p style="${S.p}">To ensure our recruiters can match you with the right employers as quickly as possible, please log in and make sure your resume and work history are completely up to date:</p>

{{#if portal_url}}
<div style="${S.btnWrap}">
  <a href="{{portal_url}}" style="${btn}">Access your portal</a>
</div>
{{/if}}

<p style="${S.p}">We partner with top companies to find great candidates like you. If you need any help navigating the portal or updating your information, just reply to this email and our team will assist you.</p>

<p style="${S.p}">We look forward to working with you!</p>

<p style="${S.pLast}">Best regards,<br><strong style="${S.strong}">The Team at {{portalName}}</strong></p>
`;

const compiledBody = Handlebars.compile(bodySource);

export function jobseekerWelcomeHtmlTemplate(vars: Record<string, any>): string {
  const portalName = getPortalName();
  const firstName = vars.first_name || "there";
  const body = compiledBody({ ...vars, portalName, firstName });
  return wrapInLayout(`Welcome to ${portalName}! Your profile is now active.`, body, portalName, ACCENT_GREEN);
}
