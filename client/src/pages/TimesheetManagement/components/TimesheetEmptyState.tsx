import { Building, FileText } from "lucide-react";
import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

export type TimesheetEmptyVariant = "clients" | "positions";

interface TimesheetEmptyStateProps {
  variant: TimesheetEmptyVariant;
}

export function TimesheetEmptyState({ variant }: TimesheetEmptyStateProps) {
  const tf = useTimesheetFormTranslation();

  if (variant === "clients") {
    return (
      <div className="timesheet-card empty-state-card">
        <div className="timesheet-empty-state">
          <Building size={48} />
          <h3>{tf("empty.noClientsTitle")}</h3>
          <p>{tf("empty.noClientsBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="timesheet-card empty-state-card">
      <div className="timesheet-empty-state">
        <FileText size={48} />
        <h3>{tf("empty.noPositionsTitle")}</h3>
        <p>{tf("empty.noPositionsBody")}</p>
      </div>
    </div>
  );
}
