/**
 * Centralized Date & Timezone Utilities for Godspeed Ops Portal
 *
 * Core Principles:
 * 1. Calendar Dates (YYYY-MM-DD without time, e.g. invoice_date, due_date, week_start_date, DOB, permit expiries):
 *    - MUST NEVER be parsed via `new Date("YYYY-MM-DD")` directly, which parses as UTC midnight and shifts
 *      backward by 1 full day for users in Canada (EDT/EST, UTC-4/UTC-5).
 *    - Must be parsed component-wise (year, month, day) and formatted as pure calendar dates.
 * 2. Timestamps (TIMESTAMPTZ, e.g. created_at, updated_at, email_sent_date):
 *    - Locked to Canada Eastern Time ("America/Toronto") across all users worldwide.
 */

export const CANADA_TIMEZONE = "America/Toronto";

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface CalendarDateParts {
  year: number;
  month: number; // 1-indexed (1 = Jan, 12 = Dec)
  day: number;
}

/**
 * Extracts year, month, and day components from a date string (YYYY-MM-DD or ISO timestamp)
 * without any timezone conversion.
 */
export function parseCalendarParts(dateStr: string | null | undefined): CalendarDateParts | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const cleanStr = dateStr.trim();
  if (!cleanStr || cleanStr === "N/A") return null;

  // Extract date part before 'T' or space
  const dateOnly = cleanStr.split(/[T\s]/)[0];
  const parts = dateOnly.split("-");
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month, day };
}

export type CalendarDateFormat = "short" | "long" | "iso" | "slash" | "default";

/**
 * Formats a calendar date string (YYYY-MM-DD) without timezone shifts.
 * 
 * Examples:
 * - formatCalendarDate("2026-08-28") -> "Aug 28, 2026" (default / short)
 * - formatCalendarDate("2026-08-28", "long") -> "August 28, 2026"
 * - formatCalendarDate("2026-08-28", "iso") -> "2026-08-28"
 * - formatCalendarDate("2026-08-28", "slash") -> "28/8/2026"
 */
export function formatCalendarDate(
  dateStr: string | null | undefined,
  format: CalendarDateFormat = "short",
  fallback: string = "N/A"
): string {
  const parts = parseCalendarParts(dateStr);
  if (!parts) return fallback;

  const { year, month, day } = parts;

  switch (format) {
    case "long":
      return `${FULL_MONTHS[month - 1]} ${day}, ${year}`;
    case "iso":
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    case "slash":
      return `${day}/${month}/${year}`;
    case "short":
    case "default":
    default:
      return `${SHORT_MONTHS[month - 1]} ${day}, ${year}`;
  }
}

/**
 * Returns short day of week ("Mon", "Tue", etc.) for a YYYY-MM-DD date string.
 * Anchor date at local noon to guarantee zero midnight-drift issues.
 */
export function getDayOfWeekCanada(dateStr: string | null | undefined): string {
  const parts = parseCalendarParts(dateStr);
  if (!parts) return "";
  const date = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
  return WEEKDAYS_SHORT[date.getDay()] || "";
}

/**
 * Formats a date range without timezone shifts (e.g. "Aug 24, 2026 – Aug 30, 2026"
 * or "Aug 24 – Aug 30, 2026").
 */
export function formatCalendarDateRange(
  startStr: string | null | undefined,
  endStr: string | null | undefined,
  fallback: string = "N/A"
): string {
  const startParts = parseCalendarParts(startStr);
  const endParts = parseCalendarParts(endStr);

  if (startParts && endParts) {
    const startFormatted = `${SHORT_MONTHS[startParts.month - 1]} ${startParts.day}`;
    const endFormatted = `${SHORT_MONTHS[endParts.month - 1]} ${endParts.day}`;

    if (startParts.year === endParts.year) {
      return `${startFormatted} – ${endFormatted}, ${startParts.year}`;
    }
    return `${startFormatted}, ${startParts.year} – ${endFormatted}, ${endParts.year}`;
  }

  if (startParts) {
    return `${SHORT_MONTHS[startParts.month - 1]} ${startParts.day}, ${startParts.year}`;
  }

  if (endParts) {
    return `${SHORT_MONTHS[endParts.month - 1]} ${endParts.day}, ${endParts.year}`;
  }

  return fallback;
}

/**
 * Formats an ISO timestamp or Date object in Canada Eastern Time (America/Toronto).
 * Used for created_at, updated_at, email_sent_date, last_sign_in, etc.
 */
export function formatDateTimeCanada(
  timestamp: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback: string = "N/A"
): string {
  if (!timestamp) return fallback;
  try {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    if (isNaN(date.getTime())) return fallback;

    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: CANADA_TIMEZONE,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      ...options,
    };

    return date.toLocaleString("en-CA", defaultOptions);
  } catch {
    return fallback;
  }
}

/**
 * Returns today's date formatted as YYYY-MM-DD in Canada Eastern Time (America/Toronto).
 */
export function getTodayInCanada(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CANADA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA formats as YYYY-MM-DD
  return formatter.format(now);
}

/**
 * Adds (or subtracts) days to a YYYY-MM-DD string safely without UTC shifts.
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const parts = parseCalendarParts(dateStr);
  if (!parts) return dateStr;
  const d = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a Date object anchored at local noon,
 * preventing any midnight timezone edge cases.
 */
export function parseCalendarDate(dateStr: string): Date | null {
  const parts = parseCalendarParts(dateStr);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
}
