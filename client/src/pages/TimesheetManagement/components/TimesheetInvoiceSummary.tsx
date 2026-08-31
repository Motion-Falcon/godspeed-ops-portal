import type { JobSeekerProfile } from "../../../types/jobseeker";
import {
  isHybridPaymentMethod,
  type ComputedTimesheetRow,
} from "../../../lib/hybridPayrollSplit";
import type { ClientPosition, PositionWithOvertime, WeeklyTimesheet } from "../types";
import { resolvePositionRates } from "../functions/timesheetCalculations";
import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

interface TimesheetInvoiceSummaryProps {
  timesheet: WeeklyTimesheet;
  previewRows: ComputedTimesheetRow[];
  selectedPosition: ClientPosition;
  jobseeker: JobSeekerProfile | null;
  /** Optional row key prefix when multiple cards on one page (e.g. bulk). */
  rowKeyPrefix?: string;
}

export function TimesheetInvoiceSummary({
  timesheet,
  previewRows,
  selectedPosition,
  jobseeker,
  rowKeyPrefix = "",
}: TimesheetInvoiceSummaryProps) {
  const tf = useTimesheetFormTranslation();
  const { premiumPayRate, effectivePayRate, overtimePayRate } =
    resolvePositionRates(selectedPosition);

  const hybridPreview =
    isHybridPaymentMethod(jobseeker?.paymentMethod) && previewRows.length > 0;

  const positionOt = selectedPosition as PositionWithOvertime;

  return (
    <div className="timesheet-invoice-table-body">
      {(() => {
        if (hybridPreview) {
          return (
            <>
              {previewRows.map((payrollRow) => {
                const regH = payrollRow.totalRegularHours;
                const otH = payrollRow.totalOvertimeHours;
                const segmentBase =
                  regH * effectivePayRate + otH * overtimePayRate;
                const rateLabel =
                  otH > 0 && regH > 0
                    ? "—"
                    : otH > 0
                      ? `$${overtimePayRate.toFixed(2)}`
                      : `$${effectivePayRate.toFixed(2)}`;
                const payLineLabel =
                  payrollRow.linePaymentMethod || tf("payroll");
                const title =
                  payrollRow.paySplitSegment === "sin"
                    ? tf("totalRegularHours")
                    : regH > 0 && otH > 0
                      ? tf("hybridRegularAndOvertime")
                      : otH > 0
                        ? tf("overtimeHours")
                        : tf("totalRegularHours");
                return (
                  <div
                    key={`${rowKeyPrefix}${payrollRow.paySplitSegment}-${payLineLabel}`}
                    className="timesheet-invoice-line-item"
                  >
                    <div className="timesheet-col-description">
                      <div className="timesheet-item-title">{title}</div>
                      <div className="timesheet-item-subtitle">
                        {payLineLabel}
                        {payrollRow.paySplitSegment === "sin" &&
                          premiumPayRate > 0 &&
                          tf("inclPremium", {
                            rate: selectedPosition.premiumPayRate || "0",
                          })}
                        {otH > 0 &&
                          regH > 0 &&
                          tf("hoursRegOt", {
                            reg: regH.toFixed(2),
                            ot: otH.toFixed(2),
                          })}
                      </div>
                    </div>
                    <div className="timesheet-col-hours">
                      {(regH + otH).toFixed(2)}
                    </div>
                    <div className="timesheet-col-rate">{rateLabel}</div>
                    <div className="timesheet-col-amount">
                      ${segmentBase.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </>
          );
        }

        return (
          <>
            <div className="timesheet-invoice-line-item">
              <div className="timesheet-col-description">
                <div className="timesheet-item-title">
                  {tf("totalRegularHours")}
                </div>
                <div className="timesheet-item-subtitle">
                  {tf("standardWorkHours")}
                  {premiumPayRate > 0 &&
                    tf("inclPremium", {
                      rate: selectedPosition.premiumPayRate || "0",
                    })}
                </div>
              </div>
              <div className="timesheet-col-hours">
                {timesheet.totalRegularHours.toFixed(2)}
              </div>
              <div className="timesheet-col-rate">
                ${effectivePayRate.toFixed(2)}
              </div>
              <div className="timesheet-col-amount">
                $
                {(timesheet.totalRegularHours * effectivePayRate).toFixed(2)}
              </div>
            </div>

            {timesheet.totalOvertimeHours > 0 && (
              <div className="timesheet-invoice-line-item">
                <div className="timesheet-col-description">
                  <div className="timesheet-item-title">
                    {tf("overtimeHours")}
                  </div>
                  <div className="timesheet-item-subtitle">
                    {tf("exceedingHours")}{" "}
                    {positionOt.overtimeHours || "40"}{" "}
                    {tf("hoursPerWeek")}
                  </div>
                </div>
                <div className="timesheet-col-hours">
                  {timesheet.totalOvertimeHours.toFixed(2)}
                </div>
                <div className="timesheet-col-rate">
                  $
                  {positionOt.overtimePayRate ||
                    selectedPosition.regularPayRate ||
                    "0.00"}
                </div>
                <div className="timesheet-col-amount">
                  $
                  {(
                    timesheet.totalOvertimeHours *
                    parseFloat(
                      positionOt.overtimePayRate ||
                        selectedPosition.regularPayRate ||
                        "0"
                    )
                  ).toFixed(2)}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {Number(timesheet.bonusAmount) > 0 && (
        <div className="timesheet-invoice-line-item">
          <div className="timesheet-col-description">
            <div className="timesheet-item-title">{tf("bonus")}</div>
          </div>
          <div className="timesheet-col-hours">-</div>
          <div className="timesheet-col-rate">-</div>
          <div className="timesheet-col-amount">
            +${Number(timesheet.bonusAmount).toFixed(2)}
          </div>
        </div>
      )}

      {Number(timesheet.deductionAmount) > 0 && (
        <div className="timesheet-invoice-line-item">
          <div className="timesheet-col-description">
            <div className="timesheet-item-title">{tf("deduction")}</div>
          </div>
          <div className="timesheet-col-hours">-</div>
          <div className="timesheet-col-rate">-</div>
          <div className="timesheet-col-amount">
            -${Number(timesheet.deductionAmount).toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}
