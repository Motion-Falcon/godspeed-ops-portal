import type { ReactNode } from "react";
import type { JobSeekerProfile } from "../../../types/jobseeker";
import {
  hybridSecondLinePaymentMethod,
  isHybridPaymentMethod,
  profileUsesCashDeductionField,
  SIN_DIRECT_DEPOSIT,
} from "../../../lib/hybridPayrollSplit";
import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

export interface TimesheetJobseekerInfoExtras {
  billingEmail?: string;
  employeeId?: string;
}

interface TimesheetJobseekerInfoPanelProps {
  jobseeker: JobSeekerProfile;
  extras?: TimesheetJobseekerInfoExtras;
  /** `row` — single horizontal strip (bulk cards); default is responsive grid */
  layout?: "grid" | "row";
}

function InfoCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="timesheet-jobseeker-info-item">
      <span className="timesheet-jobseeker-info-label">{label}</span>
      <span className="timesheet-jobseeker-info-value">{value}</span>
    </div>
  );
}

export function TimesheetJobseekerInfoPanel({
  jobseeker,
  extras,
  layout = "grid",
}: TimesheetJobseekerInfoPanelProps) {
  const tf = useTimesheetFormTranslation();
  const pm = jobseeker.paymentMethod?.trim() || "";
  const secondLine =
    pm && isHybridPaymentMethod(pm)
      ? hybridSecondLinePaymentMethod(pm)
      : null;
  const cashDeductionPct = parseFloat(jobseeker.cashDeduction || "0");
  const sinCapRaw = jobseeker.sinPayrollHoursCap;
  const sinCapNum = parseFloat(String(sinCapRaw ?? ""));
  const sinCapDisplay =
    sinCapRaw !== undefined &&
    sinCapRaw !== null &&
    sinCapRaw !== "" &&
    Number.isFinite(sinCapNum)
      ? tf("employee.sinHoursCapValue", { hours: sinCapNum })
      : tf("na");

  const billingEmail =
    extras?.billingEmail?.trim() ||
    (jobseeker as JobSeekerProfile & { billingEmail?: string }).billingEmail?.trim() ||
    "";
  const employeeId =
    extras?.employeeId?.trim() ||
    (jobseeker as JobSeekerProfile & { employeeId?: string }).employeeId?.trim() ||
    "";

  const isRow = layout === "row";

  return (
    <section
      className={`timesheet-jobseeker-info-section${isRow ? " timesheet-jobseeker-info-section--row" : ""}`}
    >
      <h4 className="timesheet-jobseeker-info-title">
        {tf("employee.sectionTitle")}
      </h4>
      <div
        className={`timesheet-jobseeker-info-grid${isRow ? " timesheet-jobseeker-info-grid--row" : ""}`}
      >
        <InfoCell label={tf("employee.name")} value={jobseeker.name} />
        <InfoCell label={tf("employee.email")} value={jobseeker.email || tf("na")} />
        <InfoCell
          label={tf("employee.billingEmail")}
          value={billingEmail || tf("na")}
        />
        <InfoCell
          label={tf("employee.phoneNumber")}
          value={jobseeker.phoneNumber || tf("na")}
        />
        <InfoCell
          label={tf("employee.employeeId")}
          value={employeeId || tf("na")}
        />
        <InfoCell
          label={tf("employee.paymentMethod")}
          value={pm || tf("na")}
        />
        {secondLine ? (
          <InfoCell
            label={tf("employee.paidAs")}
            value={`${SIN_DIRECT_DEPOSIT} + ${secondLine}`}
          />
        ) : null}
        {profileUsesCashDeductionField(pm) ? (
          <InfoCell
            label={tf("employee.cashDeduction")}
            value={
              Number.isFinite(cashDeductionPct)
                ? `${cashDeductionPct}%`
                : tf("na")
            }
          />
        ) : null}
        {isHybridPaymentMethod(pm) ? (
          <InfoCell label={tf("employee.sinHoursCap")} value={sinCapDisplay} />
        ) : null}
        {pm.startsWith("Corporation") && (jobseeker as JobSeekerProfile & { hstGst?: string }).hstGst ? (
          <InfoCell label={tf("employee.hstGst")} value={`${(jobseeker as JobSeekerProfile & { hstGst?: string }).hstGst}%`} />
        ) : null}
      </div>
    </section>
  );
}
