import axios from "axios";
import { api, clearCacheFor } from "./index";
import type {
  TimesheetInput,
  TimesheetListFilters,
  PaginatedTimesheetsResponse,
  PaginatedJobseekerTimesheetsResponse,
  TimesheetMutationResponse,
  TimesheetWithJoins,
  GenerateInvoiceNumberResponse,
  SendTimesheetEmailResponse,
  DeleteTimesheetResponse,
} from "../types/timesheet";

export type {
  TimesheetRow,
  TimesheetInput,
  TimesheetListItem,
  TimesheetWithJoins,
  TimesheetListFilters,
  TimesheetFilterParams,
  PaginatedTimesheetsResponse,
  PaginatedJobseekerTimesheetsResponse,
  TimesheetMutationResponse,
  GenerateInvoiceNumberResponse,
  SendTimesheetEmailResponse,
  DeleteTimesheetResponse,
} from "../types/timesheet";

export const getTimesheets = async (
  params: TimesheetListFilters = {}
): Promise<PaginatedTimesheetsResponse> => {
  try {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.searchTerm) queryParams.append("searchTerm", params.searchTerm);
    if (params.jobseekerFilter)
      queryParams.append("jobseekerFilter", params.jobseekerFilter);
    if (params.positionFilter)
      queryParams.append("positionFilter", params.positionFilter);
    if (params.clientFilter)
      queryParams.append("clientFilter", params.clientFilter);
    if (params.invoiceNumberFilter)
      queryParams.append("invoiceNumberFilter", params.invoiceNumberFilter);
    if (params.billingEmailFilter)
      queryParams.append("billingEmailFilter", params.billingEmailFilter);
    if (params.emailSentFilter)
      queryParams.append("emailSentFilter", params.emailSentFilter);
    if (params.dateRangeStart)
      queryParams.append("dateRangeStart", params.dateRangeStart);
    if (params.dateRangeEnd)
      queryParams.append("dateRangeEnd", params.dateRangeEnd);
    if (params.excludeBulk !== undefined)
      queryParams.append("excludeBulk", params.excludeBulk.toString());

    const response = await api.get<PaginatedTimesheetsResponse>(
      `/api/timesheets?${queryParams.toString()}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching timesheets:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch timesheets"
      );
    }
    throw error;
  }
};

export const getTimesheet = async (id: string): Promise<TimesheetWithJoins> => {
  try {
    const response = await api.get<TimesheetWithJoins>(`/api/timesheets/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch timesheet");
    }
    throw error;
  }
};

export const createTimesheet = async (
  timesheetData: TimesheetInput
): Promise<TimesheetMutationResponse> => {
  try {
    const response = await api.post<TimesheetMutationResponse>(
      "/api/timesheets",
      timesheetData
    );
    clearCacheFor("/api/timesheets");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to create timesheet"
      );
    }
    throw error;
  }
};

export const updateTimesheet = async (
  id: string,
  timesheetData: TimesheetInput
): Promise<TimesheetMutationResponse> => {
  try {
    const response = await api.put<TimesheetMutationResponse>(
      `/api/timesheets/${id}`,
      timesheetData
    );
    clearCacheFor(`/api/timesheets/${id}`);
    clearCacheFor("/api/timesheets");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to update timesheet"
      );
    }
    throw error;
  }
};

export const updateTimesheetDocument = async (
  id: string,
  document: string
): Promise<TimesheetMutationResponse> => {
  try {
    const response = await api.patch<TimesheetMutationResponse>(
      `/api/timesheets/${id}/document`,
      { document }
    );
    clearCacheFor(`/api/timesheets/${id}`);
    clearCacheFor("/api/timesheets");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to update timesheet document"
      );
    }
    throw error;
  }
};

export const deleteTimesheet = async (
  id: string
): Promise<DeleteTimesheetResponse> => {
  try {
    const response = await api.delete<DeleteTimesheetResponse>(
      `/api/timesheets/${id}`
    );
    clearCacheFor("/api/timesheets");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to delete timesheet"
      );
    }
    throw error;
  }
};

export const getJobseekerTimesheets = async (
  userId: string,
  params: TimesheetListFilters = {}
): Promise<PaginatedJobseekerTimesheetsResponse> => {
  try {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.searchTerm) queryParams.append("searchTerm", params.searchTerm);
    if (params.positionFilter)
      queryParams.append("positionFilter", params.positionFilter);
    if (params.clientFilter)
      queryParams.append("clientFilter", params.clientFilter);
    if (params.invoiceNumberFilter)
      queryParams.append("invoiceNumberFilter", params.invoiceNumberFilter);
    if (params.emailSentFilter)
      queryParams.append("emailSentFilter", params.emailSentFilter);
    if (params.dateRangeStart)
      queryParams.append("dateRangeStart", params.dateRangeStart);
    if (params.dateRangeEnd)
      queryParams.append("dateRangeEnd", params.dateRangeEnd);
    if (params.excludeBulk !== undefined)
      queryParams.append("excludeBulk", params.excludeBulk.toString());

    const response = await api.get<PaginatedJobseekerTimesheetsResponse>(
      `/api/timesheets/jobseeker/${userId}?${queryParams.toString()}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching jobseeker timesheets:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch jobseeker timesheets"
      );
    }
    throw error;
  }
};

export const generateInvoiceNumber = async (): Promise<string> => {
  try {
    const response = await api.get<GenerateInvoiceNumberResponse>(
      "/api/timesheets/generate-invoice-number"
    );
    return response.data.invoice_number;
  } catch (error) {
    console.error("Error generating invoice number:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to generate invoice number"
      );
    }
    throw error;
  }
};

export const createTimesheetFromFrontendData = async (frontendData: {
  jobseeker_profile_id: string;
  jobseeker_user_id: string;
  week_start_date: string;
  week_end_date: string;
  email_sent: boolean;
  assignments: Array<{
    position_id?: string;
    daily_hours: TimesheetInput["daily_hours"];
    total_regular_hours: number;
    total_overtime_hours: number;
    regular_pay_rate: number;
    premium_pay_rate?: number;
    overtime_pay_rate: number;
    regular_bill_rate: number;
    overtime_bill_rate: number;
    total_jobseeker_pay: number;
    total_client_bill: number;
    overtime_enabled: boolean;
    bonus_amount: number;
    deduction_amount: number;
    notes?: string;
    markup?: number;
  }>;
}): Promise<TimesheetMutationResponse[]> => {
  try {
    const results: TimesheetMutationResponse[] = [];

    for (const assignment of frontendData.assignments) {
      const invoice_number = await generateInvoiceNumber();

      const timesheetData: TimesheetInput = {
        invoice_number,
        jobseeker_profile_id: frontendData.jobseeker_profile_id,
        jobseeker_user_id: frontendData.jobseeker_user_id,
        position_id: assignment.position_id,
        week_start_date: frontendData.week_start_date,
        week_end_date: frontendData.week_end_date,
        daily_hours: assignment.daily_hours,
        total_regular_hours: assignment.total_regular_hours,
        total_overtime_hours: assignment.total_overtime_hours,
        regular_pay_rate: assignment.regular_pay_rate,
        premium_pay_rate: assignment.premium_pay_rate || 0,
        overtime_pay_rate: assignment.overtime_pay_rate,
        regular_bill_rate: assignment.regular_bill_rate,
        overtime_bill_rate: assignment.overtime_bill_rate,
        total_jobseeker_pay: assignment.total_jobseeker_pay,
        total_client_bill: assignment.total_client_bill,
        overtime_enabled: assignment.overtime_enabled,
        bonus_amount: assignment.bonus_amount,
        deduction_amount: assignment.deduction_amount,
        notes: assignment.notes,
        markup: assignment.markup,
        email_sent: frontendData.email_sent,
      };

      const result = await createTimesheet(timesheetData);
      results.push(result);
    }

    return results;
  } catch (error) {
    console.error("Error creating timesheets from frontend data:", error);
    throw error;
  }
};

export const sendTimesheetEmails = async (
  id: string,
  jobseekerId?: string
): Promise<{
  success: boolean;
  message: string;
  emailsSent: string[];
  emailsSkipped: string[];
}> => {
  try {
    const response = await api.post<SendTimesheetEmailResponse>(
      `/api/timesheets/send-email/${id}`,
      jobseekerId ? { jobseekerId } : {}
    );
    return {
      success: response.data.success,
      message: response.data.message,
      emailsSent: response.data.email_sent ? [id] : [],
      emailsSkipped: response.data.email_sent ? [] : [id],
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to send emails for bulk timesheet"
      );
    }
    throw error;
  }
};
