import { getJobseekerTimesheets } from "../../../services/api/timesheet";
import type {
  TimesheetDailyHours,
  TimesheetWithJoins,
} from "../../../services/types/timesheet";
import type {
  PaySplitSegmentKey,
  TimesheetDayEntry,
  WeekTimesheetRecord,
  WeeklyTimesheetSeed,
} from "../types";
import { generateWeekDates, getWeekEndDate } from "./weekUtils";

export type {
  PaySplitSegmentKey,
  TimesheetDayEntry,
  WeekTimesheetRecord,
  WeeklyTimesheetSeed,
} from "../types";

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Coerce wire `daily_hours` array from API (snake_case keys on each day). */
export function normalizeDailyHoursFromWire(
  raw: TimesheetDailyHours[] | null | undefined
): TimesheetDailyHours[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((day) => {
      if (!day || typeof day !== "object") return null;
      const date = typeof day.date === "string" ? day.date : "";
      if (!date) return null;
      return { date, hours: toNumber(day.hours, 0) };
    })
    .filter((day): day is TimesheetDailyHours => day !== null);
}

/**
 * Maps a {@link TimesheetWithJoins} row (snake_case API wire format) into
 * {@link WeekTimesheetRecord}. Does not convert to camelCase — that happens only
 * when building {@link WeeklyTimesheet} for the React form.
 */
export function parseTimesheetFromApi(
  timesheet: TimesheetWithJoins
): WeekTimesheetRecord {
  return {
    id: timesheet.id,
    invoice_number: timesheet.invoice_number ?? "",
    position_id: timesheet.position_id,
    week_start_date: timesheet.week_start_date,
    week_end_date: timesheet.week_end_date,
    total_regular_hours: toNumber(timesheet.total_regular_hours),
    total_overtime_hours: toNumber(timesheet.total_overtime_hours),
    total_jobseeker_pay: toNumber(timesheet.total_jobseeker_pay),
    total_client_bill: toNumber(timesheet.total_client_bill),
    bonus_amount: timesheet.bonus_amount,
    deduction_amount: timesheet.deduction_amount,
    notes: timesheet.notes,
    pay_split_segment: timesheet.pay_split_segment,
    line_payment_method: timesheet.line_payment_method,
    daily_hours: normalizeDailyHoursFromWire(timesheet.daily_hours),
  };
}

export function filterTimesheetsForWeekAndPosition(
  timesheets: WeekTimesheetRecord[],
  week_start_date: string,
  position_id: string
): WeekTimesheetRecord[] {
  return timesheets.filter(
    (timesheet) =>
      timesheet.week_start_date === week_start_date &&
      timesheet.position_id === position_id
  );
}

export function buildSplitExistingIds(
  matching: WeekTimesheetRecord[]
): Partial<Record<PaySplitSegmentKey, string>> {
  const splitExistingIds: Partial<Record<PaySplitSegmentKey, string>> = {};
  for (const row of matching) {
    const segment = (row.pay_split_segment || "single") as PaySplitSegmentKey;
    if (row.id) {
      splitExistingIds[segment] = row.id;
    }
  }
  return splitExistingIds;
}

export function mergeDailyHoursByDate(
  matching: WeekTimesheetRecord[]
): Record<string, number> {
  const byDate: Record<string, number> = {};
  for (const row of matching) {
    for (const day of row.daily_hours) {
      byDate[day.date] = (byDate[day.date] || 0) + day.hours;
    }
  }
  return byDate;
}

export function pickPrimaryTimesheet(
  matching: WeekTimesheetRecord[]
): WeekTimesheetRecord | undefined {
  if (matching.length === 0) return undefined;
  return (
    matching.find((row) => row.pay_split_segment === "sin") ||
    matching.find((row) => row.pay_split_segment === "single") ||
    matching[0]
  );
}

export function buildEntriesForWeek(
  week_start_date: string,
  matching: WeekTimesheetRecord[]
): TimesheetDayEntry[] {
  const weekDates = generateWeekDates(week_start_date);
  if (matching.length === 0) {
    return weekDates.map((date) => ({
      date,
      hours: 0,
      overtimeHours: 0,
    }));
  }

  const byDate = mergeDailyHoursByDate(matching);
  return weekDates.map((date) => ({
    date,
    hours: byDate[date] || 0,
    overtimeHours: 0,
  }));
}

export async function fetchJobseekerWeekTimesheets(
  jobseekerUserId: string,
  week_start_date: string
): Promise<WeekTimesheetRecord[]> {
  const response = await getJobseekerTimesheets(jobseekerUserId, {
    dateRangeStart: week_start_date,
    dateRangeEnd: getWeekEndDate(week_start_date),
    limit: 100,
  });

  return (response.timesheets ?? []).map(parseTimesheetFromApi);
}

/** Parallel week fetch for many jobseekers; failed users map to an empty array. */
export async function fetchWeekTimesheetsForJobseekers(
  userIds: string[],
  weekStart: string
): Promise<Map<string, WeekTimesheetRecord[]>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const entries = await Promise.all(
    uniqueIds.map(async (userId) => {
      try {
        const rows = await fetchJobseekerWeekTimesheets(userId, weekStart);
        return [userId, rows] as const;
      } catch (err) {
        console.error(
          `Error fetching week timesheets for jobseeker ${userId}:`,
          err
        );
        return [userId, [] as WeekTimesheetRecord[]] as const;
      }
    })
  );
  return new Map(entries);
}

export async function buildWeeklyTimesheetSeed(
  week_start_date: string,
  matching: WeekTimesheetRecord[],
  options?: {
    generateInvoiceNumber?: () => Promise<string>;
  }
): Promise<WeeklyTimesheetSeed> {
  const week_end_date = getWeekEndDate(week_start_date);
  const entries = buildEntriesForWeek(week_start_date, matching);
  const primary = pickPrimaryTimesheet(matching);
  const splitExistingIds = buildSplitExistingIds(matching);

  let invoice_number = primary?.invoice_number || "";
  if (matching.length === 0 && options?.generateInvoiceNumber) {
    try {
      invoice_number = await options.generateInvoiceNumber();
    } catch {
      invoice_number = "TBD";
    }
  }

  return {
    week_start_date,
    week_end_date,
    entries,
    invoice_number,
    bonus_amount: primary?.bonus_amount ?? 0,
    deduction_amount: primary?.deduction_amount ?? 0,
    notes: primary?.notes ?? "",
    existingTimesheetId: matching.length === 1 ? primary?.id : undefined,
    splitExistingIds: matching.length > 1 ? splitExistingIds : undefined,
    hasExisting: matching.length > 0,
  };
}
