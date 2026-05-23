import { DollarSign } from "lucide-react";
import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

interface TimesheetPayAdjustmentsProps {
  bonusAmount: number;
  deductionAmount: number;
  onBonusChange: (amount: number) => void;
  onDeductionChange: (amount: number) => void;
}

/** Limit fractional input to two decimal places on blur */
function clampTwoDecimals(raw: string, setNumber: (n: number) => void, emptyMeansZero: boolean) {
  if (raw === "") {
    if (emptyMeansZero) setNumber(0);
    return;
  }
  const [intPart, decPart] = raw.split(".");
  let limitedValue = raw;
  if (decPart && decPart.length > 2) {
    limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
  }
  const amount = parseFloat(limitedValue) || 0;
  setNumber(amount);
}

export function TimesheetPayAdjustments({
  bonusAmount,
  deductionAmount,
  onBonusChange,
  onDeductionChange,
}: TimesheetPayAdjustmentsProps) {
  const tf = useTimesheetFormTranslation();

  return (
    <div className="timesheet-hours-section adjustments-section">
      <h4 className="timesheet-hours-title timesheet-pay-adjustments-title">
        <DollarSign size={16} />
        {tf("payAdjustments")}
      </h4>
      <div className="timesheet-days-grid">
        <div className="timesheet-day-entry">
          <label className="timesheet-day-label">
            <div className="timesheet-day-name">{tf("bonus")}</div>
            <div className="timesheet-day-date">{tf("amount")}</div>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={bonusAmount === 0 ? "" : bonusAmount}
            onChange={(e) =>
              clampTwoDecimals(e.target.value, onBonusChange, true)
            }
            placeholder="0.00"
            className="timesheet-hours-input"
          />
        </div>
        <div className="timesheet-day-entry">
          <label className="timesheet-day-label">
            <div className="timesheet-day-name">{tf("deduction")}</div>
            <div className="timesheet-day-date">{tf("amount")}</div>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={deductionAmount === 0 ? "" : deductionAmount}
            onChange={(e) =>
              clampTwoDecimals(e.target.value, onDeductionChange, true)
            }
            placeholder="0.00"
            className="timesheet-hours-input"
          />
        </div>
      </div>
    </div>
  );
}
