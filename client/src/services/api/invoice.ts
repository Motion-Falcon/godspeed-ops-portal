import axios from "axios";
import { api, API_URL, clearCacheFor } from "./index";

// Invoice management API functions
export interface InvoiceData {
  id?: string;
  invoiceNumber?: string;
  clientId: string;
  invoiceDate: string;
  dueDate: string;
  status?: string;
  currency?: string;
  subtotal: number;
  totalTax: number;
  totalHst?: number;
  totalGst?: number;
  totalQst?: number;
  grandTotal: number;
  totalHours: number;
  emailSent?: boolean;
  emailSentDate?: string;
  documentGenerated?: boolean;
  documentPath?: string;
  documentFileName?: string;
  documentFileSize?: number;
  documentMimeType?: string;
  documentGeneratedAt?: string;
  invoiceData: Record<string, unknown>; // Complete JSONB object from frontend
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
  // Add invoice_sent_to field for recipient email
  invoice_sent_to?: string;
}

export interface InvoiceResponse {
  success: boolean;
  message: string;
  invoice: InvoiceData;
}

export interface InvoicePaginationParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  clientFilter?: string;
  clientEmailFilter?: string;
  invoiceNumberFilter?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  emailSentFilter?: string;
  invoiceSentFilter?: string;
  documentGeneratedFilter?: string;
}

export interface PaginatedInvoiceResponse {
  invoices: InvoiceData[];
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

export interface InvoiceDocumentUpdateData {
  documentPath: string;
  documentFileName?: string;
  documentFileSize?: number;
  documentGeneratedAt?: string;
}

/**
 * Get a single invoice by ID
 */
export const getInvoice = async (id: string): Promise<InvoiceData> => {
  try {
    const response = await api.get(`/api/invoices/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch invoice");
    }
    throw error;
  }
};

/**
 * Get all invoices with pagination and filtering
 */
export const getInvoices = async (
  params: InvoicePaginationParams = {}
): Promise<PaginatedInvoiceResponse> => {
  try {
    const url = new URL("/api/invoices", API_URL);

    // Add pagination and filter parameters
    if (params.page) url.searchParams.append("page", params.page.toString());
    if (params.limit) url.searchParams.append("limit", params.limit.toString());
    if (params.searchTerm) url.searchParams.append("searchTerm", params.searchTerm);
    if (params.clientFilter) url.searchParams.append("clientFilter", params.clientFilter);
    if (params.clientEmailFilter) url.searchParams.append("clientEmailFilter", params.clientEmailFilter);
    if (params.invoiceNumberFilter) url.searchParams.append("invoiceNumberFilter", params.invoiceNumberFilter);
    if (params.dateRangeStart) url.searchParams.append("dateRangeStart", params.dateRangeStart);
    if (params.dateRangeEnd) url.searchParams.append("dateRangeEnd", params.dateRangeEnd);
    if (params.emailSentFilter) url.searchParams.append("emailSentFilter", params.emailSentFilter);
    if (params.invoiceSentFilter) url.searchParams.append("invoiceSentFilter", params.invoiceSentFilter);
    if (params.documentGeneratedFilter) url.searchParams.append("documentGeneratedFilter", params.documentGeneratedFilter);

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    console.error("Error fetching invoices:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch invoices");
    }
    throw error;
  }
};

/**
 * Create a new invoice
 */
export const createInvoice = async (invoiceData: Omit<InvoiceData, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId' | 'updatedByUserId' | 'version'>): Promise<InvoiceResponse> => {
  try {
    const response = await api.post("/api/invoices", invoiceData);
    
    // Clear cache for invoice list
    clearCacheFor("/api/invoices");
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to create invoice");
    }
    throw error;
  }
};

/**
 * Update an existing invoice
 */
export const updateInvoice = async (
  id: string,
  invoiceData: Partial<Omit<InvoiceData, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt' | 'createdByUserId' | 'updatedByUserId' | 'version'>>
): Promise<InvoiceResponse> => {
  try {
    const response = await api.put(`/api/invoices/${id}`, invoiceData);
    
    // Clear cache for invoice list and specific invoice
    clearCacheFor("/api/invoices");
    clearCacheFor(`/api/invoices/${id}`);
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to update invoice");
    }
    throw error;
  }
};

/**
 * Delete an invoice (Admin only)
 */
export const deleteInvoice = async (id: string): Promise<{ success: boolean; message: string; deletedId: string }> => {
  try {
    const response = await api.delete(`/api/invoices/${id}`);
    
    // Clear cache for invoice list and specific invoice
    clearCacheFor("/api/invoices");
    clearCacheFor(`/api/invoices/${id}`);
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to delete invoice");
    }
    throw error;
  }
};

/**
 * Update invoice document information (for PDF generation)
 */
export const updateInvoiceDocument = async (
  id: string,
  documentData: InvoiceDocumentUpdateData
): Promise<InvoiceResponse> => {
  try {
    const response = await api.patch(`/api/invoices/${id}/document`, documentData);
    
    // Clear cache for invoice list and specific invoice
    clearCacheFor("/api/invoices");
    clearCacheFor(`/api/invoices/${id}`);
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to update invoice document");
    }
    throw error;
  }
};

/**
 * Generate next available invoice number
 */
export const generateInvoiceNumber = async (): Promise<string> => {
  try {
    const response = await api.get("/api/invoices/generate-invoice-number");
    return response.data.invoiceNumber;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to generate invoice number");
    }
    throw error;
  }
};

/**
 * Helper function to create invoice data from frontend format
 * This matches the generateInvoiceData function in InvoiceManagement.tsx
 */
export const createInvoiceFromFrontendData = async (
  frontendData: {
    client: {
      id: string;
      companyName: string;
      shortCode: string;
      emailAddress1: string;
      city1?: string;
      province1?: string;
      postalCode1?: string;
    };
    invoiceNumber?: string;
    invoiceDate: string;
    dueDate: string;
    status?: string;
    currency?: string;
    timesheets: Array<{
      id: string;
      invoiceNumber: string;
      weekStartDate: string;
      weekEndDate: string;
      totalRegularHours: number;
      totalOvertimeHours: number;
      regularBillRate: number;
      overtimeBillRate: number;
      totalClientBill: number;
      jobseekerProfile: {
        firstName: string;
        lastName: string;
        email: string;
      };
      position: {
        title: string;
        positionCode: string;
      };
    }>;
    attachments?: Array<{
      fileName: string;
      fileSize: number;
      fileType: string;
      uploadStatus: string;
      filePath: string;
      bucketName: string;
    }>;
    subtotal: number;
    totalTax: number;
    totalHst?: number;
    totalGst?: number;
    totalQst?: number;
    grandTotal: number;
    totalHours: number;
    emailSent?: boolean;
    emailSentDate?: string;
    messageOnInvoice?: string;
    termsOnInvoice?: string;
  }
): Promise<InvoiceResponse> => {
  try {
    const invoiceData: Omit<InvoiceData, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId' | 'updatedByUserId' | 'version'> = {
      ...(frontendData.invoiceNumber && { invoiceNumber: frontendData.invoiceNumber }),
      clientId: frontendData.client.id,
      invoiceDate: frontendData.invoiceDate,
      dueDate: frontendData.dueDate,
      status: frontendData.status || 'draft',
      currency: frontendData.currency || 'CAD',
      subtotal: frontendData.subtotal,
      totalTax: frontendData.totalTax,
      totalHst: frontendData.totalHst || 0,
      totalGst: frontendData.totalGst || 0,
      totalQst: frontendData.totalQst || 0,
      grandTotal: frontendData.grandTotal,
      totalHours: frontendData.totalHours,
      emailSent: frontendData.emailSent || false,
      emailSentDate: frontendData.emailSentDate,
      documentGenerated: false, // Will be updated when PDF is generated
      invoiceData: {
        client: frontendData.client,
        timesheets: frontendData.timesheets,
        attachments: frontendData.attachments || [],
        messageOnInvoice: frontendData.messageOnInvoice,
        termsOnInvoice: frontendData.termsOnInvoice,
        document: {
          generated: false,
          filePath: null,
          fileName: null,
          fileSize: null,
          generatedAt: null,
          bucketName: 'invoices'
        },
        summary: {
          subtotal: frontendData.subtotal,
          totalTax: frontendData.totalTax,
          totalHst: frontendData.totalHst || 0,
          totalGst: frontendData.totalGst || 0,
          totalQst: frontendData.totalQst || 0,
          grandTotal: frontendData.grandTotal,
          totalHours: frontendData.totalHours,
          currency: frontendData.currency || 'CAD'
        }
      }
    };
    
    const result = await createInvoice(invoiceData);
    return result;
  } catch (error) {
    console.error("Error creating invoice from frontend data:", error);
    throw error;
  }
};

/**
 * Helper function to format invoice data for display
 */
export const formatInvoiceForDisplay = (invoice: InvoiceData) => {
  return {
    ...invoice,
    formattedInvoiceDate: new Date(invoice.invoiceDate).toLocaleDateString(),
    formattedDueDate: new Date(invoice.dueDate).toLocaleDateString(),
    formattedCreatedAt: invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : null,
    formattedUpdatedAt: invoice.updatedAt ? new Date(invoice.updatedAt).toLocaleDateString() : null,
    formattedGrandTotal: `$${invoice.grandTotal.toFixed(2)} ${invoice.currency || 'CAD'}`,
    formattedSubtotal: `$${invoice.subtotal.toFixed(2)} ${invoice.currency || 'CAD'}`,
    formattedTotalTax: `$${invoice.totalTax.toFixed(2)} ${invoice.currency || 'CAD'}`,
    clientDisplayName: invoice.client?.companyName || invoice.client?.shortCode || 'Unknown Client',
    statusDisplayName: (invoice.status?.charAt(0).toUpperCase() || '') + (invoice.status?.slice(1) || '') || 'Draft'
  };
};
