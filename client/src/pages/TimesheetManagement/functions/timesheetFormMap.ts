import type {
  WeeklyTimesheet,
  WeeklyTimesheetSeed,
} from "../types";
import type { PayrollComputationContext } from "./timesheetCalculations";
import { calculateTimesheetTotals } from "./timesheetCalculations";

/**
 * Converts a snake_case {@link WeeklyTimesheetSeed} (from API/week helpers)
 * into camelCase {@link WeeklyTimesheet} for React form state.
 */
export function mapWeeklyTimesheetSeedToForm(
  seed: WeeklyTimesheetSeed,
  positionId: string,
  payrollCtx: PayrollComputationContext
): WeeklyTimesheet {
  const totals = calculateTimesheetTotals(
    seed.entries,
    payrollCtx,
    seed.bonus_amount,
    seed.deduction_amount
  );

  return {
    positionId,
    invoiceNumber: seed.invoice_number,
    weekStartDate: seed.week_start_date,
    weekEndDate: seed.week_end_date,
    entries: seed.entries,
    ...totals,
    bonusAmount: seed.bonus_amount,
    deductionAmount: seed.deduction_amount,
    notes: seed.notes,
    existingTimesheetId: seed.existingTimesheetId,
    splitExistingIds: seed.splitExistingIds,
  };
}
