import { useCallback } from "react";
import { useLanguage } from "../../../contexts/language/language-provider";

/** Shared timesheet create form copy (single + bulk). Keys are relative to `timesheetForm`. */
export function useTimesheetFormTranslation() {
  const { t } = useLanguage();

  return useCallback(
    (key: string, interpolations?: Record<string, string | number>) =>
      t(`timesheetForm.${key}`, interpolations),
    [t]
  );
}
