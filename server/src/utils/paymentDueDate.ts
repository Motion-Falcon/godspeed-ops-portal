/**
 * Payment due dates from client pay_cycle + timesheet work week.
 * Offsets match client-provided schedule (days after period end).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseUtcDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const date = parseUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
}

/** Weeks since first Sunday on or before Jan 1 of that year (UTC). */
function sundayWeekIndex(weekStartDate: string): number {
  const weekStart = parseUtcDate(weekStartDate);
  const year = weekStart.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay();
  const firstSunday = new Date(jan1);
  firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
  const diffMs = weekStart.getTime() - firstSunday.getTime();
  return Math.floor(diffMs / (7 * MS_PER_DAY));
}

function holdDaysAfterPeriodEnd(payCycle: string): number | null {
  const normalized = payCycle.trim().toLowerCase();
  if (normalized.includes("2 week hold")) return 13;
  if (normalized.includes("1 week hold")) return 6;
  return null;
}

function isBiweeklyPayCycle(payCycle: string): boolean {
  return payCycle.trim().toLowerCase().includes("biweekly");
}

/**
 * End of the worked period: one week for weekly pay; two weeks for biweekly.
 */
function workedPeriodEnd(
  payCycle: string,
  weekStartDate: string,
  weekEndDate: string
): string {
  if (!isBiweeklyPayCycle(payCycle)) {
    return weekEndDate;
  }
  // Second Sunday-week of the pair ends on weekEnd; first week pays after next week ends.
  const isSecondWeekOfBiweek = sundayWeekIndex(weekStartDate) % 2 === 1;
  return isSecondWeekOfBiweek ? weekEndDate : addDays(weekEndDate, 7);
}

/**
 * Returns YYYY-MM-DD payment due date, or null if pay cycle is unknown.
 */
export function computePaymentDueDate(
  payCycle: string | null | undefined,
  weekStartDate: string,
  weekEndDate: string
): string | null {
  if (!payCycle?.trim() || !weekStartDate || !weekEndDate) {
    return null;
  }

  const holdDays = holdDaysAfterPeriodEnd(payCycle);
  if (holdDays === null) return null;

  const periodEnd = workedPeriodEnd(payCycle, weekStartDate, weekEndDate);
  return addDays(periodEnd, holdDays);
}
