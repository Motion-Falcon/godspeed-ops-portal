import axios from "axios";
import { api, API_URL, clearCacheFor } from "./index";

// Bulk timesheet management API functions
export interface BulkTimesheetData {
  id?: string;
  clientId: string;
  positionId: string;
  invoiceNumber: string;
  weekStartDate: string;
  weekEndDate: string;
  weekPeriod: string;
  emailSent?: boolean;
  totalHours: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalOvertimePay: number;
  totalJobseekerPay: number;
  totalClientBill: number;
  totalBonus: number;
  totalDeductions: number;
  netPay: number;
  numberOfJobseekers: number;
  averageHoursPerJobseeker: number;
  averagePayPerJobseeker: number;
  jobseekerTimesheets: Array<{
    jobseeker: {
      id: string;
      jobseekerProfile: {
        first_name: string;
        last_name: string;
        email: string;
      };
      assignmentId: string;
    };
    entries: Array<{
      date: string;
      hours: number;
      overtimeHours: number;
    }>;
    bonusAmount: number;
    deductionAmount: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    jobseekerPay: number;
    clientBill: number;
  }>;
  createdAt?: string;
  updatedAt?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
  version?: number;
  
  // Related data from joins
  client?: {
    id: string;
    companyName: string;
    shortCode: string;
    emailAddress1: string;
    city1?: string;
    province1?: string;
    postalCode1?: string;
  };
  position?: {
    id: string;
    title: string;
    positionCode: string;
  };
}

export interface BulkTimesheetResponse {
  success: boolean;
  message: string;
  bulkTimesheet: BulkTimesheetData;
}

export interface BulkTimesheetPaginationParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  clientFilter?: string;
  positionFilter?: string;
  invoiceNumberFilter?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  emailSentFilter?: string;
}

export interface PaginatedBulkTimesheetResponse {
  bulkTimesheets: BulkTimesheetData[];
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

/**
 * Generate next available invoice number for bulk timesheets
 */
export const generateInvoiceNumber = async (): Promise<string> => {
  try {
    const response = await api.get("/api/bulk-timesheets/generate-invoice-number");
    return response.data.invoiceNumber;
  } catch (error) {
    console.error("Error generating bulk timesheet invoice number:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to generate invoice number");
    }
    throw error;
  }
};

/**
 * Get a single bulk timesheet by ID
 */
export const getBulkTimesheet = async (id: string): Promise<BulkTimesheetData> => {
  try {
    const response = await api.get(`/api/bulk-timesheets/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch bulk timesheet");
    }
    throw error;
  }
};

/**
 * Get all bulk timesheets with pagination and filtering
 */
export const getBulkTimesheets = async (
  params: BulkTimesheetPaginationParams = {}
): Promise<PaginatedBulkTimesheetResponse> => {
  try {
    const url = new URL("/api/bulk-timesheets", API_URL);

    // Add pagination and filter parameters
    if (params.page) url.searchParams.append("page", params.page.toString());
    if (params.limit) url.searchParams.append("limit", params.limit.toString());
    if (params.searchTerm) url.searchParams.append("searchTerm", params.searchTerm);
    if (params.clientFilter) url.searchParams.append("clientFilter", params.clientFilter);
    if (params.positionFilter) url.searchParams.append("positionFilter", params.positionFilter);
    if (params.invoiceNumberFilter) url.searchParams.append("invoiceNumberFilter", params.invoiceNumberFilter);
    if (params.dateRangeStart) url.searchParams.append("dateRangeStart", params.dateRangeStart);
    if (params.dateRangeEnd) url.searchParams.append("dateRangeEnd", params.dateRangeEnd);
    if (params.emailSentFilter) url.searchParams.append("emailSentFilter", params.emailSentFilter);

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    console.error("Error fetching bulk timesheets:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch bulk timesheets");
    }
    throw error;
  }
};

/**
 * Create a new bulk timesheet
 */
export const createBulkTimesheet = async (
  bulkTimesheetData: Omit<BulkTimesheetData, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId' | 'updatedByUserId' | 'version'>
): Promise<BulkTimesheetResponse> => {
  try {
    const response = await api.post("/api/bulk-timesheets", bulkTimesheetData);
    
    // Clear cache for bulk timesheet list
    clearCacheFor("/api/bulk-timesheets");
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to create bulk timesheet");
    }
    throw error;
  }
};

/**
 * Update an existing bulk timesheet
 */
export const updateBulkTimesheet = async (
  id: string,
  bulkTimesheetData: Partial<Omit<BulkTimesheetData, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt' | 'createdByUserId' | 'updatedByUserId' | 'version'>>
): Promise<BulkTimesheetResponse> => {
  try {
    const response = await api.put(`/api/bulk-timesheets/${id}`, bulkTimesheetData);
    
    // Clear cache for bulk timesheet list and specific bulk timesheet
    clearCacheFor("/api/bulk-timesheets");
    clearCacheFor(`/api/bulk-timesheets/${id}`);
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to update bulk timesheet");
    }
    throw error;
  }
};

/**
 * Delete a bulk timesheet (Admin only)
 */
export const deleteBulkTimesheet = async (id: string): Promise<{ success: boolean; message: string; deletedId: string }> => {
  try {
    const response = await api.delete(`/api/bulk-timesheets/${id}`);
    
    // Clear cache for bulk timesheet list and specific bulk timesheet
    clearCacheFor("/api/bulk-timesheets");
    clearCacheFor(`/api/bulk-timesheets/${id}`);
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to delete bulk timesheet");
    }
    throw error;
  }
};

/**
 * Helper function to create bulk timesheet data from frontend format
 * This is used by the generateBulkTimesheetData function
 */
export const createBulkTimesheetFromFrontendData = async (
  frontendData: {
    clientId: string;
    positionId: string;
    invoiceNumber: string;
    weekStartDate: string;
    weekEndDate: string;
    weekPeriod: string;
    emailSent?: boolean;
    totalHours: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    totalOvertimePay: number;
    totalJobseekerPay: number;
    totalClientBill: number;
    totalBonus: number;
    totalDeductions: number;
    netPay: number;
    numberOfJobseekers: number;
    averageHoursPerJobseeker: number;
    averagePayPerJobseeker: number;
    jobseekerTimesheets: Array<{
      jobseeker: {
        id: string;
        jobseekerProfile: {
          first_name: string;
          last_name: string;
          email: string;
        };
        assignmentId: string;
      };
      entries: Array<{
        date: string;
        hours: number;
        overtimeHours: number;
      }>;
      bonusAmount: number;
      deductionAmount: number;
      totalRegularHours: number;
      totalOvertimeHours: number;
      jobseekerPay: number;
      clientBill: number;
    }>;
  }
): Promise<BulkTimesheetResponse> => {
  try {
    const bulkTimesheetData: Omit<BulkTimesheetData, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId' | 'updatedByUserId' | 'version'> = {
      clientId: frontendData.clientId,
      positionId: frontendData.positionId,
      invoiceNumber: frontendData.invoiceNumber,
      weekStartDate: frontendData.weekStartDate,
      weekEndDate: frontendData.weekEndDate,
      weekPeriod: frontendData.weekPeriod,
      emailSent: frontendData.emailSent || false,
      totalHours: frontendData.totalHours,
      totalRegularHours: frontendData.totalRegularHours,
      totalOvertimeHours: frontendData.totalOvertimeHours,
      totalOvertimePay: frontendData.totalOvertimePay,
      totalJobseekerPay: frontendData.totalJobseekerPay,
      totalClientBill: frontendData.totalClientBill,
      totalBonus: frontendData.totalBonus,
      totalDeductions: frontendData.totalDeductions,
      netPay: frontendData.netPay,
      numberOfJobseekers: frontendData.numberOfJobseekers,
      averageHoursPerJobseeker: frontendData.averageHoursPerJobseeker,
      averagePayPerJobseeker: frontendData.averagePayPerJobseeker,
      jobseekerTimesheets: frontendData.jobseekerTimesheets,
    };
    
    const result = await createBulkTimesheet(bulkTimesheetData);
    return result;
  } catch (error) {
    console.error("Error creating bulk timesheet from frontend data:", error);
    throw error;
  }
};

/**
 * Helper function to format bulk timesheet data for display
 */
export const formatBulkTimesheetForDisplay = (bulkTimesheet: BulkTimesheetData) => {
  return {
    ...bulkTimesheet,
    formattedWeekStartDate: new Date(bulkTimesheet.weekStartDate).toLocaleDateString(),
    formattedWeekEndDate: new Date(bulkTimesheet.weekEndDate).toLocaleDateString(),
    formattedCreatedAt: bulkTimesheet.createdAt ? new Date(bulkTimesheet.createdAt).toLocaleDateString() : null,
    formattedUpdatedAt: bulkTimesheet.updatedAt ? new Date(bulkTimesheet.updatedAt).toLocaleDateString() : null,
    formattedTotalJobseekerPay: `$${bulkTimesheet.totalJobseekerPay.toFixed(2)} CAD`,
    formattedTotalClientBill: `$${bulkTimesheet.totalClientBill.toFixed(2)} CAD`,
    formattedNetPay: `$${bulkTimesheet.netPay.toFixed(2)} CAD`,
    clientDisplayName: bulkTimesheet.client?.companyName || bulkTimesheet.client?.shortCode || 'Unknown Client',
    positionDisplayName: bulkTimesheet.position?.title || bulkTimesheet.position?.positionCode || 'Unknown Position',
    formattedTotalHours: `${bulkTimesheet.totalHours.toFixed(1)} hours`,
    formattedAverageHours: `${bulkTimesheet.averageHoursPerJobseeker.toFixed(1)} hours/jobseeker`,
    formattedAveragePay: `$${bulkTimesheet.averagePayPerJobseeker.toFixed(2)}/jobseeker`,
  };
}; 