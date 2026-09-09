import { Clock } from "lucide-react";
import type { TimesheetDayEntry } from "../types";
import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

interface TimesheetDailyHoursGridProps {
  entries: TimesheetDayEntry[];
  getDayName: (isoDate: string) => string;
  onHoursChange: (date: string, hours: number) => void;
  isSubcategory?: boolean;
  subcategoryPosition?: string | string[] | null;
}

export function TimesheetDailyHoursGrid({
  entries,
  getDayName,
  onHoursChange,
  isSubcategory,
  subcategoryPosition,
}: TimesheetDailyHoursGridProps) {
  const tf = useTimesheetFormTranslation();

  const isSubcat = Boolean(isSubcategory);
  const subcatLabel = Array.isArray(subcategoryPosition)
    ? subcategoryPosition.join(", ")
    : String(subcategoryPosition || "").trim();
  const isMiles = isSubcat && subcatLabel.toLowerCase().startsWith("miles");
  const title = isMiles
    ? "Daily Miles"
    : isSubcat
    ? `Daily Units (${subcatLabel || "Subcategory"})`
    : tf("dailyHours");

  return (
    <div className="timesheet-hours-section">
      <h4 className="timesheet-hours-title">
        <Clock size={16} />
        {title}
      </h4>
      <div className="timesheet-days-grid">
        {entries.map((entry) => (
          <div key={entry.date} className="timesheet-day-entry">
            <label className="timesheet-day-label">
              <div className="timesheet-day-name">{getDayName(entry.date)}</div>
              <div className="timesheet-day-date">({entry.date})</div>
            </label>
            <input
              type="number"
              min="0"
              value={entry.hours === 0 ? "" : entry.hours}
              onChange={(e) => {
                const rawValue = e.target.value;
                if (rawValue === "") {
                  onHoursChange(entry.date, 0);
                  return;
                }
                const [intPart, decPart] = rawValue.split(".");
                let limitedValue = rawValue;
                if (decPart && decPart.length > 2) {
                  limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                }
                onHoursChange(entry.date, parseFloat(limitedValue) || 0);
              }}
              placeholder="0.00"
              className="timesheet-hours-input"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
