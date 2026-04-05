import { toNum } from "./timesheet-email-numeric.js";

export function timesheetHtmlTemplate(vars: Record<string, any>) {
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

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>${titlePrefix}Timesheet Summary - ${
    vars.invoice_number || "Invoice"
  }</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f8f9fa; color: #222; margin: 0; padding: 0; }
      .container { background: #fff; max-width: 700px; margin: 40px auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 32px 24px; }
      h2 { color: #2e7d32; margin-top: 0; text-align: center; }
      .header { text-align: center; margin-bottom: 30px; }
      .invoice-info { width: 100%; margin-bottom: 30px; }
      .invoice-info table { width: 100%; border-collapse: collapse; }
      .invoice-info td { vertical-align: top; padding: 0; }
      .invoice-info .right { text-align: right; }
      .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ddd; }
      .details-table th, .details-table td { padding: 12px 8px; text-align: left; border-bottom: 1px solid #ddd; }
      .details-table th { background-color: #f5f5f5; font-weight: bold; color: #333; }
      .details-table .date { width: 120px; }
      .details-table .hours { width: 80px; text-align: center; }
      .summary-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      .summary-table td { padding: 8px 0; vertical-align: top; }
      .summary-table .label { font-weight: bold; color: #555; width: 200px; }
      .summary-table .value { text-align: right; font-weight: bold; }
      .total-row { border-top: 2px solid #2e7d32; font-size: 16px; }
      .footer { font-size: 12px; color: #888; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; text-align: center; }
      .position-info { background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 20px 0; }
      .position-info h3 { margin: 0 0 10px 0; color: #2e7d32; font-size: 16px; }
      .updated-badge { background: #ff9800; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 10px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>${titlePrefix}Timesheet Summary ${
    isUpdated ? '<span class="updated-badge">UPDATED</span>' : ""
  }</h2>
        <p><strong>Timesheet #${vars.invoice_number || "N/A"}</strong></p>
      </div>

      <div class="invoice-info">
        <table>
          <tr>
            <td>
              <strong>Jobseeker:</strong><br>
              ${vars.jobseeker_name || "N/A"}<br>
              ${vars.jobseeker_email || ""}
            </td>
            <td class="right">
              <strong>Week Period:</strong><br>
              ${vars.week_start_date || "N/A"} to ${
    vars.week_end_date || "N/A"
  }<br>
              <strong>Generated:</strong> ${
                vars.generated_date || new Date().toLocaleDateString()
              }
            </td>
          </tr>
        </table>
      </div>

      <div class="position-info">
        <h3>Position Details</h3>
        <table class="summary-table">
          <tr>
            <td class="label">Position:</td>
            <td>${vars.position_title || "N/A"}</td>
          </tr>
        </table>
      </div>

      <h3>Daily Hours Breakdown</h3>
      <table class="details-table">
        <thead>
          <tr>
            <th class="date">Date</th>
            <th class="hours">Hours Worked</th>
          </tr>
        </thead>
        <tbody>
          ${
            vars.daily_hours
              ? vars.daily_hours
                  .map(
                    (day: any) => `
            <tr>
              <td class="date">${new Date(day.date).toLocaleDateString()}</td>
              <td class="hours">${day.hours || 0}</td>
            </tr>
          `
                  )
                  .join("")
              : '<tr><td colspan="2" style="text-align: center;">No daily hours data available</td></tr>'
          }
        </tbody>
      </table>

      <h3>Payment Summary</h3>
      <table class="summary-table">
        <tr>
          <td class="label">Regular Hours:</td>
          <td class="value">${totalRegH} hours</td>
        </tr>
        <tr>
          <td class="label">Regular Pay Rate:</td>
          <td class="value">$${regularPayRate.toFixed(2)}/hour</td>
        </tr>
        ${
          premiumPayRate > 0
            ? `
        <tr>
          <td class="label">Premium Pay Rate:</td>
          <td class="value">$${premiumPayRate.toFixed(2)}/hour</td>
        </tr>
        `
            : ""
        }
        <tr>
          <td class="label">Regular Pay:</td>
          <td class="value">$${(
            totalRegH * (regularPayRate + premiumPayRate)
          ).toFixed(2)}</td>
        </tr>
        ${
          vars.overtime_enabled && totalOtH > 0
            ? `
        <tr>
          <td class="label">Overtime Hours:</td>
          <td class="value">${totalOtH} hours</td>
        </tr>
        <tr>
          <td class="label">Overtime Pay Rate:</td>
          <td class="value">$${overtimePayRate.toFixed(2)}/hour</td>
        </tr>
        <tr>
          <td class="label">Overtime Pay:</td>
          <td class="value">$${(totalOtH * overtimePayRate).toFixed(2)}</td>
        </tr>
        `
            : ""
        }
        ${
          bonusAmt > 0
            ? `
        <tr>
          <td class="label">Bonus Amount:</td>
          <td class="value">$${bonusAmt.toFixed(2)}</td>
        </tr>
        `
            : ""
        }
        ${
          dedAmt > 0
            ? `
        <tr>
          <td class="label">Deductions:</td>
          <td class="value">-$${dedAmt.toFixed(2)}</td>
        </tr>
        `
            : ""
        }
        ${
          cashDedPct > 0
            ? `
        <tr>
          <td class="label">Cash Deduction (${cashDedPct}%):</td>
          <td class="value">-$${cashDedAmt.toFixed(2)}</td>
        </tr>
        `
            : ""
        }
        <tr class="total-row">
          <td class="label">Total Jobseeker Pay:</td>
          <td class="value">$${totalPay.toFixed(2)}</td>
        </tr>
      </table>

      <div class="footer">
        <p>This is an automated timesheet summary from ${portalName}.</p>
        <p>If you have any questions about this timesheet, please contact your recruitment team.</p>
        <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  </body>
</html>
  `;
}
