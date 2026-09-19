/**
 * Centralized Date & Timezone Utilities for Server (Godspeed Ops Portal)
 *
 * Locked to Canada Eastern Time ("America/Toronto").
 */

export const CANADA_TIMEZONE = "America/Toronto";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Extracts month short name (e.g. "May") from a "YYYY-MM" or "YYYY-MM-DD" string
 * without any timezone conversion.
 */
export function formatMonthName(yearMonthStr: string | null | undefined): string {
  if (!yearMonthStr || typeof yearMonthStr !== "string") return "";
  const parts = yearMonthStr.split("-");
  if (parts.length < 2) return "";
  const monthIdx = parseInt(parts[1], 10) - 1;
  if (monthIdx >= 0 && monthIdx < 12) {
    return MONTH_NAMES[monthIdx];
  }
  return "";
}

/**
 * Formats a calendar date string (YYYY-MM-DD) safely into "MMM D, YYYY" (e.g. "Aug 28, 2026").
 */
export function formatCalendarDate(dateStr: string | null | undefined, fallback: string = "N/A"): string {
  if (!dateStr || typeof dateStr !== "string") return fallback;
  const cleanStr = dateStr.split(/[T\s]/)[0];
  const parts = cleanStr.split("-");
  if (parts.length !== 3) return fallback;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return fallback;
  }

  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

/**
 * Formats a timestamp (created_at, updated_at, generated_date) in Canada Eastern Time.
 */
export function formatCanadaDate(
  timestamp?: Date | string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = timestamp ? (typeof timestamp === "string" ? new Date(timestamp) : timestamp) : new Date();
  if (isNaN(date.getTime())) return "";

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: CANADA_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  };

  return date.toLocaleDateString("en-CA", defaultOptions);
}

/**
 * Adds (or subtracts) days to a YYYY-MM-DD string safely without UTC shifts.
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Safe Sunday-based week end (start + 6 days) using UTC arithmetic to avoid timezone shifts.
 */
export function getWeekEndDateSafe(weekStartDate: string): string {
  return addDaysToDateStr(weekStartDate, 6);
}

export const getWeekEndDate = getWeekEndDateSafe;

/**
 * Today's date in Canada Eastern Time (YYYY-MM-DD).
 */
export function getTodayInCanada(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CANADA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
