import axios from "axios";
import { api } from "./index";

export interface TimesheetReportFilter {
  jobseekerId: string;
  clientIds?: string[];
  weekPeriods: Array<{ start: string; end: string }>;
  payCycle?: string;
  listName?: string;
}

export interface TimesheetReportRow {
  employee_id: string;
  license_number: string;
  passport_number: string;
  name: string;
  mobile: string;
  email: string;
  company_name: string;
  list_name: string;
  title: string;
  position_code: string;
  position_category: string;
  client_manager: string;
  week_start_date: string;
  week_end_date: string;
  total_regular_hours: string;
  total_overtime_hours: string;
  regular_pay_rate: string;
  overtime_pay_rate: string;
  total_jobseeker_pay: string;
  bonus_amount: string;
  deduction_amount: string;
  hst_gst: string;
  currency: string;
  payment_method: string;
  pay_cycle: string;
  notes: string;
  timesheet_created_at: string;
  invoice_number: string;
}

/**
 * Fetches the timesheet report for a jobseeker with filters.
 * @param filters Timesheet report filter object
 * @returns Array of report rows
 */
export const getTimesheetReport = async (
  filters: TimesheetReportFilter
): Promise<TimesheetReportRow[]> => {
  try {
    const response = await api.post("/api/reports/timesheet", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch timesheet report");
    }
    throw error;
  }
};

export interface MarginReportFilter {
  startDate: string;
  endDate: string;
}

export interface MarginReportRow {
  invoice_number: string;
  client_name: string;
  accounting_person: string;
  total_billed_amount: string;
  paid_amount: string;
  margin_amount: string;
  margin_percentage: string;
  invoice_date: string;
}

/**
 * Fetches the margin report with date filters.
 * @param filters Margin report filter object
 * @returns Array of margin report rows
 */
export const getMarginReport = async (
  filters: MarginReportFilter
): Promise<MarginReportRow[]> => {
  try {
    const response = await api.post("/api/reports/margin", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch margin report");
    }
    throw error;
  }
};

export interface InvoiceReportFilter {
  startDate: string;
  endDate: string;
  clientIds?: string[];
}

export interface InvoiceReportRow {
  invoice_number: string;
  client_name: string;
  contact_person: string;
  terms: string;
  invoice_date: string;
  due_date: string;
  total_amount: string;
  currency: string;
  email_sent: string;
  email_sent_date: string;
}

/**
 * Fetches the invoice report with date and client filters.
 * @param filters Invoice report filter object
 * @returns Array of invoice report rows
 */
export const getInvoiceReport = async (
  filters: InvoiceReportFilter
): Promise<InvoiceReportRow[]> => {
  try {
    const response = await api.post("/api/reports/invoice", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch invoice report");
    }
    throw error;
  }
};

export interface DeductionReportFilter {
  startDate: string;
  endDate: string;
}

export interface DeductionReportRow {
  invoice_number: string;
  client_name: string;
  accounting_person: string;
  total_amount: string;
  jobseeker_deductions: string;
  total_deductions_amount: string;
  invoice_date: string;
}

/**
 * Fetches the deduction report with date filters.
 * @param filters Deduction report filter object
 * @returns Array of deduction report rows
 */
export const getDeductionReport = async (
  filters: DeductionReportFilter
): Promise<DeductionReportRow[]> => {
  try {
    const response = await api.post("/api/reports/deduction", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch deduction report");
    }
    throw error;
  }
};

export interface RateListFilter {
  clientIds?: string[];
}

export interface RateListRow {
  client_name: string;
  position_details: string;
  position_category: string;
  bill_rate: string;
  pay_rate: string;
  overtime_hours: string;
  overtime_bill_rate: string;
  overtime_pay_rate: string;
}

/**
 * Fetches the rate list report with client filters.
 * @param filters Rate list report filter object
 * @returns Array of rate list rows
 */
export const getRateListReport = async (
  filters: RateListFilter
): Promise<RateListRow[]> => {
  try {
    const response = await api.post("/api/reports/rate-list", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch rate list");
    }
    throw error;
  }
};

export interface ClientsReportFilter {
  clientManagerIds?: string[];
  paymentMethods?: string[];
  terms?: string[];
}

export interface ClientsReportRow {
  company_name: string;
  billing_name: string;
  short_code: string;
  list_name: string;
  accounting_person: string;
  sales_person: string;
  client_manager: string;
  contact_person_name1: string;
  email_address1: string;
  mobile1: string;
  address: string;
  preferred_payment_method: string;
  pay_cycle: string;
  terms: string;
  notes: string;
}

/**
 * Fetches the clients report with filters.
 * @param filters Clients report filter object
 * @returns Array of clients report rows
 */
export const getClientsReport = async (
  filters: ClientsReportFilter
): Promise<ClientsReportRow[]> => {
  try {
    const response = await api.post("/api/reports/clients", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch clients report");
    }
    throw error;
  }
};

export interface SalesReportFilter {
  clientIds: string[];
  startDate: string;
  endDate: string;
  jobseekerIds?: string[];
  salesPersons?: string[];
}

export interface SalesReportRow {
  client_name: string;
  contact_person_name: string;
  sales_person: string;
  invoice_number: string;
  from_date: string;
  to_date: string;
  invoice_date: string;
  due_date: string;
  terms: string;
  item_position: string;
  position_category: string;
  jobseeker_number: string;
  jobseeker_name: string;
  description: string;
  hours: string;
  bill_rate: string;
  amount: string;
  discount: string;
  tax_rate: string;
  gst_hst: string;
  total: string;
  currency: string;
}

/**
 * Fetches the sales report with filters for clients, week periods, jobseekers, and sales persons.
 * @param filters Sales report filter object
 * @returns Array of sales report rows
 */
export const getSalesReport = async (
  filters: SalesReportFilter
): Promise<SalesReportRow[]> => {
  try {
    const response = await api.post("/api/reports/sales", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch sales report");
    }
    throw error;
  }
};

export interface EnvelopePrintingReportFilter {
  clientIds: string[];
  startDate: string;
  endDate: string;
  listName?: string;
  payCycle?: string;
}

export interface EnvelopePrintingReportRow {
  city: string;
  list_name: string;
  week_ending: string;
  client_name: string;
  sales_person: string;
  short_code: string;
  work_province: string;
  pay_cycle: string;
  jobseeker_id: string;
  license_number: string;
  passport_number: string;
  jobseeker_name: string;
  phone_number: string;
  email_id: string;
  pay_method: string;
  position_category: string;
  position_name: string;
  hours: string;
  total_amount: string;
  tax_rate: string;
  hst_gst: string;
  invoice_number: string;
  invoice_date: string;
  currency: string;
}

export const getEnvelopePrintingReport = async (
  filters: EnvelopePrintingReportFilter
): Promise<EnvelopePrintingReportRow[]> => {
  try {
    const response = await api.post("/api/reports/envelope-printing-position", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch envelope printing report");
    }
    throw error;
  }
}; 