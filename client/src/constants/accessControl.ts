import type { AccessRole } from "../lib/auth";

export const INTERNAL_STAFF_ROLES: AccessRole[] = [
  "admin",
  "recruiter",
  "bookkeeper",
  "recruiter_manager",
  "accountant_manager",
  "sales",
  "recruiter_director",
];

export const DASHBOARD_ROLES: AccessRole[] = [...INTERNAL_STAFF_ROLES, "jobseeker"];
export const TRAINING_ROLES: AccessRole[] = [...INTERNAL_STAFF_ROLES, "jobseeker"];
export const CALENDAR_ROLES: AccessRole[] = [...INTERNAL_STAFF_ROLES];
export const AI_CHAT_ROLES: AccessRole[] = [...INTERNAL_STAFF_ROLES];

export const DROPDOWN_OPTIONS_ROLES: AccessRole[] = [
  "admin",
  "recruiter_manager",
  "accountant_manager",
  "recruiter_director",
];

export const ALL_USERS_ROLES: AccessRole[] = ["admin", "recruiter_director"];
export const RECRUITER_HIERARCHY_ROLES: AccessRole[] = ["admin", "recruiter_director"];
export const INVITE_INTERNAL_USER_ROLES: AccessRole[] = [
  "admin",
  "recruiter_manager",
  "accountant_manager",
  "recruiter_director",
];

export const JOBSEEKER_LIST_ROLES: AccessRole[] = [
  "admin",
  "recruiter",
  "bookkeeper",
  "recruiter_manager",
  "accountant_manager",
  "recruiter_director",
];

export const JOBSEEKER_CREATE_ROLES: AccessRole[] = [
  "jobseeker",
  "admin",
  "recruiter",
  "recruiter_manager",
  "recruiter_director",
];

export const JOBSEEKER_MANAGEMENT_CREATE_ROLES: AccessRole[] = [
  "admin",
  "recruiter",
  "recruiter_manager",
  "recruiter_director",
];

export const JOBSEEKER_DRAFT_ROLES: AccessRole[] = [
  "admin",
  "recruiter",
  "recruiter_manager",
  "recruiter_director",
];

export const SIN_WORK_PERMIT_ROLES: AccessRole[] = [
  "admin",
  "recruiter",
  "recruiter_manager",
  "recruiter_director",
];

export const CLIENT_LIST_ROLES: AccessRole[] = [
  "admin",
  "recruiter_manager",
  "accountant_manager",
  "recruiter_director",
];

export const CLIENT_CREATE_ROLES: AccessRole[] = [...CLIENT_LIST_ROLES];
export const CLIENT_DRAFT_ROLES: AccessRole[] = [...CLIENT_LIST_ROLES];

export const POSITION_LIST_ROLES: AccessRole[] = [
  "admin",
  "recruiter",
  "bookkeeper",
  "recruiter_manager",
  "accountant_manager",
  "recruiter_director",
];

export const POSITION_CREATE_ROLES: AccessRole[] = [
  "admin",
  "recruiter_manager",
  "recruiter_director",
];

export const POSITION_DRAFT_ROLES: AccessRole[] = [...POSITION_CREATE_ROLES];

export const POSITION_MATCHING_ROLES: AccessRole[] = [
  "admin",
  "recruiter",
  "recruiter_manager",
  "recruiter_director",
];

export const CONSENT_LIST_ROLES: AccessRole[] = [
  "admin",
  "recruiter",
  "recruiter_manager",
  "recruiter_director",
];

export const CONSENT_CREATE_ROLES: AccessRole[] = [...CONSENT_LIST_ROLES];

export const TIMESHEET_MANAGEMENT_ROLES: AccessRole[] = [
  "admin",
  "recruiter",
  "bookkeeper",
  "recruiter_manager",
  "recruiter_director",
];

export const BULK_TIMESHEET_ROLES: AccessRole[] = ["admin", "bookkeeper"];
export const INVOICE_MANAGEMENT_ROLES: AccessRole[] = ["admin", "accountant_manager"];
export const REPORTS_ROLES: AccessRole[] = [
  "admin",
  "bookkeeper",
  "accountant_manager",
  "recruiter_director",
];

export const DELETE_JOBSEEKER_ROLES: AccessRole[] = [
  "admin",
  "recruiter_manager",
  "recruiter_director",
];

export const DELETE_CLIENT_ROLES: AccessRole[] = [...DELETE_JOBSEEKER_ROLES];
export const DELETE_POSITION_ROLES: AccessRole[] = [...DELETE_JOBSEEKER_ROLES];
export const REMOVE_ASSIGNED_JOBSEEKER_ROLES: AccessRole[] = [
  "admin",
  "recruiter_manager",
  "recruiter_director",
];
