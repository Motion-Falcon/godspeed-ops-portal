/**
 * Coerce API/DB values (numbers, numeric strings, DECIMAL from PostgREST) to finite numbers.
 */
export function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v.trim()) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Use timesheet snapshot premium when set; otherwise fall back to the linked position.
 * Fixes emails when legacy rows or partial updates left timesheets.premium_pay_rate at 0
 * while total_jobseeker_pay was computed with premium.
 */
export function effectivePremiumPayRate(
  timesheetPremium: unknown,
  positionPremium: unknown
): number {
  const stored = toNum(timesheetPremium);
  if (stored > 0) return stored;
  return toNum(positionPremium);
}
