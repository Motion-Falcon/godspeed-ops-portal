import type { TimesheetListItem } from "../../../services/api/timesheet";

export type TimesheetListT = (
  key: string,
  options?: Record<string, string | number>
) => string;

/** Display label for the client joined on list rows */
export function getTimesheetListClientDisplayName(
  timesheet: TimesheetListItem,
  t: TimesheetListT
): string {
  return String(
    timesheet.positions?.client_name ||
      t("bulkTimesheetManagement.constants.unknownClient")
  );
}

/** Display label for the position joined on list rows */
export function getTimesheetListPositionDisplayName(
  timesheet: TimesheetListItem,
  t: TimesheetListT
): string {
  return String(
    timesheet.positions?.title ||
      timesheet.positions?.position_code ||
      t("bulkTimesheetManagement.constants.unknownPosition")
  );
}
