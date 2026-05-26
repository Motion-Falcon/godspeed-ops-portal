/**
 * Timesheet week fully inside [rangeStart, rangeEnd] (inclusive).
 * Matches invoicing fetch and timesheet list filters.
 */
export function timesheetWeekWithinRange(
  weekStart: string,
  weekEnd: string,
  rangeStart: string,
  rangeEnd: string
): boolean {
  return weekStart >= rangeStart && weekEnd <= rangeEnd;
}
