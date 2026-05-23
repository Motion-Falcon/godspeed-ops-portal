import type { JobSeekerProfile } from "../../../types/jobseeker";
import type { ClientData } from "../../../services/api/client";
import type { ClientPosition, WeeklyTimesheet } from "../types";
import { formatDate, getWeekEndDate } from "../functions/weekUtils";
import { TimesheetJobseekerInfoPanel } from "./TimesheetJobseekerInfoPanel";
import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

interface TimesheetUnifiedHeaderProps {
  selectedClient: ClientData;
  selectedPosition: ClientPosition;
  selectedJobseeker: JobSeekerProfile;
  timesheet: WeeklyTimesheet;
  weekStartIso: string;
}

export function TimesheetUnifiedHeader({
  selectedClient,
  selectedPosition,
  selectedJobseeker,
  timesheet,
  weekStartIso,
}: TimesheetUnifiedHeaderProps) {
  const tf = useTimesheetFormTranslation();
  const weekEndIso = getWeekEndDate(weekStartIso);

  return (
    <div className="timesheet-unified-header">
      <div className="timesheet-header-sections timesheet-header-sections--form">
        <div className="timesheet-section timesheet-employee-section">
          <TimesheetJobseekerInfoPanel jobseeker={selectedJobseeker} />
        </div>

        <div className="timesheet-section timesheet-client-section">
          <h4 className="timesheet-section-title">{tf("clientAndPosition")}</h4>
          <div className="timesheet-section-content">
            <div className="timesheet-detail-item">
              <span className="timesheet-detail-label">{tf("clientName")}:</span>
              <span className="timesheet-detail-value">
                {selectedClient.companyName}
              </span>
            </div>
            <div className="timesheet-detail-item">
              <span className="timesheet-detail-label">{tf("positionTitle")}:</span>
              <span className="timesheet-detail-value">
                {selectedPosition.title}
              </span>
            </div>
            <div className="timesheet-detail-item">
              <span className="timesheet-detail-label">{tf("positionCode")}:</span>
              <span className="timesheet-detail-value">
                {selectedPosition.positionCode}
              </span>
            </div>
            <div className="timesheet-detail-item">
              <span className="timesheet-detail-label">{tf("positionNumber")}:</span>
              <span className="timesheet-detail-value">
                {selectedPosition.positionNumber}
              </span>
            </div>
          </div>
        </div>

        <div className="timesheet-section timesheet-invoice-section">
          <h4 className="timesheet-section-title">{tf("invoiceAndPeriod")}</h4>
          <div className="timesheet-section-content">
            <div className="timesheet-detail-item">
              <span className="timesheet-detail-label">{tf("invoiceNumber")}:</span>
              <span className="timesheet-detail-value">
                #{timesheet.invoiceNumber || tf("tbd")}
              </span>
            </div>
            <div className="timesheet-detail-item">
              <span className="timesheet-detail-label">{tf("period")}:</span>
              <span className="timesheet-detail-value">
                {formatDate(weekStartIso)} - {formatDate(weekEndIso)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
