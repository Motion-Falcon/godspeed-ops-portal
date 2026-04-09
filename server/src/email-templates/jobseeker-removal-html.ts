import Handlebars from "handlebars";
import { wrapInLayout, ensureHelpers, S, getPortalName, textFooter, ACCENT_RED } from "./_layout.js";

ensureHelpers();

const bodySource = `
<p style="${S.p}">Hi{{#if jobseeker_first_name}} {{jobseeker_first_name}}{{/if}},</p>

<p style="${S.p}">We're writing to let you know that you've been removed from the following position:</p>

<table style="${S.table}">
  <tr>
    <td style="${S.tdLabel}">Position</td>
    <td style="${S.tdValue}"><strong style="${S.strong}">{{title}}</strong></td>
  </tr>
  <tr>
    <td style="${S.tdLabel}">Location</td>
    <td style="${S.tdValue}">{{city}}, {{province}}</td>
  </tr>
  <tr>
    <td style="${S.tdLabel}">Type</td>
    <td style="${S.tdValue}">{{employment_type}} / {{employment_term}}</td>
  </tr>
  <tr>
    <td style="${S.tdLabel}">Start Date</td>
    <td style="${S.tdValue}">{{start_date}}</td>
  </tr>
  {{#if end_date}}
  <tr>
    <td style="${S.tdLabel}">End Date</td>
    <td style="${S.tdValue}">{{end_date}}</td>
  </tr>
  {{/if}}
  {{#if position_category}}
  <tr>
    <td style="${S.tdLabel}">Category</td>
    <td style="${S.tdValue}">{{position_category}}</td>
  </tr>
  {{/if}}
  {{#if experience}}
  <tr>
    <td style="${S.tdLabel}">Experience</td>
    <td style="${S.tdValue}">{{experience}}</td>
  </tr>
  {{/if}}
</table>

<p style="${S.p}">If you have any questions or would like to explore other opportunities, just reply to this email — we're here to help.</p>

<p style="${S.pLast}">Best regards,<br><strong style="${S.strong}">The Team at {{portalName}}</strong></p>
`;

const compiledBody = Handlebars.compile(bodySource);

export function jobseekerRemovalHtmlTemplate(vars: Record<string, any>): string {
  const portalName = getPortalName();
  const body = compiledBody({ ...vars, portalName });
  return wrapInLayout("Position Assignment Update", body, portalName, ACCENT_RED);
} 