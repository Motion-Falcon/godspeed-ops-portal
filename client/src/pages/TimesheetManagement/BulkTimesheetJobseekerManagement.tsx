import { useCallback, useEffect, useMemo, useState } from "react";

import { Building, Calendar, FileText, Plus, User } from "lucide-react";

import { AppHeader } from "../../components/AppHeader";

import { Loader } from "../../components/Loader";

import {
  CustomDropdown,
  type DropdownOption,
} from "../../components/CustomDropdown";

import { useLanguage } from "../../contexts/language/language-provider";

import type { ClientData } from "../../services/api/client";

import type { JobSeekerProfile } from "../../types/jobseeker";

import { getPositionDisplayTitle } from "../../utils/positionDisplay";

import "../../styles/pages/BulkTimesheetManagement.css";

import "../../styles/pages/TimesheetManagement.css";

import { useBulkJobseekerTimesheetSelection } from "./hooks/useBulkJobseekerTimesheetSelection";

import { useBulkJobseekerPositionForms } from "./hooks/useBulkJobseekerPositionForms";

import { useJobseekerWeekTimesheets } from "./hooks/useJobseekerWeekTimesheets";

import { useBulkTimesheetSubmit } from "./hooks/useBulkTimesheetSubmit";

import { useTimesheetFormTranslation } from "./hooks/useTimesheetFormTranslation";

import { TimesheetJobseekerInfoPanel } from "./components/TimesheetJobseekerInfoPanel";

import { DropdownSkeleton } from "./components/DropdownSkeleton";

import { BulkJobseekerPositionCard } from "./components/BulkJobseekerPositionCard";
import type { ClientPosition } from "./types";

export function BulkTimesheetJobseekerManagement() {
  const { t } = useLanguage();

  const tf = useTimesheetFormTranslation();

  const selection = useBulkJobseekerTimesheetSelection();

  const {
    selectedJobseeker,

    setSelectedJobseeker,

    jobseekerLoading,

    selectedClient,

    setSelectedClient,

    clientLoading,

    assignablePositions,

    positionLoading,

    selectedWeekStart,

    setSelectedWeekStart,

    jobseekerOptions,

    clientOptions,

    weekDropdownOptions,

    selectedJobseekerOption,

    selectedClientOption,

    selectedWeekOption,

    resetSelection,
  } = selection;

  const prefetchEnabled = Boolean(
    selectedJobseeker?.userId && selectedWeekStart && selectedClient,
  );

  const { weekTimesheets, loading: weekTsLoading } = useJobseekerWeekTimesheets(
    {
      jobseekerUserId: prefetchEnabled ? selectedJobseeker!.userId : undefined,

      weekStartDate: prefetchEnabled ? selectedWeekStart : undefined,

      enabled: prefetchEnabled,
    },
  );

  const forms = useBulkJobseekerPositionForms({
    jobseeker: selectedJobseeker,

    selectedClientId: selectedClient?.id ?? null,

    selectedWeekStart,

    hoursLoading: weekTsLoading,

    weekTimesheetsForJobseeker: weekTimesheets,
    
    assignablePositions,

    positionLoading,
  });

  const {
    rows,

    setRowPosition,

    addRow,

    removeRow,

    updateRowEntry,

    updateRowBonus,

    updateRowDeduction,

    updateRowNotes,

    updateRowEmailSent,

    updateAllRowsEmailSent,

    clearRowsAndDraft,

    payrollCtxForRow,
  } = forms;

  const [sendEmail, setSendEmail] = useState(false);

  const {
    isGenerating,

    generationMessage,

    generationError,

    currentInvoiceNumber,

    generateBulkTimesheets,

    setGenerationError,
  } = useBulkTimesheetSubmit({
    t,

    translationNamespace: "bulkJobseekerTimesheetManagement",

    onSuccessReset: () => {
      resetSelection();

      clearRowsAndDraft();

      setSendEmail(false);
    },
  });

  useEffect(() => {
    const rowsWithForm = rows.filter((row) => row.form);

    if (rowsWithForm.length === 0) {
      return;
    }

    setSendEmail(rowsWithForm.every((row) => row.emailSent));
  }, [rows]);

  const unknownPositionFallback = useMemo(
    () => t("bulkTimesheetManagement.constants.unknownPosition"),

    [t],
  );

  const positionDropdownOptionsForRow = useCallback(
    (rowId: string): DropdownOption[] => {
      const row = rows.find((r) => r.rowId === rowId);

      const currentPid = row?.position?.id;

      const taken = new Set(
        rows

          .filter((r) => r.rowId !== rowId && r.position?.id)

          .map((r) => r.position!.id),
      );

      return assignablePositions

        .filter((p) => p.id && (!taken.has(p.id) || p.id === currentPid))

        .map((position) => {
          const rate = (
            Number.parseFloat(position.regularPayRate || "0") || 0
          ).toFixed(2);

          const subcatNote = position.isSubcategory
            ? ` • ${t("bulkJobseekerTimesheetManagement.dropdown.subcategoryBadge")}`
            : "";

          return {
            id: position.id || "",

            label: `${getPositionDisplayTitle(position, unknownPositionFallback)} — ${position.positionNumber ?? ""}`,

            sublabel: `${position.positionCode} • $${rate}/h${subcatNote}`,

            value: position,
          };
        });
    },

    [rows, assignablePositions, t, unknownPositionFallback],
  );

  const grandTotalRegularHours = rows.reduce(
    (sum, row) => sum + (row.form?.totalRegularHours ?? 0),

    0,
  );

  const grandTotalOvertimeHours = rows.reduce(
    (sum, row) => sum + (row.form?.totalOvertimeHours ?? 0),

    0,
  );

  const grandTotalPay = rows.reduce(
    (sum, row) => sum + (row.form?.jobseekerPay ?? 0),

    0,
  );

  const grandTotalBonus = rows.reduce(
    (sum, row) => sum + (row.form?.bonusAmount ?? 0),

    0,
  );

  const grandTotalDeduction = rows.reduce(
    (sum, row) => sum + (row.form?.deductionAmount ?? 0),

    0,
  );

  /** Block generate while weekly forms are building for any chosen position */
  const hasRowHydratingForm = rows.some((r) => !!r.formLoading);

  const hasSubmissionReady = rows.some(
    (row) =>
      row.position &&
      row.form &&
      row.form.totalRegularHours + row.form.totalOvertimeHours > 0,
  );

  const handleGenerate = () => {
    if (
      !selectedJobseeker ||
      !selectedClient ||
      !selectedWeekStart ||
      rows.length === 0
    ) {
      setGenerationError(
        t(
          "bulkJobseekerTimesheetManagement.messages.contextIncompleteForGenerate",
        ),
      );

      return;
    }

    const payloads = rows

      .filter(
        (row) =>
          row.position &&
          row.form &&
          row.form.totalRegularHours + row.form.totalOvertimeHours > 0,
      )

      .map((row) => ({
        form: row.form!,

        emailSent: row.emailSent,

        clientPosition: row.position!,

        jobseeker: selectedJobseeker,

        progressLabel: `${getPositionDisplayTitle(row.position!, unknownPositionFallback)} (${row.position!.positionCode ?? ""})`,
      }));

    if (payloads.length === 0) {
      setGenerationError(
        t("bulkJobseekerTimesheetManagement.messages.noRowsWithHours"),
      );

      return;
    }

    void generateBulkTimesheets(payloads, selectedWeekStart);
  };

  const workbenchReady =
    selectedJobseeker && selectedClient && selectedWeekStart && !weekTsLoading;

  return (
    <div className="bulk-timesheet-page-container bulk-jobseeker-bulk-page timesheet-page-container">
      {isGenerating ? (
        <Loader
          variant="fullscreen"
          size="lg"
          message={t("bulkJobseekerTimesheetManagement.messages.generating")}
        >
          <p className="app-loader-submessage">
            {generationMessage ||
              t("bulkJobseekerTimesheetManagement.messages.pleaseWait")}
          </p>

          <div className="app-loader-details">
            <p>
              {t(
                "bulkJobseekerTimesheetManagement.messages.processingMultiple",
              )}
            </p>

            <p>
              {t(
                "bulkJobseekerTimesheetManagement.messages.generatingInvoices",
              )}
            </p>

            {currentInvoiceNumber ? (
              <p className="app-loader-highlight">
                {t("bulkTimesheetManagement.messages.currentInvoice")}: #
                {currentInvoiceNumber}
              </p>
            ) : null}

            <p>{t("bulkTimesheetManagement.messages.doNotClose")}</p>
          </div>
        </Loader>
      ) : null}

      <AppHeader
        title={t("bulkJobseekerTimesheetManagement.title")}
        hideHamburgerMenu={false}
        statusMessage={
          generationError || (!isGenerating ? generationMessage : "")
        }
        statusType={
          generationError ? "error" : generationMessage ? "success" : undefined
        }
      />

      <div className="timesheet-content-container">
        <div className="timesheet-selection-bar bulk-jobseeker-selection-bar">
          <div className="selection-section">
            <label className="selection-label">
              <User size={16} />

              {tf("selection.jobSeeker")}
            </label>

            {jobseekerLoading ? (
              <DropdownSkeleton />
            ) : (
              <CustomDropdown
                options={jobseekerOptions}
                selectedOption={selectedJobseekerOption}
                onSelect={(option) => {
                  if (Array.isArray(option)) return;

                  setSelectedJobseeker(option.value as JobSeekerProfile);
                }}
                placeholder={tf("selection.searchJobseeker")}
                loading={false}
                icon={<User size={16} />}
                emptyMessage={tf("selection.noJobseekers")}
              />
            )}
          </div>

          <div className="selection-section">
            <label className="selection-label">
              <Building size={16} />

              {tf("selection.client")}
            </label>

            {clientLoading ? (
              <DropdownSkeleton />
            ) : (
              <CustomDropdown
                options={clientOptions}
                selectedOption={selectedClientOption}
                onSelect={(option) => {
                  if (Array.isArray(option)) return;

                  setSelectedClient(option.value as ClientData);
                }}
                placeholder={
                  selectedJobseeker
                    ? tf("selection.searchClient")
                    : tf("selection.selectJobseekerFirst")
                }
                disabled={!selectedJobseeker}
                loading={false}
                icon={<Building size={16} />}
                emptyMessage={
                  selectedJobseeker
                    ? tf("selection.noClients")
                    : tf("selection.selectJobseekerForClients")
                }
              />
            )}
          </div>

          <div className="selection-section">
            <label className="selection-label">
              <Calendar size={16} />

              {tf("selection.weekPeriod")}
            </label>

            <CustomDropdown
              options={weekDropdownOptions}
              selectedOption={selectedWeekOption}
              onSelect={(option) => {
                if (Array.isArray(option)) return;

                setSelectedWeekStart(option.value as string);
              }}
              placeholder={tf("selection.selectWeek")}
              loading={false}
              icon={<Calendar size={16} />}
              emptyMessage={tf("selection.noWeekOptions")}
              disabled={!(selectedJobseeker && selectedClient)}
              searchable={false}
            />
          </div>
        </div>

        {selectedJobseeker ? (
          <div className="bulk-jobseeker-profile-strip timesheet-assignment-card bulk-jobseeker-employee-details-card">
            <TimesheetJobseekerInfoPanel
              layout="row"
              jobseeker={selectedJobseeker}
            />

            {workbenchReady &&
            !(selectedClient && assignablePositions.length === 0) ? (
              <div className="bulk-jobseeker-add-row-footer">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => addRow()}
                >
                  <Plus size={16} />{" "}
                  {t("bulkJobseekerTimesheetManagement.buttons.addRow")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {prefetchEnabled && weekTsLoading ? (
          <div className="bulk-timesheet-forms-container">
            <Loader
              variant="inline"
              message={t(
                "bulkJobseekerTimesheetManagement.messages.loadingWeekData",
              )}
            />
          </div>
        ) : null}

        {selectedJobseeker &&
          selectedClient &&
          !positionLoading &&
          assignablePositions.length === 0 && (
            <div className="timesheet-card empty-state-card">
              <div className="timesheet-empty-state">
                <FileText size={48} />

                <h3>{tf("empty.noPositionsTitle")}</h3>

                <p>
                  {t(
                    "bulkJobseekerTimesheetManagement.empty.noAssignmentsForClient",
                  )}
                </p>
              </div>
            </div>
          )}

        {workbenchReady &&
        !(selectedClient && assignablePositions.length === 0) ? (
          <div className="bulk-timesheet-forms-container bulk-jobseeker-forms">
            {rows.map((row) => {
              const options = positionDropdownOptionsForRow(row.rowId);

              const selectedOpt = row.position?.id
                ? options.find((o) => o.id === row.position!.id)
                : undefined;

              const emptyOptions = options.length === 0;

              return (
                <BulkJobseekerPositionCard
                  key={row.rowId}
                  row={row}
                  positionOptions={options}
                  selectedPositionOption={selectedOpt ?? undefined}
                  onPositionSelect={(option) => {
                    if (Array.isArray(option)) return;

                    setRowPosition(row.rowId, option.value as ClientPosition);
                  }}
                  positionLoading={positionLoading}
                  payrollCtx={payrollCtxForRow(row)}
                  formLoading={!!row.formLoading}
                  tf={tf}
                  t={t}
                  labels={{
                    removePositionTooltip: t(
                      "bulkJobseekerTimesheetManagement.buttons.removePosition",
                    ),

                    positionLabel: t(
                      "bulkTimesheetManagement.columns.position",
                    ),

                    selectPositionHint: emptyOptions
                      ? t(
                          "bulkJobseekerTimesheetManagement.placeholders.noPositionsLeft",
                        )
                      : t(
                          "bulkJobseekerTimesheetManagement.placeholders.selectPositionDraft",
                        ),

                    buildingForm: t(
                      "bulkJobseekerTimesheetManagement.messages.buildingDraft",
                    ),
                  }}
                  removeDisabled={rows.length <= 1}
                  onRemove={removeRow}
                  updateEntry={updateRowEntry}
                  updateBonus={updateRowBonus}
                  updateDeduction={updateRowDeduction}
                  updateNotes={updateRowNotes}
                  updateEmailSent={updateRowEmailSent}
                />
              );
            })}

            {rows.some((r) => r.form) ? (
              <div className="timesheet-invoice-container bulk-jobseeker-grand-summary">
                <div className="timesheet-invoice-table">
                  <div className="timesheet-invoice-table-header">
                    <div className="timesheet-col-description">
                      {t("timesheetForm.finalSummary")}
                    </div>

                    <div className="timesheet-col-hours">{tf("colHours")}</div>

                    <div className="timesheet-col-rate">
                      {t(
                        "bulkJobseekerTimesheetManagement.summary.variousRates",
                      )}
                    </div>

                    <div className="timesheet-col-amount">{tf("amount")}</div>
                  </div>

                  <div className="timesheet-invoice-table-body">
                    <div className="timesheet-invoice-line-item">
                      <div className="timesheet-col-description">
                        <div className="timesheet-item-title">
                          {t("timesheetForm.totalRegularHours")}
                        </div>
                      </div>

                      <div className="timesheet-col-hours">
                        {grandTotalRegularHours.toFixed(2)}
                      </div>

                      <div className="timesheet-col-rate">
                        {t("timesheetForm.na")}
                      </div>

                      <div className="timesheet-col-amount">
                        {t("timesheetForm.na")}
                      </div>
                    </div>

                    {grandTotalOvertimeHours > 0 ? (
                      <div className="timesheet-invoice-line-item">
                        <div className="timesheet-col-description">
                          <div className="timesheet-item-title">
                            {t("timesheetForm.totalOvertimeHours")}
                          </div>
                        </div>

                        <div className="timesheet-col-hours">
                          {grandTotalOvertimeHours.toFixed(2)}
                        </div>

                        <div className="timesheet-col-rate">
                          {t("timesheetForm.na")}
                        </div>

                        <div className="timesheet-col-amount">
                          {t("timesheetForm.na")}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="timesheet-invoice-totals">
                    <div className="timesheet-total-line">
                      <div className="timesheet-total-label">
                        {t("timesheetForm.grandTotalHours")}:
                      </div>

                      <div className="timesheet-total-value">
                        {(
                          grandTotalRegularHours + grandTotalOvertimeHours
                        ).toFixed(2)}
                      </div>
                    </div>

                    {grandTotalBonus > 0 ? (
                      <div className="timesheet-total-line">
                        <div className="timesheet-total-label">
                          {t("timesheetForm.grandTotalBonus")}:
                        </div>

                        <div className="timesheet-total-value">
                          +${grandTotalBonus.toFixed(2)}
                        </div>
                      </div>
                    ) : null}

                    {grandTotalDeduction > 0 ? (
                      <div className="timesheet-total-line">
                        <div className="timesheet-total-label">
                          {t("timesheetForm.grandTotalDeduction")}:
                        </div>

                        <div className="timesheet-total-value">
                          -${grandTotalDeduction.toFixed(2)}
                        </div>
                      </div>
                    ) : null}

                    <div className="timesheet-total-line timesheet-grand-total">
                      <div className="timesheet-total-label">
                        {t("timesheetForm.grandTotalPay")}:
                      </div>

                      <div className="timesheet-total-value">
                        ${grandTotalPay.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="timesheet-action-section">
              <div className="timesheet-email-option">
                <label className="timesheet-checkbox-label">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => {
                      setSendEmail(e.target.checked);

                      updateAllRowsEmailSent(e.target.checked);
                    }}
                    className="timesheet-checkbox"
                  />

                  <span className="timesheet-checkbox-text">
                    {t("bulkJobseekerTimesheetManagement.email.sendToAll")}
                  </span>
                </label>

                <p
                  className="field-note"
                  style={{ marginTop: "8px", marginLeft: "24px" }}
                >
                  {t("bulkTimesheetManagement.email.billingEmailNote")}
                </p>
              </div>

              <button
                type="button"
                className="button"
                onClick={handleGenerate}
                disabled={
                  rows.length === 0 ||
                  isGenerating ||
                  !!hasRowHydratingForm ||
                  !hasSubmissionReady
                }
              >
                {isGenerating
                  ? t("bulkJobseekerTimesheetManagement.buttons.generating")
                  : t("bulkJobseekerTimesheetManagement.buttons.generateBulk")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
