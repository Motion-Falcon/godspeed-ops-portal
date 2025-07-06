// Utility to generate week options (start and end dates) for the past 52 weeks

export interface WeekOption {
  value: string; // week start date (YYYY-MM-DD)
  label: string; // formatted range
}

/**
 * Generates week options for the past 52 weeks, each with a start (Sunday) and end (Saturday) date.
 * @returns {WeekOption[]} Array of week options
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
 * @param dateString
 * @returns {string}
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