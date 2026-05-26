/** Sunday-based week end (start + 6 days), formatted YYYY-MM-DD. */
export function getWeekEndDate(weekStartDate: string): string {
  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return weekEnd.toISOString().split("T")[0];
}
