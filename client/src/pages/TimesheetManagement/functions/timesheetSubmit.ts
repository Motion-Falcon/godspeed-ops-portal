import type { JobSeekerProfile } from "../../../types/jobseeker";
import { buildTimesheetRowsForPayroll } from "../../../lib/hybridPayrollSplit";
import {
  createTimesheet,
  generateInvoiceNumber,
  updateTimesheet,
  type TimesheetInput,
  type TimesheetMutationResponse,
} from "../../../services/api/timesheet";
import { getWeekEndDate } from "./weekUtils";
import { resolvePositionRates } from "./timesheetCalculations";
import type { ClientPosition, PaySplitSegmentKey, WeeklyTimesheet } from "../types";

export interface SubmitWeeklyTimesheetsParams {
  timesheetsToProcess: WeeklyTimesheet[];
  jobseeker: JobSeekerProfile;
  selectedPosition: ClientPosition;
  selectedWeekStart: string;
  emailPreferences: Record<string, boolean>;
  isBulk?: boolean;
  bulkRows?: any[];
}

export interface SubmitWeeklyTimesheetsResult {
  results: TimesheetMutationResponse[];
  updatedCount: number;
  createdCount: number;
  emailCount: number;
}

export async function submitWeeklyTimesheets({
  timesheetsToProcess,
  jobseeker,
  selectedPosition,
  selectedWeekStart,
  emailPreferences,
  isBulk,
  bulkRows,
}: SubmitWeeklyTimesheetsParams): Promise<SubmitWeeklyTimesheetsResult> {
  const weekEndDateStr = getWeekEndDate(selectedWeekStart);
  const results: TimesheetMutationResponse[] = [];
  let updatedCount = 0;
  let createdCount = 0;

  const rates = resolvePositionRates(selectedPosition);
  const regularPayRate = rates.regularPayRate;
  const premiumPayRate = rates.premiumPayRate;
  const effectivePayRate = rates.effectivePayRate;
  const regularBillRate = rates.regularBillRate;
  const overtimePayRate = rates.overtimePayRate;
  const overtimeBillRate = rates.overtimeBillRate;

  const sinCap = parseFloat(String(jobseeker.sinPayrollHoursCap ?? "0"));

  if (isBulk && bulkRows && bulkRows.length > 0) {
    let totalRegularHours = 0;
    let totalOvertimeHours = 0;
    let totalJobseekerPay = 0;
    let totalClientBill = 0;
    let bonusAmount = 0;
    let deductionAmount = 0;
    let taxAmount = 0;
    let anyEmailSent = false;
    
    const dailyHoursMap = new Map<string, number>();
    
    const bulk_breakdown = bulkRows.map(r => {
      totalRegularHours += r.form.totalRegularHours;
      totalOvertimeHours += r.form.totalOvertimeHours;
      totalJobseekerPay += r.form.jobseekerPay;
      totalClientBill += r.form.clientBill;
      bonusAmount += r.form.bonusAmount;
      deductionAmount += r.form.deductionAmount;
      taxAmount += r.form.taxAmount || 0;
      if (r.emailSent) anyEmailSent = true;
      
      r.form.entries.forEach((e: any) => {
        const current = dailyHoursMap.get(e.date) || 0;
        dailyHoursMap.set(e.date, current + e.hours);
      });
      
      return {
        position_id: r.clientPosition.id,
        position_title: r.clientPosition.title,
        position_code: r.clientPosition.positionCode,
        regular_hours: r.form.totalRegularHours,
        overtime_hours: r.form.totalOvertimeHours,
        total_jobseeker_pay: r.form.jobseekerPay,
        total_client_bill: r.form.clientBill,
        regular_pay_rate: resolvePositionRates(r.clientPosition).effectivePayRate,
        regular_bill_rate: resolvePositionRates(r.clientPosition).regularBillRate,
        bonus_amount: r.form.bonusAmount,
        deduction_amount: r.form.deductionAmount,
        tax_amount: r.form.taxAmount || 0,
        notes: r.form.notes,
        entries: r.form.entries,
      };
    });
    
    const dailyHours = Array.from(dailyHoursMap.entries()).map(([date, hours]) => ({ date, hours })).sort((a,b) => a.date.localeCompare(b.date));

    const partial: TimesheetInput = {
      jobseeker_profile_id: jobseeker.id,
      jobseeker_user_id: jobseeker.userId,
      position_id: selectedPosition.id,
      week_start_date: selectedWeekStart,
      week_end_date: weekEndDateStr,
      daily_hours: dailyHours,
      total_regular_hours: totalRegularHours,
      total_overtime_hours: totalOvertimeHours,
      // Store the primary selected position's rates at the top level.
      // For single-position bulk this is the exact rate; for multi-position
      // bulk the authoritative per-position rates live in bulk_breakdown.
      regular_pay_rate: regularPayRate,
      premium_pay_rate: premiumPayRate,
      overtime_pay_rate: overtimePayRate,
      regular_bill_rate: regularBillRate,
      overtime_bill_rate: overtimeBillRate,
      total_jobseeker_pay: totalJobseekerPay,
      total_client_bill: totalClientBill,
      bonus_amount: bonusAmount,
      deduction_amount: deductionAmount,
      tax_amount: taxAmount,
      notes: "Aggregated Bulk Timesheet",
      overtime_enabled: true,
      email_sent: anyEmailSent,
      pay_split_segment: "single",
      line_payment_method: null,
      is_bulk: true,
      bulk_breakdown
    };

    const existingBulkId =
      bulkRows.find((r: any) => r.form?.existingTimesheetId)?.form
        ?.existingTimesheetId ||
      timesheetsToProcess.find((t: any) => t.existingTimesheetId)
        ?.existingTimesheetId;

    if (existingBulkId) {
      const result = await updateTimesheet(existingBulkId, partial);
      results.push(result);
      updatedCount += 1;
    } else {
      const inv = await generateInvoiceNumber();
      const result = await createTimesheet({
        ...partial,
        invoice_number: inv,
      });
      results.push(result);
      createdCount += 1;
    }

    let emailCount = 0;
    if (anyEmailSent) emailCount = 1;

    return {
      results,
      updatedCount,
      createdCount,
      emailCount,
    };
  }

  for (const timesheet of timesheetsToProcess) {
    const shouldSendEmail = emailPreferences[timesheet.positionId] || false;

    const dailyHours = timesheet.entries.map((entry) => ({
      date: entry.date,
      hours: entry.hours,
    }));

    const payrollRows = buildTimesheetRowsForPayroll({
      entries: dailyHours,
      overtimeEnabled: !!selectedPosition.overtimeEnabled,
      overtimeHoursRaw: selectedPosition.overtimeHours,
      effectiveRegularPayRate: effectivePayRate,
      overtimePayRate,
      regularBillRate,
      overtimeBillRate,
      paymentMethod: jobseeker.paymentMethod || "",
      sinPayrollHoursCap: Number.isFinite(sinCap) ? sinCap : 0,
      cashDeductionPct: parseFloat(jobseeker.cashDeduction || "0"),
      bonusAmount: timesheet.bonusAmount || 0,
      deductionAmount: timesheet.deductionAmount || 0,
      hstGst: jobseeker.hstGst,
    });

    for (const row of payrollRows) {
      const seg = row.paySplitSegment as PaySplitSegmentKey;
      const existingId =
        timesheet.splitExistingIds?.[seg] ??
        (seg === "single" ? timesheet.existingTimesheetId : undefined);

      const partial: TimesheetInput = {
        jobseeker_profile_id: jobseeker.id,
        jobseeker_user_id: jobseeker.userId,
        position_id: selectedPosition.id,
        week_start_date: selectedWeekStart,
        week_end_date: weekEndDateStr,
        daily_hours: row.dailyHours,
        total_regular_hours: row.totalRegularHours,
        total_overtime_hours: row.totalOvertimeHours,
        regular_pay_rate: regularPayRate,
        premium_pay_rate: premiumPayRate,
        overtime_pay_rate: overtimePayRate,
        regular_bill_rate: regularBillRate,
        overtime_bill_rate: overtimeBillRate,
        total_jobseeker_pay: row.totalJobseekerPay,
        total_client_bill: row.totalClientBill,
        bonus_amount: row.bonusAmount,
        deduction_amount: row.deductionAmount,
        tax_amount: row.taxAmount || 0,
        notes: timesheet.notes || "",
        overtime_enabled: selectedPosition.overtimeEnabled || false,
        markup: selectedPosition.markup
          ? parseFloat(selectedPosition.markup)
          : undefined,
        email_sent: shouldSendEmail,
        pay_split_segment: row.paySplitSegment,
        line_payment_method: row.linePaymentMethod,
      };

      if (existingId) {
        const result = await updateTimesheet(existingId, partial);
        results.push(result);
        updatedCount += 1;
      } else {
        const inv = await generateInvoiceNumber();
        const result = await createTimesheet({
          ...partial,
          invoice_number: inv,
        });
        results.push(result);
        createdCount += 1;
      }
    }
  }

  const emailCount = timesheetsToProcess.filter(
    (t) => emailPreferences[t.positionId]
  ).length;

  return {
    results,
    updatedCount,
    createdCount,
    emailCount,
  };
}
