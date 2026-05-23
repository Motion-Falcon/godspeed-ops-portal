import { FileText, Minus } from "lucide-react";
import {
  CustomDropdown,
  type DropdownOption,
} from "../../../components/CustomDropdown";
import { Loader } from "../../../components/Loader";
import { DropdownSkeleton } from "./DropdownSkeleton";
import type { PayrollComputationContext } from "../functions/timesheetCalculations";
import { getPayrollPreviewRows } from "../functions/timesheetCalculations";
import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";
import { TimesheetInvoiceSummary } from "./TimesheetInvoiceSummary";
import { TimesheetInvoiceTotals } from "./TimesheetInvoiceTotals";
import type {
  BulkPositionRow,
  ClientPosition,
  PositionWithOvertime,
} from "../types";

export type TimesheetFormTf = ReturnType<typeof useTimesheetFormTranslation>;

interface BulkTimesheetT {
  (key: string, params?: Record<string, string | number>): string;
}

export interface BulkJobseekerPositionCardProps {
  row: BulkPositionRow;
  positionOptions: DropdownOption[];
  selectedPositionOption: DropdownOption | null | undefined;
  onPositionSelect: (option: DropdownOption | DropdownOption[]) => void;
  positionLoading: boolean;
  payrollCtx: PayrollComputationContext | null;
  formLoading: boolean;
  tf: TimesheetFormTf;
  t: BulkTimesheetT;
  labels: {
    removePositionTooltip: string;
    positionLabel: string;
    selectPositionHint: string;
    buildingForm: string;
  };
  onRemove: (rowId: string) => void;
  removeDisabled: boolean;
  updateEntry: (rowId: string, date: string, hours: number) => void;
  updateBonus: (rowId: string, amount: number) => void;
  updateDeduction: (rowId: string, amount: number) => void;
  updateNotes: (rowId: string, notes: string) => void;
  updateEmailSent: (rowId: string, sent: boolean) => void;
}

export function BulkJobseekerPositionCard({
  row,
  positionOptions,
  selectedPositionOption,
  onPositionSelect,
  positionLoading,
  payrollCtx,
  formLoading,
  tf,
  t,
  labels,
  onRemove,
  removeDisabled,
  updateEntry,
  updateBonus,
  updateDeduction,
  updateNotes,
  updateEmailSent,
}: BulkJobseekerPositionCardProps) {
  const position = row.position as PositionWithOvertime | null;
  const form = row.form;
  const previewRows =
    payrollCtx && form ? getPayrollPreviewRows(form, payrollCtx) : [];

  const showPayDetails = Boolean(form && position);

  const removeButton = (variant: "floating" | "pay-header") => (
    <button
      type="button"
      className={`button danger bulk-position-remove-btn bulk-position-remove-btn--${variant}`}
      onClick={() => onRemove(row.rowId)}
      title={labels.removePositionTooltip}
      disabled={removeDisabled}
      aria-label={labels.removePositionTooltip}
    >
      <Minus size={variant === "pay-header" ? 14 : 16} />
    </button>
  );

  return (
    <div className="timesheet-assignment-card bulk-jobseeker-position-card">
      {!showPayDetails ? removeButton("floating") : null}

      <div className="bulk-position-inline-row">
        <div className="bulk-position-field bulk-position-field--dropdown">
          <label className="selection-label">
            <FileText size={16} />
            {labels.positionLabel}
          </label>
          {positionLoading ? (
            <DropdownSkeleton />
          ) : (
            <CustomDropdown
              options={positionOptions}
              selectedOption={selectedPositionOption}
              onSelect={onPositionSelect}
              placeholder={labels.selectPositionHint}
              disabled={positionOptions.length === 0}
              loading={false}
              icon={<FileText size={16} />}
              emptyMessage={labels.selectPositionHint}
            />
          )}
        </div>

        {formLoading ? (
          <div className="bulk-position-field bulk-position-field--loading">
            <Loader variant="inline" message={labels.buildingForm} />
          </div>
        ) : null}

        {form && position ? (
          <div className="timesheet-hours-adjustments-container bulk-position-hours-block">
            <div className="timesheet-hours-section">
              <h4 className="timesheet-hours-title">
                {t("timesheetForm.dailyHours")}
              </h4>
              <div className="timesheet-days-grid">
                {form.entries.map((entry) => (
                  <div key={entry.date} className="timesheet-day-entry">
                    <label className="timesheet-day-label">
                      <div className="timesheet-day-name">
                        {new Date(entry.date).toLocaleDateString("en-CA", {
                          weekday: "short",
                        })}
                      </div>
                      <div className="timesheet-day-date">({entry.date})</div>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      step="0.5"
                      value={entry.hours === 0 ? "" : entry.hours}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        if (rawValue === "") {
                          updateEntry(row.rowId, entry.date, 0);
                          return;
                        }
                        const [intPart, decPart] = rawValue.split(".");
                        let limitedValue = rawValue;
                        if (decPart && decPart.length > 2) {
                          limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                        }
                        const hours = parseFloat(limitedValue) || 0;
                        updateEntry(row.rowId, entry.date, hours);
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
                    value={form.bonusAmount === 0 ? "" : form.bonusAmount}
                    onChange={(e) => {
                      const rawValue = e.target.value;
                      if (rawValue === "") {
                        updateBonus(row.rowId, 0);
                        return;
                      }
                      const [intPart, decPart] = rawValue.split(".");
                      let limitedValue = rawValue;
                      if (decPart && decPart.length > 2) {
                        limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                      }
                      const amount = parseFloat(limitedValue) || 0;
                      updateBonus(row.rowId, amount);
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
                      form.deductionAmount === 0 ? "" : form.deductionAmount
                    }
                    onChange={(e) => {
                      const rawValue = e.target.value;
                      if (rawValue === "") {
                        updateDeduction(row.rowId, 0);
                        return;
                      }
                      const [intPart, decPart] = rawValue.split(".");
                      let limitedValue = rawValue;
                      if (decPart && decPart.length > 2) {
                        limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                      }
                      const amount = parseFloat(limitedValue) || 0;
                      updateDeduction(row.rowId, amount);
                    }}
                    placeholder="0.00"
                    className="timesheet-hours-input"
                  />
                </div>
              </div>
            </div>

            <div className="timesheet-pay-info-section bulk-position-pay-info">
              <div className="bulk-position-pay-details-header">
                <h4 className="timesheet-hours-title bulk-position-pay-details-title">
                  {t("bulkJobseekerTimesheetManagement.labels.payDetails")}
                </h4>
                {removeButton("pay-header")}
              </div>
              <div className="timesheet-pay-info-grid">
                <div className="timesheet-pay-info-item">
                  <span className="timesheet-pay-label">
                    {t("timesheetForm.regularPayRate")}
                  </span>
                  <span className="timesheet-pay-value">
                    $
                    {position.regularPayRate ||
                      t("bulkTimesheetManagement.constants.na")}
                    /h
                  </span>
                </div>
                {parseFloat(position.premiumPayRate || "0") > 0 && (
                  <div className="timesheet-pay-info-item">
                    <span className="timesheet-pay-label">
                      {t("timesheetForm.premiumPayRate")}
                    </span>
                    <span className="timesheet-pay-value">
                      ${position.premiumPayRate}/h
                    </span>
                  </div>
                )}
                {position.overtimeEnabled && (
                  <div className="timesheet-pay-info-item">
                    <span className="timesheet-pay-label">
                      {t("timesheetForm.overtimePayRate")}
                    </span>
                    <span className="timesheet-pay-value">
                      $
                      {position.overtimePayRate ||
                        t("bulkTimesheetManagement.constants.na")}
                      /h
                    </span>
                  </div>
                )}
                <div className="timesheet-pay-info-item">
                  <span className="timesheet-pay-label">
                    {t("timesheetForm.overtimeThreshold")}
                  </span>
                  <span className="timesheet-pay-value">
                    {position.overtimeHours || "40"} {t("timesheetForm.hours")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {!row.position && !formLoading ? (
        <p className="field-note bulk-jobseeker-select-position-hint">
          {labels.selectPositionHint}
        </p>
      ) : null}

      {form && position ? (
        <>
          <div className="bulk-position-notes-email-shell">
            <div className="bulk-position-email-card">
              <label className="timesheet-checkbox-label">
                <input
                  type="checkbox"
                  checked={row.emailSent}
                  onChange={(e) => updateEmailSent(row.rowId, e.target.checked)}
                  className="timesheet-checkbox"
                />
                <span className="timesheet-checkbox-text">
                  {t("bulkTimesheetManagement.email.sendToJobseeker")}
                </span>
              </label>
              <p className="field-note bulk-position-email-billing-note">
                {t("bulkTimesheetManagement.email.billingEmailNote")}
              </p>
            </div>

            <div className="timesheet-notes-section bulk-position-notes bulk-position-notes-card">
              <h4 className="timesheet-notes-title">
                {t("timesheetForm.additionalNotes")}
              </h4>
              <textarea
                value={form.notes}
                onChange={(e) => updateNotes(row.rowId, e.target.value)}
                placeholder={t("timesheetForm.notesPlaceholder")}
                className="timesheet-notes-textarea"
                rows={2}
              />
            </div>
          </div>

          {payrollCtx ? (
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
                  timesheet={form}
                  previewRows={previewRows}
                  selectedPosition={position as ClientPosition}
                  jobseeker={payrollCtx.jobseeker ?? null}
                  rowKeyPrefix={`${row.rowId}-`}
                />

                <div className="timesheet-invoice-totals">
                  <TimesheetInvoiceTotals
                    timesheet={form}
                    position={position as ClientPosition}
                    jobseeker={payrollCtx.jobseeker}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
