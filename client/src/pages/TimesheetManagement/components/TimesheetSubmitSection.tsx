import { Loader2, Plus, RefreshCw } from "lucide-react";
import type { WeeklyTimesheet } from "../types";
import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

interface TimesheetSubmitSectionProps {
  timesheet: WeeklyTimesheet;
  emailChecked: boolean;
  onEmailChange: (checked: boolean) => void;
  onSubmit: (sheet: WeeklyTimesheet) => void;
  isGenerating: boolean;
}

function hasExistingIds(timesheet: WeeklyTimesheet): boolean {
  return Boolean(
    timesheet.existingTimesheetId ||
      (timesheet.splitExistingIds &&
        Object.keys(timesheet.splitExistingIds).length > 0)
  );
}

export function TimesheetSubmitSection({
  timesheet,
  emailChecked,
  onEmailChange,
  onSubmit,
  isGenerating,
}: TimesheetSubmitSectionProps) {
  const tf = useTimesheetFormTranslation();
  const totalH =
    timesheet.totalRegularHours + timesheet.totalOvertimeHours;
  const insufficient = totalH < 1;

  return (
    <div className="timesheet-action-section">
      <div className="timesheet-email-option">
        <label className="timesheet-checkbox-label">
          <input
            type="checkbox"
            checked={emailChecked}
            onChange={(e) => onEmailChange(e.target.checked)}
            className="timesheet-checkbox"
          />
          <span className="timesheet-checkbox-text">{tf("submit.sendEmail")}</span>
        </label>
        <p
          className="field-note"
          style={{ marginTop: "8px", marginLeft: "24px" }}
        >
          {tf("submit.billingEmailNote")}
        </p>
      </div>

      <button
        className={`button ${insufficient ? "disabled" : ""}`}
        onClick={() => onSubmit(timesheet)}
        disabled={insufficient || isGenerating}
        title={insufficient ? tf("submit.minHoursTitle") : ""}
      >
        {isGenerating ? (
          <>
            <Loader2 size={16} className="timesheet-loading-spinner" />
            {hasExistingIds(timesheet)
              ? tf("submit.updating")
              : tf("submit.generating")}
          </>
        ) : hasExistingIds(timesheet) ? (
          <>
            <RefreshCw size={16} />
            {tf("submit.updateTimesheet")}
          </>
        ) : (
          <>
            <Plus size={16} />
            {tf("submit.generateTimesheet")}
          </>
        )}
      </button>
    </div>
  );
}
