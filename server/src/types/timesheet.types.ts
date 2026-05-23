// ---------------------------------------------------------------------------
// Core (DB / API body)
// ---------------------------------------------------------------------------

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

/** Full `timesheets` table row. Used for create/update payloads and mutation responses. */
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

/** POST/PUT body — same fields as a row; server sets id, audit, and version fields. */
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

// ---------------------------------------------------------------------------
// Joins (Supabase nested selects)
// ---------------------------------------------------------------------------

export interface TimesheetJobseekerProfileJoin {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  billing_email?: string | null;
  payment_method?: string | null;
  cash_deduction?: string | null;
}

/** Position data from list or detail joins (detail may include extra columns). */
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

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

/** GET /api/timesheets — optimized list projection. */
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

/** GET /api/timesheets/:id and GET /api/timesheets/jobseeker/:id — full row + joins. */
export type TimesheetWithJoins = TimesheetRow & {
  jobseeker_profiles?: TimesheetJobseekerProfileJoin | null;
  positions?: TimesheetPositionJoin | null;
};

/** JSON pagination (camelCase matches existing API responses). */
export interface TimesheetPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalFiltered?: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface TimesheetMutationResponse {
  success: boolean;
  message: string;
  timesheet: TimesheetRow;
}

// ---------------------------------------------------------------------------
// Query params (Express `req.query` values are strings)
// ---------------------------------------------------------------------------

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

export interface TimesheetListQuery extends TimesheetFilterParams {
  page?: string;
  limit?: string;
}

export interface TimesheetJobseekerListQuery {
  page?: string;
  limit?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

// ---------------------------------------------------------------------------
// Service layer results (controller maps these to HTTP)
// ---------------------------------------------------------------------------

export type TimesheetServiceError = {
  success: false;
  status: number;
  error: string;
  details?: string;
  code?: string;
  field?: string;
};

export type TimesheetServiceOk<T extends Record<string, unknown>> = {
  success: true;
} & T;

export type TimesheetServiceResult<T extends Record<string, unknown>> =
  | TimesheetServiceOk<T>
  | TimesheetServiceError;

export type GenerateInvoiceNumberResult = TimesheetServiceResult<{
  invoice_number: string;
}>;

export type GetAllTimesheetsResult = TimesheetServiceResult<{
  timesheets: TimesheetListItem[];
  pagination: TimesheetPaginationMeta;
}>;

export type GetTimesheetByIdResult = TimesheetServiceResult<{
  data: TimesheetWithJoins;
}>;

export type CreateTimesheetResult = TimesheetServiceResult<{
  timesheet: TimesheetRow;
}>;

export type UpdateTimesheetResult = TimesheetServiceResult<{
  timesheet: TimesheetRow;
}>;

export type DeleteTimesheetResult = TimesheetServiceResult<{
  deleted_id: string;
  timesheet: TimesheetRow;
}>;

export type GetJobseekerTimesheetsResult = TimesheetServiceResult<{
  timesheets: TimesheetWithJoins[];
  pagination: TimesheetPaginationMeta;
}>;

export type UpdateTimesheetDocumentResult = TimesheetServiceResult<{
  timesheet: TimesheetRow;
}>;

/** Activity logger `res.locals` after send-email. */
export interface TimesheetSendEmailLocals {
  invoice_number: string;
  jobseeker_name: string;
  email_sent: boolean;
  error: string;
}

export type SendTimesheetEmailResult =
  | {
      success: true;
      status: 200;
      body: {
        success: true;
        message: string;
        email_sent: true;
      };
      timesheetSendResult: TimesheetSendEmailLocals;
    }
  | {
      success: false;
      status: number;
      body: Record<string, unknown>;
      timesheetSendResult?: TimesheetSendEmailLocals;
    };
