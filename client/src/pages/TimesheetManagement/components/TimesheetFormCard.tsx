import type { JobSeekerProfile } from "../../../types/jobseeker";
import type { ClientData } from "../../../services/api/client";
import type { WeeklyTimesheet, ClientPosition } from "../types";
import type { ComputedTimesheetRow } from "../../../lib/hybridPayrollSplit";

import { TimesheetUnifiedHeader } from "./TimesheetUnifiedHeader";
import { TimesheetDailyHoursGrid } from "./TimesheetDailyHoursGrid";
import { TimesheetPayAdjustments } from "./TimesheetPayAdjustments";
import { TimesheetPositionPayInfo } from "./TimesheetPositionPayInfo";
import { TimesheetNotesSection } from "./TimesheetNotesSection";
import { TimesheetInvoiceSummary } from "./TimesheetInvoiceSummary";
import { TimesheetInvoiceTotals } from "./TimesheetInvoiceTotals";
import { TimesheetSubmitSection } from "./TimesheetSubmitSection";
import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

export interface TimesheetFormCardProps {
  timesheet: WeeklyTimesheet;
  weekStartIso: string;
  selectedClient: ClientData;
  selectedPosition: ClientPosition;
  selectedJobseeker: JobSeekerProfile;
  previewRows: ComputedTimesheetRow[];
  emailChecked: boolean;
  getDayName: (iso: string) => string;
  onHoursChange: (date: string, hours: number) => void;
  onBonusChange: (amount: number) => void;
  onDeductionChange: (amount: number) => void;
  onNotesChange: (notes: string) => void;
  onEmailChange: (checked: boolean) => void;
  onSubmit: (t: WeeklyTimesheet) => void;
  isGenerating: boolean;
}

export function TimesheetFormCard({
  timesheet,
  weekStartIso,
  selectedClient,
  selectedPosition,
  selectedJobseeker,
  previewRows,
  emailChecked,
  getDayName,
  onHoursChange,
  onBonusChange,
  onDeductionChange,
  onNotesChange,
  onEmailChange,
  onSubmit,
  isGenerating,
}: TimesheetFormCardProps) {
  const tf = useTimesheetFormTranslation();

  return (
    <div className="timesheet-assignment-card">
      <TimesheetUnifiedHeader
        selectedClient={selectedClient}
        selectedPosition={selectedPosition}
        selectedJobseeker={selectedJobseeker}
        timesheet={timesheet}
        weekStartIso={weekStartIso}
      />

      <div className="timesheet-hours-adjustments-container">
        <TimesheetDailyHoursGrid
          entries={timesheet.entries}
          getDayName={getDayName}
          onHoursChange={onHoursChange}
        />

        <TimesheetPayAdjustments
          bonusAmount={timesheet.bonusAmount}
          deductionAmount={timesheet.deductionAmount}
          onBonusChange={onBonusChange}
          onDeductionChange={onDeductionChange}
        />

        <TimesheetPositionPayInfo position={selectedPosition} />
      </div>

      <TimesheetNotesSection notes={timesheet.notes} onChange={onNotesChange} />

      <div className="timesheet-invoice-container">
        <div className="timesheet-invoice-table">
          <div className="timesheet-invoice-table-header">
            <div className="timesheet-col-description">{tf("description")}</div>
            <div className="timesheet-col-hours">{tf("colHours")}</div>
            <div className="timesheet-col-rate">{tf("rate")}</div>
            <div className="timesheet-col-amount">{tf("amount")}</div>
          </div>

          <TimesheetInvoiceSummary
            timesheet={timesheet}
            previewRows={previewRows}
            selectedPosition={selectedPosition}
            jobseeker={selectedJobseeker}
          />

          <div className="timesheet-invoice-totals">
            <TimesheetInvoiceTotals
              timesheet={timesheet}
              position={selectedPosition}
              jobseeker={selectedJobseeker}
            />
          </div>
        </div>

        <TimesheetSubmitSection
          timesheet={timesheet}
          emailChecked={emailChecked}
          onEmailChange={onEmailChange}
          onSubmit={onSubmit}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
}
