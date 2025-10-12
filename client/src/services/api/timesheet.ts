import axios from "axios";
import { api, clearCacheFor } from "./index";

// Timesheet management API functions
export interface TimesheetData {
  id?: string;
  invoiceNumber: string;
  jobseekerProfileId: string;
  jobseekerUserId: string;
  positionId?: string;
  weekStartDate: string;
  weekEndDate: string;
  dailyHours: Array<{ date: string; hours: number }>;
  totalRegularHours: number;
  totalOvertimeHours: number;
  regularPayRate: number;
  overtimePayRate: number;
  regularBillRate: number;
  overtimeBillRate: number;
  totalJobseekerPay: number;
  totalClientBill: number;
  overtimeEnabled: boolean;
  bonusAmount: number;
  deductionAmount: number;
  markup?: number;
  emailSent?: boolean;
  document?: string; // PDF file path or URL
  notes?: string; // Additional notes or comments
  createdAt?: string;
  updatedAt?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
  // Populated fields from joins
  jobseekerProfile?: {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    billingEmail?: string;
    mobile?: string;
  };
  position?: {
    id: string;
    positionCode: string;
    title: string;
    clientName: string;
    city: string;
    province: string;
  };
}

export interface TimesheetFilters {
  page?: number;
  limit?: number;
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

export interface PaginatedTimesheetResponse {
  timesheets: TimesheetData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalFiltered: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface TimesheetResponse {
  success: boolean;
  message: string;
  timesheet: TimesheetData;
}

/**
 * Get all timesheets with pagination and filtering
 */
export const getTimesheets = async (
  params: TimesheetFilters = {}
): Promise<PaginatedTimesheetResponse> => {
  try {
    const queryParams = new URLSearchParams();

    // Add pagination params
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());

    // Add filter params
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

    const response = await api.get(`/api/timesheets?${queryParams.toString()}`);
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

/**
 * Get a specific timesheet by ID
 */
export const getTimesheet = async (id: string): Promise<TimesheetData> => {
  try {
    const response = await api.get(`/api/timesheets/${id}`);
    return response.data.timesheet;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch timesheet");
    }
    throw error;
  }
};

/**
 * Create a new timesheet
 */
export const createTimesheet = async (
  timesheetData: Omit<
    TimesheetData,
    "id" | "createdAt" | "updatedAt" | "createdByUserId" | "updatedByUserId"
  >
): Promise<TimesheetResponse> => {
  try {
    const response = await api.post("/api/timesheets", timesheetData);
    // Clear cache for timesheets list after creation
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

/**
 * Update an existing timesheet
 */
export const updateTimesheet = async (
  id: string,
  timesheetData: Partial<TimesheetData>
): Promise<TimesheetResponse> => {
  try {
    const response = await api.put(`/api/timesheets/${id}`, timesheetData);
    // Clear cache for this timesheet and the timesheets list
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

/**
 * Update only the document field of a timesheet (for PDF generation)
 */
export const updateTimesheetDocument = async (
  id: string,
  document: string
): Promise<TimesheetResponse> => {
  try {
    const response = await api.patch(`/api/timesheets/${id}/document`, {
      document,
    });
    // Clear cache for this timesheet and the timesheets list
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

/**
 * Delete a timesheet
 */
export const deleteTimesheet = async (
  id: string
): Promise<{ success: boolean; message: string; deletedId: string }> => {
  try {
    const response = await api.delete(`/api/timesheets/${id}`);
    // Clear cache for timesheets list after deletion
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

/**
 * Get timesheets for a specific jobseeker
 */
export const getJobseekerTimesheets = async (
  userId: string,
  params: TimesheetFilters = {}
): Promise<PaginatedTimesheetResponse> => {
  try {
    const queryParams = new URLSearchParams();

    // Add pagination params
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());

    // Add filter params
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

    const response = await api.get(
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

/**
 * Generate next available invoice number
 */
export const generateInvoiceNumber = async (): Promise<string> => {
  try {
    const response = await api.get("/api/timesheets/generate-invoice-number");
    return response.data.invoiceNumber;
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

/**
 * Helper function to create timesheet data from frontend format
 * This matches the generateTimesheetData function in TimesheetManagement.tsx
 */
export const createTimesheetFromFrontendData = async (frontendData: {
  jobseeker_profile_id: string;
  jobseeker_user_id: string;
  week_start_date: string;
  week_end_date: string;
  email_sent: boolean;
  assignments: Array<{
    position_id?: string;
    daily_hours: Array<{ date: string; hours: number }>;
    total_regular_hours: number;
    total_overtime_hours: number;
    regular_pay_rate: number;
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
}): Promise<TimesheetResponse[]> => {
  try {
    const results: TimesheetResponse[] = [];

    // Create one timesheet per assignment
    for (const assignment of frontendData.assignments) {
      // Generate invoice number for each timesheet
      const invoiceNumber = await generateInvoiceNumber();

      const timesheetData: Omit<
        TimesheetData,
        "id" | "createdAt" | "updatedAt" | "createdByUserId" | "updatedByUserId"
      > = {
        invoiceNumber: invoiceNumber, // Add the generated invoice number
        jobseekerProfileId: frontendData.jobseeker_profile_id,
        jobseekerUserId: frontendData.jobseeker_user_id,
        positionId: assignment.position_id,
        weekStartDate: frontendData.week_start_date,
        weekEndDate: frontendData.week_end_date,
        dailyHours: assignment.daily_hours,
        totalRegularHours: assignment.total_regular_hours,
        totalOvertimeHours: assignment.total_overtime_hours,
        regularPayRate: assignment.regular_pay_rate,
        overtimePayRate: assignment.overtime_pay_rate,
        regularBillRate: assignment.regular_bill_rate,
        overtimeBillRate: assignment.overtime_bill_rate,
        totalJobseekerPay: assignment.total_jobseeker_pay,
        totalClientBill: assignment.total_client_bill,
        overtimeEnabled: assignment.overtime_enabled,
        bonusAmount: assignment.bonus_amount,
        deductionAmount: assignment.deduction_amount,
        notes: assignment.notes,
        markup: assignment.markup,
        emailSent: frontendData.email_sent,
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

/**
 * Send emails for a bulk timesheet (without updating version/version_history)
 */
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
    const response = await api.post(
      `/api/timesheets/send-email/${id}`,
      jobseekerId ? { jobseekerId } : {}
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to send emails for bulk timesheet"
      );
    }
    throw error;
  }
};
