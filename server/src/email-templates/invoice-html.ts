import Handlebars from "handlebars";
import { wrapInLayout, ensureHelpers, S, getPortalName, textFooter, ACCENT_BLUE } from "./_layout.js";

ensureHelpers();

interface InvoiceEmailTemplateVars {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  clientName: string;
  clientEmail: string;
  grandTotal: string;
  currency: string;
  messageOnInvoice?: string;
}

const bodySource = `
<p style="${S.p}">Hi {{clientName}},</p>

<p style="${S.p}">Please find the details for your invoice below.</p>

<table style="${S.table}">
  <tr>
    <td style="${S.tdLabel}">Invoice Number</td>
    <td style="${S.tdValue}"><strong style="${S.strong}">{{invoiceNumber}}</strong></td>
  </tr>
  <tr>
    <td style="${S.tdLabel}">Issued</td>
    <td style="${S.tdValue}">{{invoiceDate}}</td>
  </tr>
  <tr>
    <td style="${S.tdLabel}">Due Date</td>
    <td style="${S.tdValue}">{{dueDate}}</td>
  </tr>
  <tr>
    <td style="${S.tdLabel}">Client</td>
    <td style="${S.tdValue}">{{clientName}}</td>
  </tr>
  <tr>
    <td style="${S.tdLabel}">Email</td>
    <td style="${S.tdValue}">{{clientEmail}}</td>
  </tr>
  <tr>
    <td style="${S.totalLabel}">Amount Due</td>
    <td style="${S.totalValue}">\$ {{grandTotal}}</td>
  </tr>
</table>

{{#if messageOnInvoice}}
<div style="${S.notice}">
  {{messageOnInvoice}}
</div>
{{/if}}

<p style="${S.p}">A detailed PDF invoice is attached to this email for your records.</p>

<p style="${S.pLast}">Best regards,<br><strong style="${S.strong}">The Team at {{portalName}}</strong></p>
`;

const compiledBody = Handlebars.compile(bodySource);

export function invoiceHtmlTemplate(vars: InvoiceEmailTemplateVars): string {
  const portalName = getPortalName();
  const body = compiledBody({ ...vars, portalName });
  return wrapInLayout(`Invoice #${vars.invoiceNumber}`, body, portalName, ACCENT_BLUE);
}

export function invoiceTextTemplate(vars: InvoiceEmailTemplateVars): string {
  const portalName = getPortalName();
  return `Invoice #${vars.invoiceNumber}

Hi ${vars.clientName},

Please find the details for your invoice below.

Invoice Number: ${vars.invoiceNumber}
Issued: ${vars.invoiceDate}
Due Date: ${vars.dueDate}
Client: ${vars.clientName}
Email: ${vars.clientEmail}
Amount Due: $${vars.grandTotal}
${vars.messageOnInvoice ? `\nNote: ${vars.messageOnInvoice}\n` : ""}
A detailed PDF invoice is attached to this email for your records.

Best regards,
The Team at ${portalName}

${textFooter(portalName)}`.trim();
} 