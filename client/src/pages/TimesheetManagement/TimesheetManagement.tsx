import { useMemo } from "react";
import { AppHeader } from "../../components/AppHeader";
import { useLanguage } from "../../contexts/language/language-provider";
import { useTimesheetSelection } from "./hooks/useTimesheetSelection";
import { useJobseekerWeekTimesheets } from "./hooks/useJobseekerWeekTimesheets";
import { useWeeklyTimesheetForm } from "./hooks/useWeeklyTimesheetForm";
import { useTimesheetSubmit } from "./hooks/useTimesheetSubmit";
import {
  getDayName,
  getPayrollPreviewRows,
  type PayrollComputationContext,
} from "./functions/timesheetCalculations";
import { TimesheetSelectionBar } from "./components/TimesheetSelectionBar";
import { TimesheetEmptyState } from "./components/TimesheetEmptyState";
import { TimesheetFormSkeleton } from "./components/TimesheetFormSkeleton";
import { TimesheetFormCard } from "./components/TimesheetFormCard";
import "../../styles/pages/TimesheetManagement.css";

export function TimesheetManagement() {
  const { t } = useLanguage();
  const selection = useTimesheetSelection();

  const {
    matchingTimesheets,
    loading: weekTimesheetsLoading,
    refetch,
  } = useJobseekerWeekTimesheets({
    jobseekerUserId: selection.selectedJobseeker?.userId,
    weekStartDate: selection.selectedWeekStart || null,
    positionId: selection.selectedPosition?.id ?? null,
    enabled: Boolean(
      selection.selectedJobseeker &&
        selection.selectedPosition &&
        selection.selectedWeekStart
    ),
  });

  const payrollCtx: PayrollComputationContext = useMemo(
    () => ({
      positions: selection.positions,
      selectedPositionId: selection.selectedPosition?.id,
      jobseeker: selection.selectedJobseeker,
    }),
    [
      selection.positions,
      selection.selectedPosition?.id,
      selection.selectedJobseeker,
    ]
  );

  const {
    timesheets,
    updateTimesheetEntry,
    updateTimesheetBonus,
    updateTimesheetDeduction,
    updateTimesheetNotes,
  } = useWeeklyTimesheetForm({
    selectedJobseeker: selection.selectedJobseeker,
    selectedPosition: selection.selectedPosition,
    selectedWeekStart: selection.selectedWeekStart,
    matchingTimesheets,
    weekTimesheetsLoading,
    payrollCtx,
  });

  const submit = useTimesheetSubmit();

  const showSkeleton =
    selection.selectedJobseeker &&
    selection.selectedClient &&
    selection.selectedPosition &&
    selection.selectedWeekStart &&
    weekTimesheetsLoading;

  const showForm =
    selection.selectedJobseeker &&
    selection.selectedClient &&
    selection.selectedPosition &&
    selection.selectedWeekStart &&
    !weekTimesheetsLoading;

  return (
    <div className="timesheet-page-container">
      <AppHeader
        title={t("timesheetForm.singlePageTitle")}
        hideHamburgerMenu={false}
        statusMessage={submit.generationMessage || submit.generationError}
        statusType={
          submit.generationError
            ? "error"
            : submit.generationMessage
              ? "success"
              : undefined
        }
      />

      <div className="timesheet-content-container">
        <TimesheetSelectionBar
          jobseekerLoading={selection.jobseekerLoading}
          clientLoading={selection.clientLoading}
          positionLoading={selection.positionLoading}
          jobseekerOptions={selection.jobseekerOptions}
          clientOptions={selection.clientOptions}
          positionOptions={selection.positionOptions}
          weekDropdownOptions={selection.weekDropdownOptions}
          selectedJobseekerOption={selection.selectedJobseekerOption}
          selectedClientOption={selection.selectedClientOption}
          selectedPositionOption={selection.selectedPositionOption}
          selectedWeekOption={selection.selectedWeekOption}
          selectedJobseeker={selection.selectedJobseeker}
          selectedClient={selection.selectedClient}
          onJobseekerSelect={selection.handleJobseekerSelect}
          onClientSelect={selection.handleClientSelect}
          onPositionSelect={selection.handlePositionSelect}
          onWeekSelect={selection.handleWeekSelect}
        />

        {selection.selectedJobseeker &&
          !selection.clientLoading &&
          selection.clients.length === 0 && (
            <TimesheetEmptyState variant="clients" />
          )}

        {selection.selectedClient &&
          !selection.positionLoading &&
          selection.positions.length === 0 && (
            <TimesheetEmptyState variant="positions" />
          )}

        {showForm && (
          <div className="timesheet-forms-container">
            <div className="timesheet-forms-grid">
              {timesheets.map((timesheet) => (
                <TimesheetFormCard
                  key={timesheet.positionId}
                  timesheet={timesheet}
                  weekStartIso={selection.selectedWeekStart}
                  selectedClient={selection.selectedClient!}
                  selectedPosition={selection.selectedPosition!}
                  selectedJobseeker={selection.selectedJobseeker!}
                  previewRows={getPayrollPreviewRows(timesheet, payrollCtx)}
                  emailChecked={
                    submit.emailPreferences[timesheet.positionId] ?? false
                  }
                  getDayName={getDayName}
                  onHoursChange={updateTimesheetEntry}
                  onBonusChange={updateTimesheetBonus}
                  onDeductionChange={updateTimesheetDeduction}
                  onNotesChange={updateTimesheetNotes}
                  onEmailChange={(checked) =>
                    submit.updateEmailPreference(
                      selection.selectedPosition?.id,
                      checked
                    )
                  }
                  onSubmit={(t) =>
                    void submit.generateSingleTimesheet({
                      timesheetsToProcess: [t],
                      jobseeker: selection.selectedJobseeker!,
                      position: selection.selectedPosition!,
                      weekStart: selection.selectedWeekStart,
                      emailPreferences: submit.emailPreferences,
                      refetchWeekTimesheets: refetch,
                    })
                  }
                  isGenerating={submit.isGeneratingTimesheet}
                />
              ))}
            </div>
          </div>
        )}

        {showSkeleton && <TimesheetFormSkeleton />}
      </div>
    </div>
  );
}
