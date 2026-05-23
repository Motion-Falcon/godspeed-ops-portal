// Utility to generate week options (start and end dates) for the past 52 weeks

export interface WeekOption {
  value: string; // week start date (YYYY-MM-DD)
  label: string; // formatted range
}

/**
 * Generates week options for the past 52 weeks, each with a start (Sunday) and end (Saturday) date.
 */
export function generateWeekOptions(): WeekOption[] {
  const options: WeekOption[] = [];
  const today = new Date();

  for (let i = 0; i < 52; i++) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - i * 7);
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
 */
export function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Sunday-based week end (start + 6 days), formatted YYYY-MM-DD. */
export function getWeekEndDate(weekStartDate: string): string {
  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return weekEnd.toISOString().split("T")[0];
}

/** Seven consecutive dates starting at weekStartDate (YYYY-MM-DD each). */
export function generateWeekDates(weekStartDate: string): string[] {
  const dates: string[] = [];
  const startDate = new Date(weekStartDate);

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date.toISOString().split("T")[0]);
  }

  return dates;
}
