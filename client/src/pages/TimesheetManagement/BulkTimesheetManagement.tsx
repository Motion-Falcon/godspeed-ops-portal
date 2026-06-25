import { useEffect, useState } from "react";
import { AppHeader } from "../../components/AppHeader";
import { Loader } from "../../components/Loader";
import {
  CustomDropdown,
  DropdownOption,
} from "../../components/CustomDropdown";
import { useLanguage } from "../../contexts/language/language-provider";
import type { ClientData } from "../../services/api/client";
import { Building, Info, Minus, Users } from "lucide-react";
import { mapAssignmentToJobseeker } from "./functions/mapAssignmentToJobseeker";
import "../../styles/pages/BulkTimesheetManagement.css";
import "../../styles/pages/TimesheetManagement.css";
import { getPositionDisplayTitle } from "../../utils/positionDisplay";
import { formatDate } from "./functions/weekUtils";
import { getPayrollPreviewRows } from "./functions/timesheetCalculations";
import { TimesheetInvoiceSummary } from "./components/TimesheetInvoiceSummary";
import { TimesheetInvoiceTotals } from "./components/TimesheetInvoiceTotals";
import { useTimesheetFormTranslation } from "./hooks/useTimesheetFormTranslation";
import { TimesheetJobseekerInfoPanel } from "./components/TimesheetJobseekerInfoPanel";
import { useBulkTimesheetSelection } from "./hooks/useBulkTimesheetSelection";
import { useBulkJobseekerWeekPrefetch } from "./hooks/useBulkJobseekerWeekPrefetch";
import { useBulkTimesheetForms } from "./hooks/useBulkTimesheetForms";
import { useBulkTimesheetSubmit } from "./hooks/useBulkTimesheetSubmit";
import type { PositionWithOvertime } from "./types";

export function BulkTimesheetManagement() {
  const { t } = useLanguage();
  const tf = useTimesheetFormTranslation();

  const selection = useBulkTimesheetSelection();
  const {
    clients,
    selectedClient,
    setSelectedClient,
    clientLoading,
    positions,
    selectedPosition,
    setSelectedPosition,
    positionLoading,
    clientPosition,
    weekOptions,
    selectedWeekStart,
    setSelectedWeekStart,
    assignedJobseekers,
    assignmentsLoading,
    resetSelection,
  } = selection;

  const prefetchEnabled = Boolean(
    selectedClient &&
      selectedPosition &&
      selectedWeekStart &&
      assignedJobseekers.length > 0
  );

  const { hoursLoading, getMatchingForAssignment } = useBulkJobseekerWeekPrefetch({
    assignments: assignedJobseekers,
    weekStartDate: selectedWeekStart,
    positionId: selectedPosition?.id,
    enabled: prefetchEnabled,
  });

  const {
    rows,
    updateEntry,
    updateBonus,
    updateDeduction,
    updateNotes,
    removeJobseeker,
    updateJobseekerEmailSent,
    updateAllJobseekersEmailSent,
    clearRows,
    payrollCtxForRow,
  } = useBulkTimesheetForms({
    assignments: assignedJobseekers,
    selectedWeekStart,
    clientPosition,
    hoursLoading,
    getMatchingForAssignment,
  });

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
    onSuccessReset: () => {
      resetSelection();
      clearRows();
      setSendEmail(false);
    },
  });

  useEffect(() => {
    if (rows.length > 0) {
      setSendEmail(rows.every((row) => row.emailSent));
    }
  }, [rows]);

  const clientOptions: DropdownOption[] = clients
    .filter((client) => !client.isInactive)
    .map((client) => ({
      id: client.id!,
      label:
        client.companyName ||
        t("bulkTimesheetManagement.constants.unknownClient"),
      sublabel: client.shortCode || "",
      value: client,
    }));


  const positionOptions: DropdownOption[] = positions.map((position) => ({
    id: position.id || "",
    label: `${getPositionDisplayTitle(position, t("bulkTimesheetManagement.constants.unknownPosition"))} - ${position.positionNumber || ""}`,
    sublabel: `Pay Rate: $${
      (Number.parseFloat(position.regularPayRate || "0") || 0).toFixed(2)
    } | ${position.positionNumber || ""} | ${position.positionCategory || ""} | ${position.city || ""}, ${position.province || ""}`,
    value: position,
  }));

  const weekDropdownOptions: DropdownOption[] = weekOptions.map((week) => ({
    id: week.value,
    label: week.label,
    value: week.value,
  }));

  const selectedClientOption = selectedClient
    ? clientOptions.find((opt) => opt.id === selectedClient.id)
    : null;

  const handleClientSelect = (option: DropdownOption | DropdownOption[]) => {
    if (Array.isArray(option)) return;
    setSelectedClient(option.value as ClientData);
  };

  const grandTotalRegularHours = rows.reduce(
    (sum, row) => sum + row.form.totalRegularHours,
    0
  );
  const grandTotalOvertimeHours = rows.reduce(
    (sum, row) => sum + row.form.totalOvertimeHours,
    0
  );
  const grandTotalPay = rows.reduce(
    (sum, row) => sum + row.form.jobseekerPay,
    0
  );
  const grandTotalBonus = rows.reduce(
    (sum, row) => sum + row.form.bonusAmount,
    0
  );
  const grandTotalDeduction = rows.reduce(
    (sum, row) => sum + row.form.deductionAmount,
    0
  );

  const handleGenerateBulk = () => {
    if (
      !selectedClient ||
      !clientPosition ||
      !selectedWeekStart ||
      rows.length === 0
    ) {
      setGenerationError(t("bulkTimesheetManagement.messages.cannotGenerate"));
      return;
    }
    const submitRows = rows
      .map((row) => {
        const jobseeker = mapAssignmentToJobseeker(row.assignment);
        const profile = row.assignment.jobseekerProfile;
        const progressLabel =
          `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
          "Unknown";
        if (!jobseeker) return null;
        return {
          form: row.form,
          emailSent: row.emailSent,
          clientPosition,
          jobseeker,
          progressLabel,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    void generateBulkTimesheets(submitRows, selectedWeekStart);
  };

  const showJobseekerForms =
    selectedClient &&
    selectedPosition &&
    selectedWeekStart &&
    assignedJobseekers.length > 0 &&
    !hoursLoading &&
    rows.length > 0;

  return (
    <div className="bulk-timesheet-page-container timesheet-page-container">
      {/* Full-screen loader overlay */}
      {isGenerating && (
        <Loader
          variant="fullscreen"
          size="lg"
          message={t("bulkTimesheetManagement.messages.generating")}
        >
          <p className="app-loader-submessage">
            {generationMessage ||
              t("bulkTimesheetManagement.messages.pleaseWait")}
          </p>
          <div className="app-loader-details">
            <p>{t("bulkTimesheetManagement.messages.processingMultiple")}</p>
            <p>{t("bulkTimesheetManagement.messages.generatingInvoices")}</p>
            {currentInvoiceNumber ? (
              <p className="app-loader-highlight">
                {t("bulkTimesheetManagement.messages.currentInvoice")}: #
                {currentInvoiceNumber}
              </p>
            ) : null}
            <p>{t("bulkTimesheetManagement.messages.doNotClose")}</p>
          </div>
        </Loader>
      )}

      <AppHeader
        title={t("bulkTimesheetManagement.title")}
        hideHamburgerMenu={false}
        statusMessage={
          generationError ||
          (!isGenerating ? generationMessage : "")
        }
        statusType={
          generationError ? "error" : generationMessage ? "success" : undefined
        }
      />
      <div className="timesheet-content-container">
        <p className="bulk-timesheet-selection-hint" role="note">
          <Info size={16} aria-hidden />
          {t("bulkTimesheetManagement.selectionHint")}
        </p>

        <div className="timesheet-selection-bar">
          <div className="selection-section">
            <label className="selection-label">
              <Building size={16} />
              {t("bulkTimesheetManagement.columns.client")}
            </label>
            {clientLoading ? (
              <div className="invoice-dropdown-skeleton">
                <div className="skeleton-dropdown-trigger">
                  <div className="skeleton-icon"></div>
                  <div className="skeleton-text skeleton-dropdown-text"></div>
                  <div className="skeleton-icon skeleton-chevron"></div>
                </div>
              </div>
            ) : (
              <CustomDropdown
                options={clientOptions}
                selectedOption={selectedClientOption}
                onSelect={handleClientSelect}
                placeholder={t(
                  "bulkTimesheetManagement.placeholders.selectClient"
                )}
                loading={false}
                icon={<Building size={16} />}
                emptyMessage={t(
                  "bulkTimesheetManagement.constants.noClientsFound"
                )}
              />
            )}
          </div>
          <div className="selection-section">
            <label className="selection-label">
              {t("bulkTimesheetManagement.columns.position")}
            </label>
            {positionLoading ? (
              <div className="invoice-dropdown-skeleton">
                <div className="skeleton-dropdown-trigger">
                  <div className="skeleton-icon"></div>
                  <div className="skeleton-text skeleton-dropdown-text"></div>
                  <div className="skeleton-icon skeleton-chevron"></div>
                </div>
              </div>
            ) : (
              <CustomDropdown
                options={positionOptions}
                selectedOption={
                  selectedPosition
                    ? positionOptions.find(
                        (opt) => opt.id === selectedPosition.id
                      )
                    : null
                }
                onSelect={(option) => {
                  if (Array.isArray(option)) return;
                  const selectedPosition = positions.filter(
                    (position) => position.id === option.id
                  );
                  setSelectedPosition(selectedPosition[0]);
                }}
                placeholder={
                  selectedClient
                    ? t("bulkTimesheetManagement.placeholders.selectPosition")
                    : t("bulkTimesheetManagement.placeholders.clientFirst")
                }
                disabled={!selectedClient}
                loading={false}
                icon={null}
                emptyMessage={
                  selectedClient
                    ? t("bulkTimesheetManagement.constants.noPositionsFound")
                    : t(
                        "bulkTimesheetManagement.placeholders.positionSelectHelp"
                      )
                }
              />
            )}
          </div>
          <div className="selection-section">
            <label className="selection-label">
              {t("bulkTimesheetManagement.columns.weekPeriod")}
            </label>
            <CustomDropdown
              options={weekDropdownOptions}
              selectedOption={
                selectedWeekStart
                  ? weekDropdownOptions.find(
                      (opt) => opt.value === selectedWeekStart
                    )
                  : null
              }
              onSelect={(option) => {
                if (Array.isArray(option)) return;
                setSelectedWeekStart(option.value as string);
              }}
              placeholder={t("bulkTimesheetManagement.placeholders.selectWeek")}
              loading={false}
              icon={null}
              emptyMessage={t("common.noData")}
              searchable={false}
            />
          </div>
        </div>

        {/* Move client info header below selection bar, as a separate section */}
        {selectedClient && (
          <div className="timesheet-unified-header">
            <div className="timesheet-header-sections">
              <div className="timesheet-section timesheet-client-section">
                <h4 className="timesheet-section-title">
                  {t("timesheetForm.clientAndPosition")}
                </h4>
                <div className="timesheet-section-content">
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("timesheetForm.clientName")}:
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedClient.companyName}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("timesheetForm.positionTitle")}:
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedPosition?.title ||
                        t("bulkTimesheetManagement.constants.na")}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("timesheetForm.positionCode")}:
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedPosition?.positionCode ||
                        t("bulkTimesheetManagement.constants.na")}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("timesheetForm.positionNumber")}:
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedPosition?.positionNumber ||
                        t("bulkTimesheetManagement.constants.na")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="timesheet-section timesheet-invoice-section">
                <h4 className="timesheet-section-title">
                  {t("timesheetForm.invoiceAndPeriod")}
                </h4>
                <div className="timesheet-section-content">
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("timesheetForm.invoiceNumbers")}:
                    </span>
                    <span className="timesheet-detail-value">
                      {t("timesheetForm.generatedIndividually")}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("timesheetForm.period")}:
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedWeekStart ? (
                        <>
                          {formatDate(selectedWeekStart)} -{" "}
                          {formatDate(
                            new Date(
                              new Date(selectedWeekStart).getTime() +
                                6 * 24 * 60 * 60 * 1000
                            )
                              .toISOString()
                              .split("T")[0]
                          )}
                        </>
                      ) : (
                        t("bulkTimesheetManagement.constants.na")
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subcategory position info banner */}
        {selectedPosition?.isSubcategory && (
          <div className="info-banner" style={{ margin: "16px 0", padding: "12px 16px", backgroundColor: "#ede9fe", border: "1px solid #c4b5fd", borderRadius: "8px", color: "#5b21b6", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 600 }}>ℹ</span>
            <span>{t("bulkTimesheetManagement.subcategoryBanner")}</span>
          </div>
        )}

        {selectedClient &&
          selectedPosition &&
          !positionLoading &&
          !assignmentsLoading &&
          assignedJobseekers.length === 0 && (
            <div className="timesheet-card empty-state-card">
              <div className="timesheet-empty-state">
                <Users size={48} />
                <h3>{t("bulkTimesheetManagement.empty.noJobseekersTitle")}</h3>
                <p>{t("bulkTimesheetManagement.empty.noJobseekersBody")}</p>
              </div>
            </div>
          )}

        {prefetchEnabled && hoursLoading && (
          <div className="bulk-timesheet-forms-container">
            <Loader
              variant="inline"
              message={t("bulkTimesheetManagement.messages.loadingForms")}
            />
          </div>
        )}

        {/* Timesheet input for each jobseeker */}
        {showJobseekerForms && (
            <div className="bulk-timesheet-forms-container">
              {rows.map((row) => (
                <div
                  className="timesheet-assignment-card"
                  key={row.assignment.id}
                >
                  {payrollCtxForRow(row.assignment).jobseeker && (
                    <TimesheetJobseekerInfoPanel
                      layout="row"
                      jobseeker={payrollCtxForRow(row.assignment).jobseeker!}
                      extras={{
                        billingEmail:
                          row.assignment.jobseekerProfile?.billing_email,
                        employeeId:
                          row.assignment.jobseekerProfile?.employee_id,
                      }}
                    />
                  )}
                  <div className="timesheet-hours-adjustments-container">
                    <div className="timesheet-hours-section">
                      <div className="timesheet-hours-header">
                        <h4 className="timesheet-hours-title">
                          {t("timesheetForm.dailyHours")}
                        </h4>
                        <button
                          className="button danger"
                          onClick={() => removeJobseeker(row.assignment.id)}
                          title={t(
                            "bulkTimesheetManagement.buttons.removeJobseeker"
                          )}
                          disabled={rows.length === 1}
                        >
                          <Minus size={16} />
                        </button>
                      </div>
                      <div className="timesheet-days-grid">
                        {row.form.entries.map((entry) => (
                          <div key={entry.date} className="timesheet-day-entry">
                            <label className="timesheet-day-label">
                              <div className="timesheet-day-name">
                                {new Date(entry.date).toLocaleDateString(
                                  "en-CA",
                                  { weekday: "short" }
                                )}
                              </div>
                              <div className="timesheet-day-date">
                                ({entry.date})
                              </div>
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              step="0.5"
                              value={entry.hours === 0 ? "" : entry.hours}
                              onChange={(e) => {
                                const rawValue = e.target.value;
                                // Allow clearing the input
                                if (rawValue === "") {
                                  updateEntry(row.assignment.id, entry.date, 0);
                                  return;
                                }
                                // Limit to 2 decimal places
                                const [intPart, decPart] = rawValue.split(".");
                                let limitedValue = rawValue;
                                if (decPart && decPart.length > 2) {
                                  limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                                }
                                const hours = parseFloat(limitedValue) || 0;
                                updateEntry(row.assignment.id, entry.date, hours);
                              }}
                              placeholder="0.00"
                              className="timesheet-hours-input"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="timesheet-hours-section adjustments-section">
                      <h4 className="timesheet-hours-title timesheet-pay-adjustments-title">
                        {t("timesheetForm.payAdjustments")}
                      </h4>
                      <div className="timesheet-days-grid">
                        <div className="timesheet-day-entry">
                          <label className="timesheet-day-label">
                            <div className="timesheet-day-name">
                              {t("timesheetForm.bonus")}
                            </div>
                            <div className="timesheet-day-date">
                              {t("timesheetForm.amount")}
                            </div>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.form.bonusAmount === 0 ? "" : row.form.bonusAmount}
                            onChange={(e) => {
                              const rawValue = e.target.value;
                              // Allow clearing the input
                              if (rawValue === "") {
                                updateBonus(row.assignment.id, 0);
                                return;
                              }
                              // Limit to 2 decimal places
                              const [intPart, decPart] = rawValue.split(".");
                              let limitedValue = rawValue;
                              if (decPart && decPart.length > 2) {
                                limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                              }
                              const amount = parseFloat(limitedValue) || 0;
                              updateBonus(row.assignment.id, amount);
                            }}
                            placeholder="0.00"
                            className="timesheet-hours-input"
                          />
                        </div>
                        <div className="timesheet-day-entry">
                          <label className="timesheet-day-label">
                            <div className="timesheet-day-name">
                              {t("timesheetForm.deduction")}
                            </div>
                            <div className="timesheet-day-date">
                              {t("timesheetForm.amount")}
                            </div>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              row.form.deductionAmount === 0 ? "" : row.form.deductionAmount
                            }
                            onChange={(e) => {
                              const rawValue = e.target.value;
                              // Allow clearing the input
                              if (rawValue === "") {
                                updateDeduction(row.assignment.id, 0);
                                return;
                              }
                              // Limit to 2 decimal places
                              const [intPart, decPart] = rawValue.split(".");
                              let limitedValue = rawValue;
                              if (decPart && decPart.length > 2) {
                                limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                              }
                              const amount = parseFloat(limitedValue) || 0;
                              updateDeduction(row.assignment.id, amount);
                            }}
                            placeholder="0.00"
                            className="timesheet-hours-input"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Position Pay Info */}
                    <div className="timesheet-pay-info-section">
                      <div className="timesheet-pay-info-grid">
                        <div className="timesheet-pay-info-item">
                          <span className="timesheet-pay-label">
                            {t("timesheetForm.regularPayRate")}
                          </span>
                          <span className="timesheet-pay-value">
                            $
                            {selectedPosition?.regularPayRate ||
                              t("bulkTimesheetManagement.constants.na")}
                            /h
                          </span>
                        </div>
                        {parseFloat((selectedPosition as PositionWithOvertime)?.premiumPayRate || "0") > 0 && (
                          <div className="timesheet-pay-info-item">
                            <span className="timesheet-pay-label">
                              {t("timesheetForm.premiumPayRate")}
                            </span>
                            <span className="timesheet-pay-value">
                              ${(selectedPosition as PositionWithOvertime)?.premiumPayRate}/h
                            </span>
                          </div>
                        )}
                        {selectedPosition?.overtimeEnabled && (
                          <div className="timesheet-pay-info-item">
                            <span className="timesheet-pay-label">
                              {t(
                                "timesheetForm.overtimePayRate"
                              )}
                            </span>
                            <span className="timesheet-pay-value">
                              $
                              {selectedPosition?.overtimePayRate ||
                                t("bulkTimesheetManagement.constants.na")}
                              /h
                            </span>
                          </div>
                        )}
                        <div className="timesheet-pay-info-item">
                          <span className="timesheet-pay-label">
                            {t(
                              "timesheetForm.overtimeThreshold"
                            )}
                          </span>
                          <span className="timesheet-pay-value">
                            {(selectedPosition as PositionWithOvertime)
                              ?.overtimeHours || "40"}{" "}
                            {t("timesheetForm.hours")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Notes Section */}
                  <div className="timesheet-notes-section">
                    <h4 className="timesheet-notes-title">
                      {t("timesheetForm.additionalNotes")}
                    </h4>
                    <textarea
                      value={row.form.notes}
                      onChange={(e) =>
                        updateNotes(row.assignment.id, e.target.value)
                      }
                      placeholder={t(
                        "timesheetForm.notesPlaceholder"
                      )}
                      className="timesheet-notes-textarea"
                      rows={4}
                    />
                  </div>
                  {/* Individual Email Control */}
                  <div className="timesheet-email-control">
                    <label className="timesheet-checkbox-label">
                      <input
                        type="checkbox"
                        checked={row.emailSent}
                        onChange={(e) =>
                          updateJobseekerEmailSent(
                            row.assignment.id,
                            e.target.checked
                          )
                        }
                        className="timesheet-checkbox"
                      />
                      <span className="timesheet-checkbox-text">
                        {t("bulkTimesheetManagement.email.sendToJobseeker")}
                      </span>
                    </label>
                    <p
                      className="field-note"
                      style={{ marginTop: "8px", marginLeft: "24px" }}
                    >
                      {t("bulkTimesheetManagement.email.billingEmailNote")}
                    </p>
                  </div>
                  {/* Invoice Style Summary - Exact same as TimesheetManagement */}
                  <div className="timesheet-invoice-container">
                    <div className="timesheet-invoice-table">
                      <div className="timesheet-invoice-table-header">
                        <div className="timesheet-col-description">
                          {tf("description")}
                        </div>
                        <div className="timesheet-col-hours">{tf("colHours")}</div>
                        <div className="timesheet-col-rate">{tf("rate")}</div>
                        <div className="timesheet-col-amount">{tf("amount")}</div>
                      </div>

                      <TimesheetInvoiceSummary
                        timesheet={row.form}
                        previewRows={getPayrollPreviewRows(
                          row.form,
                          payrollCtxForRow(row.assignment)
                        )}
                        selectedPosition={clientPosition!}
                        jobseeker={payrollCtxForRow(row.assignment).jobseeker}
                        rowKeyPrefix={`${row.assignment.id}-`}
                      />

                      <div className="timesheet-invoice-totals">
                        <TimesheetInvoiceTotals
                          timesheet={row.form}
                          position={clientPosition!}
                          jobseeker={payrollCtxForRow(row.assignment).jobseeker}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Separate Final Summary Table */}
              <div className="timesheet-invoice-container">
                <div className="timesheet-invoice-table">
                  <div className="timesheet-invoice-table-header">
                    <div className="timesheet-col-description">
                      {t("timesheetForm.finalSummary")}
                    </div>
                    <div className="timesheet-col-hours">Hours</div>
                    <div className="timesheet-col-rate">Rate</div>
                    <div className="timesheet-col-amount">Amount</div>
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
                        ${(parseFloat(selectedPosition?.regularPayRate || "0") + parseFloat((selectedPosition as PositionWithOvertime)?.premiumPayRate || "0")).toFixed(2)}
                      </div>
                      <div className="timesheet-col-amount">
                        $
                        {(
                          grandTotalRegularHours *
                          (parseFloat(selectedPosition?.regularPayRate || "0") + parseFloat((selectedPosition as PositionWithOvertime)?.premiumPayRate || "0"))
                        ).toFixed(2)}
                      </div>
                    </div>
                    {grandTotalOvertimeHours > 0 && (
                      <div className="timesheet-invoice-line-item">
                        <div className="timesheet-col-description">
                          <div className="timesheet-item-title">
                            {t(
                              "timesheetForm.totalOvertimeHours"
                            )}
                          </div>
                        </div>
                        <div className="timesheet-col-hours">
                          {grandTotalOvertimeHours.toFixed(2)}
                        </div>
                        <div className="timesheet-col-rate">
                          $
                          {(selectedPosition as PositionWithOvertime)
                            ?.overtimePayRate ||
                            selectedPosition?.regularPayRate ||
                            "0.00"}
                        </div>
                        <div className="timesheet-col-amount">
                          $
                          {(
                            grandTotalOvertimeHours *
                            parseFloat(
                              (selectedPosition as PositionWithOvertime)
                                ?.overtimePayRate ||
                                selectedPosition?.regularPayRate ||
                                "0"
                            )
                          ).toFixed(2)}
                        </div>
                      </div>
                    )}
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
                    {grandTotalBonus > 0 && (
                      <div className="timesheet-total-line">
                        <div className="timesheet-total-label">
                          {t("timesheetForm.grandTotalBonus")}:
                        </div>
                        <div className="timesheet-total-value">
                          +${grandTotalBonus.toFixed(2)}
                        </div>
                      </div>
                    )}
                    {grandTotalDeduction > 0 && (
                      <div className="timesheet-total-line">
                        <div className="timesheet-total-label">
                          {t(
                            "timesheetForm.grandTotalDeduction"
                          )}
                          :
                        </div>
                        <div className="timesheet-total-value">
                          -${grandTotalDeduction.toFixed(2)}
                        </div>
                      </div>
                    )}
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

              <div className="timesheet-action-section">
                <div className="timesheet-email-option">
                  <label className="timesheet-checkbox-label">
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => {
                        setSendEmail(e.target.checked);
                        updateAllJobseekersEmailSent(e.target.checked);
                      }}
                      className="timesheet-checkbox"
                    />
                    <span className="timesheet-checkbox-text">
                      {t("bulkTimesheetManagement.email.sendToAll")}
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
                  className="button"
                  onClick={handleGenerateBulk}
                  disabled={
                    rows.length === 0 ||
                    isGenerating ||
                    rows.every(
                      (row) =>
                        row.form.totalRegularHours + row.form.totalOvertimeHours ===
                        0
                    )
                  }
                >
                  {isGenerating
                    ? t("bulkTimesheetManagement.buttons.generating")
                    : t(
                        "bulkTimesheetManagement.buttons.generateBulkTimesheet"
                      )}
                </button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
