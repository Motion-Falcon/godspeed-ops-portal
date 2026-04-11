import Handlebars from "handlebars";
import { toNum } from "./timesheet-email-numeric.js";
import { wrapInLayout, ensureHelpers, S, getPortalName, textFooter, ACCENT_BLUE } from "./_layout.js";

ensureHelpers();

const bodySource = `
{{#if isUpdated}}
<div style="margin:0 0 16px;">
  <span style="${S.badgeUpdate}">UPDATED</span>
</div>
{{/if}}

<table style="${S.table}margin:0 0 20px;">
  <tr>
    <td style="vertical-align:top;padding:0;">
      <p style="margin:0 0 2px;${S.muted}">Jobseeker</p>
      <p style="margin:0;font-size:15px;${S.strong}">{{jobseeker_name}}</p>
      <p style="margin:2px 0 0;${S.muted}">{{jobseeker_email}}</p>
    </td>
    <td style="vertical-align:top;padding:0;text-align:right;">
      <p style="margin:0 0 2px;${S.muted}">Period</p>
      <p style="margin:0;font-size:14px;color:#1a1a1a;">{{week_start_date}} — {{week_end_date}}</p>
      <p style="margin:2px 0 0;${S.muted}">Generated {{generated_date}}</p>
    </td>
  </tr>
</table>

<div style="${S.infoBox}">
  <p style="margin:0 0 2px;${S.muted}">Position</p>
  <p style="margin:0;font-size:15px;${S.strong}">{{position_title}}</p>
</div>

<h3 style="${S.h3}">Daily Hours</h3>
<table style="${S.table}">
  <thead>
    <tr>
      <th style="${S.th}">Date</th>
      <th style="${S.thRight}">Hours</th>
    </tr>
  </thead>
  <tbody>
    {{#each dailyRows}}
    <tr>
      <td style="${S.td}">{{this.date}}</td>
      <td style="${S.tdRight}">{{this.hours}}</td>
    </tr>
    {{else}}
    <tr><td colspan="2" style="${S.td}text-align:center;color:#6e6e6e;">No hours recorded</td></tr>
    {{/each}}
  </tbody>
</table>

<h3 style="${S.h3}">Payment Summary</h3>
<table style="${S.table}">
  <tr>
    <td style="${S.tdLabel}">Regular Hours</td>
    <td style="${S.tdValue}text-align:right;">{{totalRegH}} hrs</td>
  </tr>
  <tr>
    <td style="${S.tdLabel}">Regular Rate</td>
    <td style="${S.tdValue}text-align:right;">{{currency effectiveRegularRate}}/hr</td>
  </tr>
  <tr>
    <td style="${S.tdLabel}">Regular Pay</td>
    <td style="${S.tdValue}text-align:right;">{{currency regularPay}}</td>
  </tr>
  {{#if showOvertime}}
  <tr>
    <td style="${S.tdLabel}">Overtime Hours</td>
    <td style="${S.tdValue}text-align:right;">{{totalOtH}} hrs</td>
  </tr>
  <tr>
    <td style="${S.tdLabel}">Overtime Rate</td>
    <td style="${S.tdValue}text-align:right;">{{currency overtimePayRate}}/hr</td>
  </tr>
  <tr>
    <td style="${S.tdLabel}">Overtime Pay</td>
    <td style="${S.tdValue}text-align:right;">{{currency overtimePay}}</td>
  </tr>
  {{/if}}
  {{#if showBonus}}
  <tr>
    <td style="${S.tdLabel}">Bonus</td>
    <td style="${S.tdValue}text-align:right;">{{currency bonusAmt}}</td>
  </tr>
  {{/if}}
  {{#if showDeduction}}
  <tr>
    <td style="${S.tdLabel}">Deductions</td>
    <td style="${S.tdValue}text-align:right;">-{{currency dedAmt}}</td>
  </tr>
  {{/if}}
  {{#if showCashDed}}
  <tr>
    <td style="${S.tdLabel}">Cash Deduction ({{cashDedPct}}%)</td>
    <td style="${S.tdValue}text-align:right;">-{{currency cashDedAmt}}</td>
  </tr>
  {{/if}}
  <tr>
    <td style="${S.totalLabel}">Total Pay</td>
    <td style="${S.totalValue}">{{currency totalPay}}</td>
  </tr>
</table>

<p style="margin:24px 0 0;${S.muted}text-align:center;">If you have any questions about this timesheet, please contact your recruitment team.</p>
`;

const compiledBody = Handlebars.compile(bodySource);

export function timesheetHtmlTemplate(vars: Record<string, any>): string {
  const portalName = getPortalName();
  const isUpdated = vars.is_updated || false;
  const titlePrefix = isUpdated ? "Updated " : "";

  const totalRegH = toNum(vars.total_regular_hours);
  const totalOtH = toNum(vars.total_overtime_hours);
  const regularPayRate = toNum(vars.regular_pay_rate);
  const premiumPayRate = toNum(vars.premium_pay_rate);
  const overtimePayRate = toNum(vars.overtime_pay_rate);
  const bonusAmt = toNum(vars.bonus_amount);
  const dedAmt = toNum(vars.deduction_amount);
  const cashDedPct = toNum(vars.cash_deduction_percentage);
  const cashDedAmt = toNum(vars.cash_deduction_amount);
  const totalPay = toNum(vars.total_jobseeker_pay);
  const effectiveRegularRate = regularPayRate + premiumPayRate;
  const regularPay = totalRegH * effectiveRegularRate;
  const overtimePay = totalOtH * overtimePayRate;

  const dailyRows = vars.daily_hours
    ? vars.daily_hours.map((day: any) => ({
        date: new Date(day.date).toLocaleDateString(),
        hours: day.hours || 0,
      }))
    : [];

  const data = {
    ...vars,
    portalName,
    isUpdated,
    totalRegH,
    totalOtH,
    regularPayRate,
    effectiveRegularRate,
    overtimePayRate,
    bonusAmt,
    dedAmt,
    cashDedPct,
    cashDedAmt,
    totalPay,
    regularPay,
    overtimePay,
    showOvertime: vars.overtime_enabled && totalOtH > 0,
    showBonus: bonusAmt > 0,
    showDeduction: dedAmt > 0,
    showCashDed: cashDedPct > 0,
    dailyRows,
    generated_date: vars.generated_date || new Date().toLocaleDateString(),
  };

  const body = compiledBody(data);
  return wrapInLayout(
    `${titlePrefix}Timesheet #${vars.invoice_number || "N/A"}`,
    body,
    portalName,
    ACCENT_BLUE
  );
}
