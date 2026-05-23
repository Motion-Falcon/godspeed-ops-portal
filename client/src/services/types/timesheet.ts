/**
 * Timesheet API types (snake_case wire format).
 *
 * Naming guide:
 * - TimesheetRow — table row; create/update body uses TimesheetInput
 * - TimesheetListItem — slim GET /timesheets list rows
 * - TimesheetWithJoins — full row + jobseeker_profiles / positions joins
 */

export interface TimesheetDailyHours {
  date: string;
  hours: number;
}

export interface TimesheetVersionHistoryEntry {
  version: number;
  created_by: string;
  created_at: string;
  action: "created" | "updated";
}

export interface TimesheetRow {
  id?: string;
  jobseeker_profile_id: string;
  jobseeker_user_id: string;
  position_id?: string;
  week_start_date: string;
  week_end_date: string;
  daily_hours: TimesheetDailyHours[];
  total_regular_hours: number;
  total_overtime_hours: number;
  regular_pay_rate: number;
  premium_pay_rate: number;
  overtime_pay_rate: number;
  regular_bill_rate: number;
  overtime_bill_rate: number;
  total_jobseeker_pay: number;
  total_client_bill: number;
  overtime_enabled: boolean;
  markup?: number;
  bonus_amount?: number;
  deduction_amount?: number;
  email_sent: boolean;
  document?: string;
  invoice_number?: string;
  notes?: string;
  pay_split_segment?: string;
  line_payment_method?: string | null;
  created_at?: string;
  created_by_user_id?: string;
  updated_at?: string;
  updated_by_user_id?: string;
  version?: number;
  version_history?: TimesheetVersionHistoryEntry[];
}

export type TimesheetInput = Omit<
  TimesheetRow,
  | "id"
  | "created_at"
  | "updated_at"
  | "created_by_user_id"
  | "updated_by_user_id"
  | "version"
  | "version_history"
>;

export interface TimesheetJobseekerProfileJoin {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  billing_email?: string | null;
  payment_method?: string | null;
  cash_deduction?: string | null;
}

export interface TimesheetPositionJoin {
  id?: string;
  position_code: string;
  title: string;
  client?: string | null;
  client_name?: string;
  city?: string;
  province?: string;
  premium_pay_rate?: number;
}

export type TimesheetListItem = Pick<
  TimesheetRow,
  | "id"
  | "invoice_number"
  | "week_start_date"
  | "week_end_date"
  | "total_jobseeker_pay"
  | "email_sent"
> & {
  jobseeker_profiles: TimesheetJobseekerProfileJoin | null;
  positions: TimesheetPositionJoin | null;
};

export type TimesheetWithJoins = TimesheetRow & {
  jobseeker_profiles?: TimesheetJobseekerProfileJoin | null;
  positions?: TimesheetPositionJoin | null;
};

export interface TimesheetFilterParams {
  searchTerm?: string;
  jobseekerFilter?: string;
  positionFilter?: string;
  clientFilter?: string;
  invoiceNumberFilter?: string;
  billingEmailFilter?: string;
  emailSentFilter?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

/** Client list/query helpers (`page` / `limit` as numbers). */
export interface TimesheetListFilters extends TimesheetFilterParams {
  page?: number;
  limit?: number;
}

export interface TimesheetPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalFiltered?: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedTimesheetsResponse {
  timesheets: TimesheetListItem[];
  pagination: TimesheetPaginationMeta;
}

export interface PaginatedJobseekerTimesheetsResponse {
  timesheets: TimesheetWithJoins[];
  pagination: TimesheetPaginationMeta;
}

export interface TimesheetMutationResponse {
  success: boolean;
  message: string;
  timesheet: TimesheetRow;
}

export interface GenerateInvoiceNumberResponse {
  success: boolean;
  invoice_number: string;
}

export interface SendTimesheetEmailResponse {
  success: boolean;
  message: string;
  email_sent: boolean;
  error?: string;
}

export interface DeleteTimesheetResponse {
  success: boolean;
  message: string;
  deleted_id: string;
}
