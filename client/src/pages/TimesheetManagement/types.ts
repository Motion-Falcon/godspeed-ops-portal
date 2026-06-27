import type { AssignmentRecord } from "../../services/api/position";
import type { TimesheetWithJoins } from "../../services/types/timesheet";

/** Single day's hours inside the weekly form (camelCase UI model). */
export interface TimesheetDayEntry {
  date: string;
  hours: number;
  overtimeHours: number;
}

export type PaySplitSegmentKey =
  | "single"
  | "sin"
  | "cash"
  | "e_transfer";

/** Form seed built from existing DB rows for a jobseeker + position + week. */
export interface WeeklyTimesheetSeed {
  week_start_date: string;
  week_end_date: string;
  entries: TimesheetDayEntry[];
  invoice_number: string;
  bonus_amount: number;
  deduction_amount: number;
  notes: string;
  existingTimesheetId?: string;
  splitExistingIds?: Partial<Record<PaySplitSegmentKey, string>>;
  hasExisting: boolean;
}

/**
 * Subset of {@link TimesheetWithJoins} for week/position matching and form seeding.
 * Uses the same snake_case field names as the API wire format (not camelCase).
 */
export type WeekTimesheetRecord = Pick<
  TimesheetWithJoins,
  | "id"
  | "invoice_number"
  | "position_id"
  | "week_start_date"
  | "week_end_date"
  | "total_regular_hours"
  | "total_overtime_hours"
  | "total_jobseeker_pay"
  | "total_client_bill"
  | "bonus_amount"
  | "deduction_amount"
  | "notes"
  | "pay_split_segment"
  | "line_payment_method"
  | "daily_hours"
  | "is_bulk"
  | "bulk_breakdown"
>;

/** In-memory weekly form model bound to one position/week. */
export interface WeeklyTimesheet {
  positionId: string;
  invoiceNumber: string;
  weekStartDate: string;
  weekEndDate: string;
  entries: TimesheetDayEntry[];
  totalRegularHours: number;
  totalOvertimeHours: number;
  jobseekerPay: number;
  clientBill: number;
  bonusAmount: number;
  deductionAmount: number;
  notes: string;
  existingTimesheetId?: string;
  splitExistingIds?: Partial<Record<PaySplitSegmentKey, string>>;
}

/** Extended position shape for overtime + bill display (Bulk flow also uses this type). */
export interface PositionWithOvertime {
  id: string;
  positionCode: string;
  title: string;
  clientName: string;
  city: string;
  province: string;
  employmentTerm: string;
  employmentType: string;
  positionCategory: string;
  experience: string;
  showOnJobPortal: boolean;
  startDate: string;
  endDate?: string;
  regularPayRate: string;
  premiumPayRate?: string;
  billRate: string;
  numberOfPositions: number;
  overtimeEnabled?: boolean;
  overtimeHours?: string;
  overtimePayRate?: string;
  overtimeBillRate?: string;
  markup?: string;
  isSubcategory?: boolean;
  subcategoryPosition?: string[] | null;
}

/** Slim position shape for dropdown selection (from API list). */
export interface ClientPosition {
  id: string;
  positionCode: string;
  title: string;
  regularPayRate: string;
  premiumPayRate?: string;
  billRate: string;
  overtimeEnabled?: boolean;
  overtimeHours?: string;
  overtimePayRate?: string;
  overtimeBillRate?: string;
  markup?: string;
  positionNumber?: string;
  isSubcategory?: boolean;
  subcategoryPosition?: string[] | null;
}

/** One jobseeker row on the bulk create page (assignment + weekly form + email flag). */
export interface BulkJobseekerRow {
  assignment: AssignmentRecord;
  form: WeeklyTimesheet;
  emailSent: boolean;
}

/** One position row on the jobseeker-centric bulk page (position optional until picked). */
export interface BulkPositionRow {
  rowId: string;
  position: ClientPosition | null;
  form: WeeklyTimesheet | null;
  /** Seed loading after choosing a position */
  formLoading?: boolean;
  emailSent: boolean;
}
