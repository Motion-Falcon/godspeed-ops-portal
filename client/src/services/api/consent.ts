import axios from "axios";
import { api, API_URL, clearCacheFor } from "./index";

// Consent Document Interface
export interface ConsentDocument {
  id: string;
  fileName: string;
  filePath: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  isActive: boolean;
  recipientType: 'client' | 'jobseeker_profile';
  totalRecipients: number;
  completedRecipients: number;
  uploader?: {
    id: string;
    email: string;
    name: string;
  };
}

// Consent Record Interface
export interface ConsentRecord {
  id: string;
  documentId: string;
  consentableId: string;
  consentableType: 'client' | 'jobseeker_profile';
  status: 'pending' | 'completed' | 'expired';
  consentToken: string;
  sentAt: string;
  completedAt?: string;
  consentedName?: string;
  ipAddress?: string;
  createdAt: string;
  updatedAt: string;
  entityName?: string;
  entityEmail?: string;
}

// Removed ClientOption and JobseekerOption interfaces - now defined in components where needed

// Request interfaces
export interface CreateConsentRequestData {
  fileName: string;
  filePath: string;
  recipientIds: string[];
  recipientType: 'client' | 'jobseeker_profile';
}

export interface ConsentDocumentPaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  fileNameFilter?: string;
  uploaderFilter?: string;
  statusFilter?: string;
  recipientTypeFilter?: string;
  dateFilter?: string;
}

export interface ConsentRecordPaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  statusFilter?: string;
  typeFilter?: string;
  nameFilter?: string;
  dateFilter?: string;
}

// Removed RecipientSelectionParams - no longer needed

// Response interfaces
export interface PaginatedConsentDocumentResponse {
  documents: ConsentDocument[];
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

export interface PaginatedConsentRecordResponse {
  document: ConsentDocument;
  records: ConsentRecord[];
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

export interface ConsentRequestResponse {
  success: boolean;
  message: string;
  document: ConsentDocument;
  recordCount: number;
}

export interface ResendConsentResponse {
  success: boolean;
  message: string;
  resentCount: number;
}

// Removed ClientsResponse and JobseekersResponse - using existing APIs directly

/**
 * Get all consent documents with pagination and filtering
 */
export const getConsentDocuments = async (
  params: ConsentDocumentPaginationParams = {}
): Promise<PaginatedConsentDocumentResponse> => {
  try {
    const url = new URL("/api/consent/documents", API_URL);

    // Add pagination and filter parameters
    if (params.page) url.searchParams.append("page", params.page.toString());
    if (params.limit) url.searchParams.append("limit", params.limit.toString());
    if (params.search) url.searchParams.append("search", params.search);
    if (params.fileNameFilter)
      url.searchParams.append("fileNameFilter", params.fileNameFilter);
    if (params.uploaderFilter)
      url.searchParams.append("uploaderFilter", params.uploaderFilter);
          if (params.statusFilter)
        url.searchParams.append("statusFilter", params.statusFilter);
      if (params.recipientTypeFilter)
        url.searchParams.append("recipientTypeFilter", params.recipientTypeFilter);
      if (params.dateFilter)
        url.searchParams.append("dateFilter", params.dateFilter);

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    console.error("Error fetching consent documents:", error);
    throw error;
  }
};

/**
 * Get consent records for a specific document with pagination and filtering
 */
export const getConsentRecords = async (
  documentId: string,
  params: ConsentRecordPaginationParams = {}
): Promise<PaginatedConsentRecordResponse> => {
  try {
    const url = new URL(`/api/consent/records/${documentId}`, API_URL);

    // Add pagination and filter parameters
    if (params.page) url.searchParams.append("page", params.page.toString());
    if (params.limit) url.searchParams.append("limit", params.limit.toString());
    if (params.search) url.searchParams.append("search", params.search);
    if (params.statusFilter)
      url.searchParams.append("statusFilter", params.statusFilter);
    if (params.typeFilter)
      url.searchParams.append("typeFilter", params.typeFilter);
    if (params.nameFilter)
      url.searchParams.append("nameFilter", params.nameFilter);
    if (params.dateFilter)
      url.searchParams.append("dateFilter", params.dateFilter);

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    console.error("Error fetching consent records:", error);
    throw error;
  }
};

/**
 * Create a new consent request
 */
export const createConsentRequest = async (
  requestData: CreateConsentRequestData
): Promise<ConsentRequestResponse> => {
  try {
    const response = await api.post("/api/consent/request", requestData);
    // Clear cache for consent documents list
    clearCacheFor("/api/consent/documents");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to create consent request");
    }
    throw error;
  }
};

/**
 * Resend consent emails
 */
export const resendConsentEmails = async (
  recordIds: string[]
): Promise<ResendConsentResponse> => {
  try {
    const response = await api.post("/api/consent/resend", { recordIds });
    // Clear cache for related consent records
    clearCacheFor("/api/consent/records");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to resend consent emails");
    }
    throw error;
  }
};

// Public consent API functions (no authentication required)

/**
 * View consent document using token
 */
export const viewConsentByToken = async (token: string) => {
  try {
    const response = await axios.get(`${API_URL}/api/consent/view?token=${token}`);
    return response.data;
  } catch (error) {
    console.error('Error viewing consent:', error);
    throw new Error('Failed to view consent document');
  }
};

/**
 * Submit consent using token
 */
export const submitConsent = async (token: string, consentedName: string) => {
  try {
    const response = await axios.post(`${API_URL}/api/consent/submit`, {
      token,
      consentedName
    });
    return response.data;
  } catch (error) {
    console.error('Error submitting consent:', error);
    throw new Error('Failed to submit consent');
  }
};

// Interface for consent record with document details
export interface ConsentRecordWithDocument {
  id: string;
  document_id: string;
  consentable_id: string;
  consentable_type: 'client' | 'jobseeker_profile';
  status: 'pending' | 'completed' | 'expired';
  consent_token: string;
  sent_at: string;
  completed_at?: string;
  consented_name?: string;
  ip_address?: string;
  created_at: string;
  updated_at: string;
  consent_documents: {
    id: string;
    file_name: string;
    file_path: string;
    uploaded_by: string;
    created_at: string;
    updated_at: string;
    version: number;
    is_active: boolean;
  };
}

export interface ConsentRecordsPaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  statusFilter?: string;
  consentableType?: 'client' | 'jobseeker_profile';
}

export interface PaginatedConsentRecordsResponse {
  records: ConsentRecordWithDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Get consent records for a specific entity (jobseeker or client)
export const getConsentRecordsByEntity = async (
  consentableId: string,
  params: ConsentRecordsPaginationParams = {}
): Promise<PaginatedConsentRecordsResponse> => {
  try {
    const url = new URL(`/api/consent/entity-records/${consentableId}`, API_URL);
    
    // Add pagination and filter parameters
    if (params.page) url.searchParams.append('page', params.page.toString());
    if (params.limit) url.searchParams.append('limit', params.limit.toString());
    if (params.search) url.searchParams.append('search', params.search);
    if (params.statusFilter) url.searchParams.append('statusFilter', params.statusFilter);
    if (params.consentableType) url.searchParams.append('consentableType', params.consentableType);

    const response = await api.get(url.pathname + url.search);

    return {
      records: response.data.records,
      pagination: response.data.pagination
    };
  } catch (error) {
    console.error('Error fetching consent records:', error);
    throw new Error('Failed to fetch consent records');
  }
};

// Removed getClientsForSelection and getJobseekersForSelection - using existing APIs directly in components
