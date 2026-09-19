import type { PositionWithOvertime, ClientPosition } from "../types";
import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

interface TimesheetPositionPayInfoProps {
  position: ClientPosition | PositionWithOvertime;
}

export function TimesheetPositionPayInfo({
  position,
}: TimesheetPositionPayInfoProps) {
  const tf = useTimesheetFormTranslation();

  const isSubcat = Boolean((position as any)?.isSubcategory || (position as any)?.is_subcategory);
  const subcatLabel = String((position as any)?.subcategoryPosition || (position as any)?.subcategory_position || "").trim();
  const isMiles = isSubcat && subcatLabel.toLowerCase().startsWith("miles");
  const rateUnit = isMiles ? "/mi" : isSubcat ? "/unit" : "/h";

  return (
    <div className="timesheet-pay-info-section">
      <div className="timesheet-pay-info-grid">
        <div className="timesheet-pay-info-item">
          <span className="timesheet-pay-label">{tf("regularPayRate")}</span>
          <span className="timesheet-pay-value">
            ${position?.regularPayRate || tf("na")}{rateUnit}
          </span>
        </div>
        {parseFloat(position?.premiumPayRate || "0") > 0 && (
          <div className="timesheet-pay-info-item">
            <span className="timesheet-pay-label">{tf("premiumPayRate")}</span>
            <span className="timesheet-pay-value">
              ${position.premiumPayRate}{rateUnit}
            </span>
          </div>
        )}
        {position?.overtimeEnabled && (
          <div className="timesheet-pay-info-item">
            <span className="timesheet-pay-label">{tf("overtimePayRate")}</span>
            <span className="timesheet-pay-value">
              ${position?.overtimePayRate || tf("na")}/h
            </span>
          </div>
        )}
        <div className="timesheet-pay-info-item">
          <span className="timesheet-pay-label">{tf("overtimeThreshold")}</span>
          <span className="timesheet-pay-value">
            {(position as PositionWithOvertime)?.overtimeHours || "40"}{" "}
            {tf("hours")}
          </span>
        </div>
      </div>
    </div>
  );
}
