import Handlebars from "handlebars";
import { wrapInLayout, ensureHelpers, S, getPortalName, textFooter, ACCENT_GREEN } from "./_layout.js";

ensureHelpers();

const bodySource = `
<p style="${S.p}"><strong style="${S.strong}">Congratulations{{#if jobseeker_first_name}}, {{jobseeker_first_name}}{{/if}}!</strong></p>

<p style="${S.p}">We are excited to share that you have been assigned to a new position through {{portalName}}.</p>

<p style="${S.p}">Please review your assignment details below carefully. To secure your spot, please reply to this email or by call to confirm you are available for this shift.</p>

<p style="${S.h3}">Assignment Details:</p>

<table style="${S.table}">
  <tr>
    <td style="${S.tdLabel}">Position</td>
    <td style="${S.tdValue}"><strong style="${S.strong}">{{title}}</strong></td>
  </tr>
  {{#if client_name}}
  <tr>
    <td style="${S.tdLabel}">Client</td>
    <td style="${S.tdValue}">{{client_name}}</td>
  </tr>
  {{/if}}
  <tr>
    <td style="${S.tdLabel}">Location</td>
    <td style="${S.tdValue}">{{#if full_address}}{{full_address}}{{else}}{{city}}, {{province}}{{/if}}</td>
  </tr>
  <tr>
    <td style="${S.tdLabel}">Employment Type</td>
    <td style="${S.tdValue}">{{employment_type}}{{#if employment_term}} ({{employment_term}}){{/if}}</td>
  </tr>
  {{#if pay_display}}
  <tr>
    <td style="${S.tdLabel}">Pay Rate</td>
    <td style="${S.tdValue}">{{pay_display}}</td>
  </tr>
  {{/if}}
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
</table>

<p style="${S.p}">Our team will reach out to you shortly with specific arrival instructions (who to ask for, dress code, etc.).</p>

<p style="${S.p}">If you have any immediate questions, please let us know when you reply to confirm your shift!</p>

<p style="${S.pLast}">Best regards,<br><strong style="${S.strong}">The Team at {{portalName}}</strong></p>
`;

const compiledBody = Handlebars.compile(bodySource);

export function jobseekerAssignmentHtmlTemplate(vars: Record<string, any>): string {
  const portalName = getPortalName();
  const fullAddress = [vars.street_address, vars.city, vars.province, vars.postal_code]
    .filter(Boolean)
    .join(", ");
  const payDisplay = [
    vars.regular_pay_rate ? `$${vars.regular_pay_rate}` : "",
    vars.payrate_type ? `/ ${vars.payrate_type}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const emailTitle = [
    "Assignment Confirmation",
    vars.title ? `: ${vars.title}` : "",
    vars.client_name ? ` at ${vars.client_name}` : "",
    vars.city ? ` (${vars.city})` : "",
  ].join("");

  const data = {
    ...vars,
    portalName,
    full_address: (vars.street_address || vars.postal_code) ? fullAddress : "",
    pay_display: payDisplay,
  };

  const body = compiledBody(data);
  return wrapInLayout(emailTitle, body, portalName, ACCENT_GREEN);
}
