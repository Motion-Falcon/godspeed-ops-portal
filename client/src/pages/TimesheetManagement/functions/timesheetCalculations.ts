import type { JobSeekerProfile } from "../../../types/jobseeker";
import { buildTimesheetRowsForPayroll } from "../../../lib/hybridPayrollSplit";
import type {
  TimesheetDayEntry,
  WeeklyTimesheet,
  ClientPosition,
  PositionWithOvertime,
} from "../types";

export interface PayrollComputationContext {
  positions: ClientPosition[];
  selectedPositionId: string | undefined;
  jobseeker: JobSeekerProfile | null;
}

export function resolvePositionRates(position: ClientPosition) {
  const regularPayRate = parseFloat(position.regularPayRate || "0");
  const premiumPayRate = parseFloat(position.premiumPayRate || "0");
  const effectivePayRate = regularPayRate + premiumPayRate;
  const regularBillRate = parseFloat(position.billRate || "0");
  let overtimePayRate = effectivePayRate;
  let overtimeBillRate = regularBillRate;
  if (
    position.overtimeEnabled &&
    position.overtimePayRate &&
    position.overtimeBillRate
  ) {
    overtimePayRate = parseFloat(position.overtimePayRate);
    overtimeBillRate = parseFloat(position.overtimeBillRate);
  }
  return {
    regularPayRate,
    premiumPayRate,
    effectivePayRate,
    regularBillRate,
    overtimePayRate,
    overtimeBillRate,
  };
}

function findPositionAssignment(
  ctx: PayrollComputationContext
): ClientPosition | undefined {
  if (!ctx.selectedPositionId) return undefined;
  return ctx.positions.find((p) => p.id === ctx.selectedPositionId);
}

export function calculateTimesheetTotals(
  entries: TimesheetDayEntry[],
  ctx: PayrollComputationContext,
  bonusAmount = 0,
  deductionAmount = 0
): {
  totalRegularHours: number;
  totalOvertimeHours: number;
  jobseekerPay: number;
  clientBill: number;
  taxAmount: number;
} {
  const assignment = findPositionAssignment(ctx);
  if (!assignment) {
    return {
      totalRegularHours: 0,
      totalOvertimeHours: 0,
      jobseekerPay: 0,
      clientBill: 0,
      taxAmount: 0,
    };
  }

  const {
    effectivePayRate,
    overtimePayRate,
    regularBillRate,
    overtimeBillRate,
  } = resolvePositionRates(assignment);

  const daily = entries.map((e) => ({ date: e.date, hours: e.hours }));
  const cap = parseFloat(String(ctx.jobseeker?.sinPayrollHoursCap ?? "0"));

  const rows = buildTimesheetRowsForPayroll({
    entries: daily,
    overtimeEnabled: !!assignment.overtimeEnabled,
    overtimeHoursRaw: assignment.overtimeHours,
    effectiveRegularPayRate: effectivePayRate,
    overtimePayRate,
    regularBillRate,
    overtimeBillRate,
    paymentMethod: ctx.jobseeker?.paymentMethod || "",
    sinPayrollHoursCap: Number.isFinite(cap) ? cap : 0,
    cashDeductionPct: parseFloat(ctx.jobseeker?.cashDeduction || "0"),
    bonusAmount,
    deductionAmount,
    hstGst: ctx.jobseeker?.hstGst,
  });

  if (rows.length === 0) {
    return {
      totalRegularHours: 0,
      totalOvertimeHours: 0,
      jobseekerPay: 0,
      clientBill: 0,
      taxAmount: 0,
    };
  }

  return {
    totalRegularHours: rows.reduce((s, r) => s + r.totalRegularHours, 0),
    totalOvertimeHours: rows.reduce((s, r) => s + r.totalOvertimeHours, 0),
    jobseekerPay: rows.reduce((s, r) => s + r.totalJobseekerPay, 0),
    clientBill: rows.reduce((s, r) => s + r.totalClientBill, 0),
    taxAmount: rows.reduce((s, r) => s + (r.taxAmount || 0), 0),
  };
}

/** Invoice preview rows (one or two lines for hybrid SIN + cash / e-Transfer). */
export function getPayrollPreviewRows(
  timesheet: WeeklyTimesheet,
  ctx: PayrollComputationContext
) {
  const assignment = findPositionAssignment(ctx);
  if (!assignment || !ctx.jobseeker) return [];

  const {
    effectivePayRate,
    overtimePayRate,
    regularBillRate,
    overtimeBillRate,
  } = resolvePositionRates(assignment);

  const daily = timesheet.entries.map((e) => ({ date: e.date, hours: e.hours }));
  const cap = parseFloat(String(ctx.jobseeker?.sinPayrollHoursCap ?? "0"));

  return buildTimesheetRowsForPayroll({
    entries: daily,
    overtimeEnabled: !!assignment.overtimeEnabled,
    overtimeHoursRaw: assignment.overtimeHours,
    effectiveRegularPayRate: effectivePayRate,
    overtimePayRate,
    regularBillRate,
    overtimeBillRate,
    paymentMethod: ctx.jobseeker.paymentMethod || "",
    sinPayrollHoursCap: Number.isFinite(cap) ? cap : 0,
    cashDeductionPct: parseFloat(ctx.jobseeker.cashDeduction || "0"),
    bonusAmount: timesheet.bonusAmount || 0,
    deductionAmount: timesheet.deductionAmount || 0,
    hstGst: ctx.jobseeker.hstGst,
  });
}

export function getDayName(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-CA", {
    weekday: "short",
  });
}

/** Base pay from stored totals (regular + overtime, excludes bonus/deduction). */
export function getBaseJobseekerPay(
  timesheet: WeeklyTimesheet,
  position: ClientPosition | PositionWithOvertime
) {
  const effectivePayRate =
    parseFloat(position.regularPayRate || "0") +
    parseFloat(position.premiumPayRate || "0");
  const regularPay = timesheet.totalRegularHours * effectivePayRate;
  let overtimePayRate = effectivePayRate;
  if (position.overtimeEnabled && position.overtimePayRate) {
    overtimePayRate = parseFloat(position.overtimePayRate);
  }
  const overtimePay = timesheet.totalOvertimeHours * overtimePayRate;
  return regularPay + overtimePay;
}
