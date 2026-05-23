import { timesheetHtmlTemplate } from "../email-templates/timesheet-html.js";
import { timesheetTextTemplate } from "../email-templates/timesheet-txt.js";
import {
  effectivePremiumPayRate,
  toNum,
} from "../email-templates/timesheet-email-numeric.js";
import type { TimesheetInput, TimesheetRow } from "../types/timesheet.types.js";
import { emailCashDeductionVars, supabase } from "./timesheet.service.js";

export async function buildCreateTimesheetNotifierEmail(
  timesheetData: TimesheetInput,
  newTimesheet: TimesheetRow | undefined
): Promise<{
  to: string;
  subject: string;
  text: string;
  html: string;
} | null> {
  const { data: jobseekerProfile } = await supabase
    .from("jobseeker_profiles")
    .select(
      "first_name, last_name, email, billing_email, payment_method, cash_deduction"
    )
    .eq("id", timesheetData.jobseeker_profile_id)
    .single();

  if (!jobseekerProfile?.email) {
    console.log(
      "[EmailNotifier] No jobseeker email found, skipping email send."
    );
    return null;
  }

  const emailTo = jobseekerProfile.billing_email || jobseekerProfile.email;

  const { data: position } = await supabase
    .from("positions")
    .select("title, client_name, city, province, premium_pay_rate")
    .eq("id", timesheetData.position_id!)
    .single();

  const premiumPayRate = effectivePremiumPayRate(
    timesheetData.premium_pay_rate,
    position?.premium_pay_rate
  );

  const templateVars = {
    invoice_number: timesheetData.invoice_number || newTimesheet?.invoice_number,
    jobseeker_name: `${jobseekerProfile.first_name} ${jobseekerProfile.last_name}`,
    jobseeker_email: emailTo,
    position_title: position?.title || "Unknown Position",
    week_start_date: timesheetData.week_start_date,
    week_end_date: timesheetData.week_end_date,
    daily_hours: timesheetData.daily_hours || [],
    total_regular_hours: timesheetData.total_regular_hours,
    total_overtime_hours: timesheetData.total_overtime_hours,
    regular_pay_rate: timesheetData.regular_pay_rate,
    premium_pay_rate: premiumPayRate,
    overtime_pay_rate: timesheetData.overtime_pay_rate,
    total_jobseeker_pay: timesheetData.total_jobseeker_pay,
    overtime_enabled: timesheetData.overtime_enabled,
    bonus_amount: timesheetData.bonus_amount,
    deduction_amount: timesheetData.deduction_amount,
    ...emailCashDeductionVars({
      linePaymentMethod: timesheetData.line_payment_method,
      profilePaymentMethod: jobseekerProfile.payment_method,
      cashDeductionStr: jobseekerProfile.cash_deduction,
      totalRegularHours: toNum(timesheetData.total_regular_hours),
      regularPayRate: toNum(timesheetData.regular_pay_rate),
      premiumPayRate,
      totalOvertimeHours: toNum(timesheetData.total_overtime_hours),
      overtimePayRate: toNum(timesheetData.overtime_pay_rate),
    }),
    generated_date: new Date().toLocaleDateString(),
  };

  const html = timesheetHtmlTemplate(templateVars);
  const text = timesheetTextTemplate(templateVars);
  const [subjectLine, ...bodyLines] = text.split("\n");
  const subject = subjectLine.replace("Subject:", "").trim();

  return {
    to: emailTo,
    subject,
    text: bodyLines.join("\n").trim(),
    html,
  };
}

export async function buildUpdateTimesheetNotifierEmail(
  timesheetData: TimesheetInput,
  updatedTimesheet: TimesheetRow | undefined
): Promise<{
  to: string;
  subject: string;
  text: string;
  html: string;
} | null> {
  const { data: jobseekerProfile } = await supabase
    .from("jobseeker_profiles")
    .select(
      "first_name, last_name, email, billing_email, payment_method, cash_deduction"
    )
    .eq("id", timesheetData.jobseeker_profile_id)
    .single();

  if (!jobseekerProfile?.email) {
    console.log(
      "[EmailNotifier] No jobseeker email found, skipping email send."
    );
    return null;
  }

  const emailTo = jobseekerProfile.billing_email || jobseekerProfile.email;

  const { data: position } = await supabase
    .from("positions")
    .select("title, client_name, city, province, premium_pay_rate")
    .eq("id", timesheetData.position_id!)
    .single();

  const premiumPayRate = effectivePremiumPayRate(
    timesheetData.premium_pay_rate,
    position?.premium_pay_rate
  );

  const templateVars = {
    invoice_number:
      timesheetData.invoice_number || updatedTimesheet?.invoice_number,
    jobseeker_name: `${jobseekerProfile.first_name} ${jobseekerProfile.last_name}`,
    jobseeker_email: emailTo,
    position_title: position?.title || "Unknown Position",
    week_start_date: timesheetData.week_start_date,
    week_end_date: timesheetData.week_end_date,
    daily_hours: timesheetData.daily_hours || [],
    total_regular_hours: timesheetData.total_regular_hours,
    total_overtime_hours: timesheetData.total_overtime_hours,
    regular_pay_rate: timesheetData.regular_pay_rate,
    premium_pay_rate: premiumPayRate,
    overtime_pay_rate: timesheetData.overtime_pay_rate,
    total_jobseeker_pay: timesheetData.total_jobseeker_pay,
    overtime_enabled: timesheetData.overtime_enabled,
    bonus_amount: timesheetData.bonus_amount,
    deduction_amount: timesheetData.deduction_amount,
    ...emailCashDeductionVars({
      linePaymentMethod: timesheetData.line_payment_method,
      profilePaymentMethod: jobseekerProfile.payment_method,
      cashDeductionStr: jobseekerProfile.cash_deduction,
      totalRegularHours: toNum(timesheetData.total_regular_hours),
      regularPayRate: toNum(timesheetData.regular_pay_rate),
      premiumPayRate,
      totalOvertimeHours: toNum(timesheetData.total_overtime_hours),
      overtimePayRate: toNum(timesheetData.overtime_pay_rate),
    }),
    generated_date: new Date().toLocaleDateString(),
    is_updated: true,
  };

  const html = timesheetHtmlTemplate(templateVars);
  const text = timesheetTextTemplate(templateVars);
  const [subjectLine, ...bodyLines] = text.split("\n");
  const subject = subjectLine.replace("Subject:", "").trim();

  return {
    to: emailTo,
    subject,
    text: bodyLines.join("\n").trim(),
    html,
  };
}
