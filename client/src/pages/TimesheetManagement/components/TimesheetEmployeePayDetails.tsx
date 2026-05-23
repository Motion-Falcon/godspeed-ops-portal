import type { JobSeekerProfile } from "../../../types/jobseeker";
import {
  TimesheetJobseekerInfoPanel,
  type TimesheetJobseekerInfoExtras,
} from "./TimesheetJobseekerInfoPanel";

interface TimesheetEmployeePayDetailsProps {
  jobseeker: JobSeekerProfile;
  extras?: TimesheetJobseekerInfoExtras;
}

/** @deprecated Prefer {@link TimesheetJobseekerInfoPanel} — kept for existing imports. */
export function TimesheetEmployeePayDetails({
  jobseeker,
  extras,
}: TimesheetEmployeePayDetailsProps) {
  return <TimesheetJobseekerInfoPanel jobseeker={jobseeker} extras={extras} />;
}
