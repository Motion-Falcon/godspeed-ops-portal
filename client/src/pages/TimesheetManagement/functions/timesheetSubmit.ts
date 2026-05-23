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
