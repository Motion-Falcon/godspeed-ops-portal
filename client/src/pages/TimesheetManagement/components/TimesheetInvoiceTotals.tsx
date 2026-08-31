import type { JobSeekerProfile } from "../../../types/jobseeker";
import { profileUsesCashDeductionField } from "../../../lib/hybridPayrollSplit";
import type {
  ClientPosition,
  PositionWithOvertime,
  WeeklyTimesheet,
} from "../types";
import { getBaseJobseekerPay } from "../functions/timesheetCalculations";
import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

interface TimesheetInvoiceTotalsProps {
  timesheet: WeeklyTimesheet;
  position: ClientPosition | PositionWithOvertime;
  jobseeker: JobSeekerProfile | null;
}

export function TimesheetInvoiceTotals({
  timesheet,
  position,
  jobseeker,
}: TimesheetInvoiceTotalsProps) {
  const tf = useTimesheetFormTranslation();
  const basePay = getBaseJobseekerPay(timesheet, position);
  const subtotal = basePay;
  const paymentMethod = jobseeker?.paymentMethod;
  const cashDeductionPct = parseFloat(jobseeker?.cashDeduction || "0");
  const employeePay = timesheet.jobseekerPay;
  const cashDeductionDisplay =
    profileUsesCashDeductionField(paymentMethod) && cashDeductionPct > 0
      ? Math.max(
          0,
          subtotal +
            (timesheet.bonusAmount || 0) -
            (timesheet.deductionAmount || 0) -
            employeePay
        )
      : 0;

  return (
    <>
      <div className="timesheet-total-line">
        <div className="timesheet-total-label">{tf("totalHours")}:</div>
        <div className="timesheet-total-value">
          {(timesheet.totalRegularHours + timesheet.totalOvertimeHours).toFixed(
            1
          )}
        </div>
      </div>
      <div className="timesheet-total-line timesheet-subtotal">
        <div className="timesheet-total-label">{tf("subtotal")}:</div>
        <div className="timesheet-total-value">${subtotal.toFixed(2)}</div>
      </div>
      {cashDeductionDisplay > 0 && (
        <div className="timesheet-total-line">
          <div className="timesheet-total-label">
            {tf("cashDeduction", { percent: cashDeductionPct })}
          </div>
          <div className="timesheet-total-value">
            -${cashDeductionDisplay.toFixed(2)}
          </div>
        </div>
      )}
      {timesheet.taxAmount !== undefined && timesheet.taxAmount > 0 && (
        <div className="timesheet-total-line">
          <div className="timesheet-total-label">{tf("taxAmount", { defaultValue: "Tax (HST/GST)" })}:</div>
          <div className="timesheet-total-value">
            +${timesheet.taxAmount.toFixed(2)}
          </div>
        </div>
      )}
      {Number(timesheet.bonusAmount) > 0 && (
        <div className="timesheet-total-line">
          <div className="timesheet-total-label">{tf("bonus")}:</div>
          <div className="timesheet-total-value">
            +${Number(timesheet.bonusAmount).toFixed(2)}
          </div>
        </div>
      )}
      {Number(timesheet.deductionAmount) > 0 && (
        <div className="timesheet-total-line">
          <div className="timesheet-total-label">{tf("deduction")}:</div>
          <div className="timesheet-total-value">
            -${Number(timesheet.deductionAmount).toFixed(2)}
          </div>
        </div>
      )}
      <div className="timesheet-total-line timesheet-grand-total">
        <div className="timesheet-total-label">{tf("employeePay")}:</div>
        <div className="timesheet-total-value">${employeePay.toFixed(2)}</div>
      </div>
    </>
  );
}
