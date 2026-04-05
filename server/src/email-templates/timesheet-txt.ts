import { toNum } from "./timesheet-email-numeric.js";

export function timesheetTextTemplate(vars: Record<string, any>) {
  const isUpdated = vars.is_updated || false;
  const portalName = process.env.PORTAL_NAME || 'Ops Portal';
  const titlePrefix = isUpdated ? 'Updated ' : '';

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

  return `Subject: ${titlePrefix}Timesheet Summary - Timesheet #${vars.invoice_number || 'N/A'}

${titlePrefix.toUpperCase()}TIMESHEET SUMMARY
${"=".repeat(titlePrefix.length + 16)}

Timesheet Number: ${vars.invoice_number || "N/A"}
Generated: ${vars.generated_date || new Date().toLocaleDateString()}

JOBSEEKER INFORMATION
--------------------
Name: ${vars.jobseeker_name || "N/A"}
Email: ${vars.jobseeker_email || "N/A"}

POSITION DETAILS
---------------
Position: ${vars.position_title || "N/A"}

WEEK PERIOD
-----------
Start Date: ${vars.week_start_date || "N/A"}
End Date: ${vars.week_end_date || "N/A"}

DAILY HOURS BREAKDOWN
--------------------
${
  vars.daily_hours
    ? vars.daily_hours
        .map((day: any) => {
          const date = new Date(day.date).toLocaleDateString();
          const hours = day.hours || 0;
          return `${date}: ${hours} hours`;
        })
        .join("\n")
    : "No daily hours data available"
}

PAYMENT SUMMARY
---------------
Regular Hours: ${totalRegH} hours
Regular Pay Rate: $${regularPayRate.toFixed(2)}/hour${
    premiumPayRate > 0
      ? `
Premium Pay Rate: $${premiumPayRate.toFixed(2)}/hour`
      : ""
  }
Regular Pay: $${(totalRegH * (regularPayRate + premiumPayRate)).toFixed(2)}${
    vars.overtime_enabled && totalOtH > 0
      ? `
Overtime Hours: ${totalOtH} hours
Overtime Pay Rate: $${overtimePayRate.toFixed(2)}/hour
Overtime Pay: $${(totalOtH * overtimePayRate).toFixed(2)}`
      : ""
  }${
    bonusAmt > 0
      ? `
Bonus Amount: $${bonusAmt.toFixed(2)}`
      : ""
  }${
    dedAmt > 0
      ? `
Deductions: -$${dedAmt.toFixed(2)}`
      : ""
  }${
    cashDedPct > 0
      ? `
Cash Deduction (${cashDedPct}%): -$${cashDedAmt.toFixed(2)}`
      : ""
  }

TOTAL JOBSEEKER PAY: $${totalPay.toFixed(2)}

---
This is an automated timesheet summary from ${portalName}.
If you have any questions about this timesheet, please contact your recruitment team.
Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;
}
