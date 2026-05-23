import type { AssignmentRecord } from "../../../services/api/position";
import type { JobSeekerProfile } from "../../../types/jobseeker";

/** Maps position assignment wire profile into {@link JobSeekerProfile} for submit/calculations. */
export function mapAssignmentToJobseeker(
  assignment: AssignmentRecord
): JobSeekerProfile | null {
  const profile = assignment.jobseekerProfile;
  if (!profile?.id) return null;

  const userId = profile.user_id || assignment.candidate_id;
  if (!userId) return null;

  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const name = `${first} ${last}`.trim() || profile.email || "Unknown";

  return {
    id: profile.id,
    userId,
    name,
    email: profile.email ?? "",
    phoneNumber: profile.mobile ?? "",
    status: "verified",
    experience: "",
    createdAt: assignment.created_at,
    isInactive: profile.is_inactive,
    paymentMethod: profile.payment_method,
    cashDeduction: profile.cash_deduction,
    sinPayrollHoursCap: profile.sin_payroll_hours_cap,
  };
}
