// Utility to generate week options (start and end dates) for the past 52 weeks
import {
  formatCalendarDate,
  addDaysToDateStr,
  getTodayInCanada,
  parseCalendarParts,
} from "../../../utils/dateUtils";

export interface WeekOption {
  value: string; // week start date (YYYY-MM-DD)
  label: string; // formatted range
}

/**
 * Generates week options for the past 52 weeks, each with a start (Sunday) and end (Saturday) date.
 */
export function generateWeekOptions(): WeekOption[] {
  const options: WeekOption[] = [];
  const todayStr = getTodayInCanada();
  const parts = parseCalendarParts(todayStr);
  const baseDate = parts
    ? new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0)
    : new Date();

  for (let i = 0; i < 52; i++) {
    const currentDate = new Date(baseDate);
    currentDate.setDate(baseDate.getDate() - i * 7);
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const startStr =
      weekStart.getFullYear() +
      "-" +
      String(weekStart.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(weekStart.getDate()).padStart(2, "0");
    const endStr =
      weekEnd.getFullYear() +
      "-" +
      String(weekEnd.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(weekEnd.getDate()).padStart(2, "0");

    options.push({
      value: startStr,
      label: `${formatDate(startStr)} - ${formatDate(endStr)}`,
    });
  }
  return options;
}

/**
 * Formats a date string (YYYY-MM-DD) to a readable format (e.g., 'Apr 7, 2024').
 * Uses centralized timezone-safe calendar date formatter.
 */
export function formatDate(dateString: string): string {
  return formatCalendarDate(dateString, "short");
}

/** Sunday-based week end (start + 6 days), formatted YYYY-MM-DD without timezone shifts. */
export function getWeekEndDate(weekStartDate: string): string {
  return addDaysToDateStr(weekStartDate, 6);
}

/** Seven consecutive dates starting at weekStartDate (YYYY-MM-DD each) without timezone shifts. */
export function generateWeekDates(weekStartDate: string): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(addDaysToDateStr(weekStartDate, i));
  }
  return dates;
}
