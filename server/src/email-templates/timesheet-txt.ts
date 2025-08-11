export function timesheetTextTemplate(vars: Record<string, any>) {
  const isUpdated = vars.is_updated || false;
  const titlePrefix = isUpdated ? 'Updated ' : '';
  
  return `Subject: ${titlePrefix}Timesheet Summary - Timesheet #${vars.invoice_number || 'N/A'}

${titlePrefix.toUpperCase()}TIMESHEET SUMMARY
${'='.repeat(titlePrefix.length + 16)}

Timesheet Number: ${vars.invoice_number || 'N/A'}
Generated: ${vars.generated_date || new Date().toLocaleDateString()}

JOBSEEKER INFORMATION
--------------------
Name: ${vars.jobseeker_name || 'N/A'}
Email: ${vars.jobseeker_email || 'N/A'}

POSITION DETAILS
---------------
Position: ${vars.position_title || 'N/A'}

WEEK PERIOD
-----------
Start Date: ${vars.week_start_date || 'N/A'}
End Date: ${vars.week_end_date || 'N/A'}

DAILY HOURS BREAKDOWN
--------------------
${vars.daily_hours ? vars.daily_hours.map((day: any) => {
  const date = new Date(day.date).toLocaleDateString();
  const hours = day.hours || 0;
  return `${date}: ${hours} hours`;
}).join('\n') : 'No daily hours data available'}

PAYMENT SUMMARY
---------------
Regular Hours: ${vars.total_regular_hours || 0} hours
Regular Pay Rate: $${(vars.regular_pay_rate || 0).toFixed(2)}/hour
Regular Pay: $${((vars.total_regular_hours || 0) * (vars.regular_pay_rate || 0)).toFixed(2)}${vars.overtime_enabled && vars.total_overtime_hours > 0 ? `
Overtime Hours: ${vars.total_overtime_hours || 0} hours
Overtime Pay Rate: $${(vars.overtime_pay_rate || 0).toFixed(2)}/hour
Overtime Pay: $${((vars.total_overtime_hours || 0) * (vars.overtime_pay_rate || 0)).toFixed(2)}` : ''}${vars.bonus_amount && vars.bonus_amount > 0 ? `
Bonus Amount: $${(vars.bonus_amount || 0).toFixed(2)}` : ''}${vars.deduction_amount && vars.deduction_amount > 0 ? `
Deductions: -$${(vars.deduction_amount || 0).toFixed(2)}` : ''}

TOTAL JOBSEEKER PAY: $${(vars.total_jobseeker_pay || 0).toFixed(2)}

---
This is an automated timesheet summary from Motion Falcon Operations Portal.
If you have any questions about this timesheet, please contact your recruitment team.
Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;
} 