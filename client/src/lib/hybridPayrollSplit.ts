/** Hybrid SIN + cash / e-Transfer payroll: timesheet row split (client + types for API). */

export const HYBRID_SIN_CASH = "SIN and cash";
export const HYBRID_SIN_ETRANSFER = "SIN and e-Transfer";
export const SIN_DIRECT_DEPOSIT = "SIN-Direct Deposit";

export type PaySplitSegment = "single" | "sin" | "cash" | "e_transfer";

export interface DailyHourEntry {
  date: string;
  hours: number;
}

export interface WeeklyHoursSplitParams {
  entries: DailyHourEntry[];
  overtimeEnabled: boolean;
  /** Raw position.overtimeHours; if missing and OT enabled, 40 is used */
  overtimeHoursRaw?: string | null;
}

export interface HybridPayrollRates {
  effectiveRegularPayRate: number;
  overtimePayRate: number;
  regularBillRate: number;
  overtimeBillRate: number;
}

export interface BuildHybridRowsInput extends WeeklyHoursSplitParams, HybridPayrollRates {
  paymentMethod: string;
  sinPayrollHoursCap: number;
  cashDeductionPct: number;
  bonusAmount: number;
  deductionAmount: number;
  hstGst?: string | null;
}

export interface ComputedTimesheetRow {
  paySplitSegment: PaySplitSegment;
  linePaymentMethod: string | null;
  dailyHours: DailyHourEntry[];
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalClientBill: number;
  totalJobseekerPay: number;
  bonusAmount: number;
  deductionAmount: number;
  taxAmount?: number;
}

export function isHybridPaymentMethod(
  pm: string | undefined | null
): boolean {
  return pm === HYBRID_SIN_CASH || pm === HYBRID_SIN_ETRANSFER;
}

export function profileUsesCashDeductionField(
  pm: string | undefined | null
): boolean {
  if (!pm) return false;
  return (
    pm === "Cash" ||
    pm === "e-Transfer" ||
    isHybridPaymentMethod(pm)
  );
}

export function hybridSecondSegment(
  pm: string
): "cash" | "e_transfer" | null {
  if (pm === HYBRID_SIN_CASH) return "cash";
  if (pm === HYBRID_SIN_ETRANSFER) return "e_transfer";
  return null;
}

export function hybridSecondLinePaymentMethod(
  pm: string
): "Cash" | "e-Transfer" | null {
  if (pm === HYBRID_SIN_CASH) return "Cash";
  if (pm === HYBRID_SIN_ETRANSFER) return "e-Transfer";
  return null;
}

function roundHours(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseHstGstPercentage(hstGst?: string | null): number {
  if (!hstGst) return 0;
  // Match a number (e.g., "13", "13.5") optionally followed by a '%'
  const match = hstGst.match(/^([\d.]+)\s*%?$/);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    return isNaN(val) ? 0 : val;
  }
  return 0;
}

export function computeWeeklyRegularOvertime(
  params: WeeklyHoursSplitParams
): { weeklyRegularHours: number; weeklyOvertimeHours: number } {
  const sorted = [...params.entries].sort((a, b) => a.date.localeCompare(b.date));
  const totalWeeklyHours = sorted.reduce((s, e) => s + e.hours, 0);

  if (!params.overtimeEnabled) {
    return {
      weeklyRegularHours: roundHours(totalWeeklyHours),
      weeklyOvertimeHours: 0,
    };
  }

  const threshold = params.overtimeHoursRaw
    ? parseFloat(params.overtimeHoursRaw)
    : 40;

  const weeklyRegularHours = roundHours(
    Math.min(totalWeeklyHours, threshold)
  );
  const weeklyOvertimeHours = roundHours(
    Math.max(0, totalWeeklyHours - threshold)
  );
  return { weeklyRegularHours, weeklyOvertimeHours };
}

/** Per day: split hours into regular vs OT using chronological fill. */
function perDayRegOt(
  entriesSorted: DailyHourEntry[],
  weeklyRegular: number
): { date: string; reg: number; ot: number }[] {
  let remainingReg = weeklyRegular;
  return entriesSorted.map(({ date, hours }) => {
    const reg = Math.min(hours, remainingReg);
    const ot = roundHours(hours - reg);
    remainingReg = roundHours(remainingReg - reg);
    return { date, reg: roundHours(reg), ot };
  });
}

function splitDailyForHybrid(
  entriesSorted: DailyHourEntry[],
  weeklyRegular: number,
  sinRegularTotal: number
): { sinDaily: DailyHourEntry[]; cashDaily: DailyHourEntry[] } {
  const perDay = perDayRegOt(entriesSorted, weeklyRegular);
  let sinBudget = sinRegularTotal;
  const sinDaily: DailyHourEntry[] = [];
  const cashDaily: DailyHourEntry[] = [];

  for (const { date, reg, ot } of perDay) {
    const toSinReg = Math.min(reg, sinBudget);
    const toCashReg = roundHours(reg - toSinReg);
    const cashH = roundHours(toCashReg + ot);
    sinBudget = roundHours(sinBudget - toSinReg);
    sinDaily.push({ date, hours: roundHours(toSinReg) });
    cashDaily.push({ date, hours: cashH });
  }

  return { sinDaily, cashDaily };
}

/**
 * Build one or two logical timesheet rows for API submission.
 * Non-hybrid: one row, segment `single`, linePaymentMethod null.
 */
export function buildTimesheetRowsForPayroll(
  input: BuildHybridRowsInput
): ComputedTimesheetRow[] {
  const sorted = [...input.entries].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const { weeklyRegularHours, weeklyOvertimeHours } =
    computeWeeklyRegularOvertime({
      entries: sorted,
      overtimeEnabled: input.overtimeEnabled,
      overtimeHoursRaw: input.overtimeHoursRaw,
    });

  const totalHours = roundHours(weeklyRegularHours + weeklyOvertimeHours);
  if (totalHours <= 0) {
    return [];
  }

  if (!isHybridPaymentMethod(input.paymentMethod)) {
    let cashDeductionAmount = 0;
    let taxAmount = 0;
    const basePay =
      weeklyRegularHours * input.effectiveRegularPayRate +
      weeklyOvertimeHours * input.overtimePayRate;

    if (
      input.paymentMethod === "Cash" ||
      input.paymentMethod === "e-Transfer"
    ) {
      if (input.cashDeductionPct > 0) {
        cashDeductionAmount = basePay * (input.cashDeductionPct / 100);
      }
    } else if (
      input.paymentMethod === "Corporation-Direct Deposit" ||
      input.paymentMethod === "Corporation-Cheque" ||
      (input.paymentMethod && input.paymentMethod.includes("Corporation"))
    ) {
      const taxRate = parseHstGstPercentage(input.hstGst);
      if (taxRate > 0) {
        const taxableBase = Math.max(
          0,
          basePay + input.bonusAmount - input.deductionAmount
        );
        taxAmount = taxableBase * (taxRate / 100);
      }
    }
    const totalJobseekerPay =
      basePay - cashDeductionAmount + taxAmount + input.bonusAmount - input.deductionAmount;
    const clientBill =
      weeklyRegularHours * input.regularBillRate +
      weeklyOvertimeHours * input.overtimeBillRate;

    return [
      {
        paySplitSegment: "single",
        linePaymentMethod: null,
        dailyHours: sorted.map((e) => ({ ...e, hours: roundHours(e.hours) })),
        totalRegularHours: weeklyRegularHours,
        totalOvertimeHours: weeklyOvertimeHours,
        totalClientBill: roundHours(clientBill),
        totalJobseekerPay: roundHours(totalJobseekerPay),
        bonusAmount: input.bonusAmount,
        deductionAmount: input.deductionAmount,
        taxAmount: roundHours(taxAmount),
      },
    ];
  }

  const cap = Math.max(0, input.sinPayrollHoursCap);
  const sinRegular = roundHours(Math.min(cap, weeklyRegularHours));
  const cashRegular = roundHours(weeklyRegularHours - sinRegular);
  const cashOvertime = weeklyOvertimeHours;
  const sinOvertime = 0;

  const { sinDaily, cashDaily } = splitDailyForHybrid(
    sorted,
    weeklyRegularHours,
    sinRegular
  );

  const baseSin = sinRegular * input.effectiveRegularPayRate;
  const baseCash =
    cashRegular * input.effectiveRegularPayRate +
    cashOvertime * input.overtimePayRate;

  let cashDeductionAmount = 0;
  if (input.cashDeductionPct > 0 && baseCash > 0) {
    cashDeductionAmount = baseCash * (input.cashDeductionPct / 100);
  }

  const sinJobseekerPay =
    roundHours(baseSin) + input.bonusAmount - input.deductionAmount;
  const cashJobseekerPay = roundHours(baseCash - cashDeductionAmount);

  const sinClientBill =
    sinRegular * input.regularBillRate + sinOvertime * input.overtimeBillRate;
  const cashClientBill =
    cashRegular * input.regularBillRate +
    cashOvertime * input.overtimeBillRate;

  const secondSeg = hybridSecondSegment(input.paymentMethod);
  const secondLinePm = hybridSecondLinePaymentMethod(input.paymentMethod);
  if (!secondSeg || !secondLinePm) {
    return [];
  }

  const rows: ComputedTimesheetRow[] = [];

  const sinNeedsRow =
    sinRegular > 0 ||
    sinOvertime > 0 ||
    input.bonusAmount !== 0 ||
    input.deductionAmount !== 0;

  if (sinNeedsRow) {
    rows.push({
      paySplitSegment: "sin",
      linePaymentMethod: SIN_DIRECT_DEPOSIT,
      dailyHours: sinDaily,
      totalRegularHours: sinRegular,
      totalOvertimeHours: sinOvertime,
      totalClientBill: roundHours(sinClientBill),
      totalJobseekerPay: roundHours(sinJobseekerPay),
      bonusAmount: input.bonusAmount,
      deductionAmount: input.deductionAmount,
    });
  }

  const cashTotalHours = roundHours(cashRegular + cashOvertime);
  if (cashTotalHours > 0) {
    rows.push({
      paySplitSegment: secondSeg,
      linePaymentMethod: secondLinePm,
      dailyHours: cashDaily,
      totalRegularHours: cashRegular,
      totalOvertimeHours: cashOvertime,
      totalClientBill: roundHours(cashClientBill),
      totalJobseekerPay: roundHours(cashJobseekerPay),
      bonusAmount: 0,
      deductionAmount: 0,
    });
  }

  return rows;
}
