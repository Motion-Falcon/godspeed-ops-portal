import type { TimesheetVersionHistoryEntry } from "../types/timesheet.types.js";

export function createVersionEntry(
  userId: string,
  version: number,
  action: "created" | "updated"
): TimesheetVersionHistoryEntry {
  return {
    version,
    created_by: userId,
    created_at: new Date().toISOString(),
    action,
  };
}

export function initializeVersionHistory(
  userId: string
): TimesheetVersionHistoryEntry[] {
  return [createVersionEntry(userId, 1, "created")];
}

export function addVersionToHistory(
  existingHistory: TimesheetVersionHistoryEntry[],
  userId: string,
  newVersion: number
): TimesheetVersionHistoryEntry[] {
  return [
    ...existingHistory,
    createVersionEntry(userId, newVersion, "updated"),
  ];
}
