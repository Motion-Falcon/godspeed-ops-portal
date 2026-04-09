import { toNum } from "./timesheet-email-numeric.js";
import { getPortalName, textFooter } from "./_layout.js";

export function timesheetTextTemplate(vars: Record<string, any>): string {
  const isUpdated = vars.is_updated || false;
  const portalName = getPortalName();
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
  const regularPay = totalRegH * (regularPayRate + premiumPayRate);
  const overtimePay = totalOtH * overtimePayRate;

  const dailyLines = vars.daily_hours
    ? vars.daily_hours
        .map((day: any) => `  ${new Date(day.date).toLocaleDateString()}: ${day.hours || 0} hrs`)
        .join("\n")
    : "  No hours recorded";

  const lines: string[] = [
    `Subject: ${titlePrefix}Timesheet #${vars.invoice_number || "N/A"}`,
    ``,
    `${titlePrefix}TIMESHEET SUMMARY`,
    ``,
    `Timesheet: #${vars.invoice_number || "N/A"}`,
    `Generated: ${vars.generated_date || new Date().toLocaleDateString()}`,
    ``,
    `Jobseeker: ${vars.jobseeker_name || "N/A"} (${vars.jobseeker_email || "N/A"})`,
    `Position: ${vars.position_title || "N/A"}`,
    `Period: ${vars.week_start_date || "N/A"} — ${vars.week_end_date || "N/A"}`,
    ``,
    `Daily Hours:`,
    dailyLines,
    ``,
    `Payment Summary:`,
    `  Regular Hours: ${totalRegH} hrs`,
    `  Regular Rate: $${regularPayRate.toFixed(2)}/hr`,
  ];

  if (premiumPayRate > 0) lines.push(`  Premium Rate: $${premiumPayRate.toFixed(2)}/hr`);
  lines.push(`  Regular Pay: $${regularPay.toFixed(2)}`);

  if (vars.overtime_enabled && totalOtH > 0) {
    lines.push(`  Overtime Hours: ${totalOtH} hrs`);
    lines.push(`  Overtime Rate: $${overtimePayRate.toFixed(2)}/hr`);
    lines.push(`  Overtime Pay: $${overtimePay.toFixed(2)}`);
  }
  if (bonusAmt > 0) lines.push(`  Bonus: $${bonusAmt.toFixed(2)}`);
  if (dedAmt > 0) lines.push(`  Deductions: -$${dedAmt.toFixed(2)}`);
  if (cashDedPct > 0) lines.push(`  Cash Deduction (${cashDedPct}%): -$${cashDedAmt.toFixed(2)}`);

  lines.push(
    ``,
    `  Total Pay: $${totalPay.toFixed(2)}`,
    ``,
    `If you have any questions about this timesheet, please contact your recruitment team.`,
    ``,
    textFooter(portalName)
  );

  return lines.join("\n");
}
