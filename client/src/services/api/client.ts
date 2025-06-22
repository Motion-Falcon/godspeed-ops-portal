import axios from "axios";
import { api, API_URL, clearCacheFor } from "./index";

// Client management API functions
export interface ClientData {
  id?: string;
  companyName?: string;
  billingName?: string;
  shortCode?: string;
  listName?: string;
  website?: string;
  clientManager?: string;
  salesPerson?: string;
  accountingPerson?: string;
  mergeInvoice?: boolean;
  currency?: string;
  workProvince?: string;

  // Contact Details
  contactPersonName1?: string;
  emailAddress1?: string;
  mobile1?: string;
  contactPersonName2?: string;
  emailAddress2?: string;
  invoiceCC2?: boolean;
  mobile2?: string;
  contactPersonName3?: string;
  emailAddress3?: string;
  invoiceCC3?: boolean;
  mobile3?: string;
  dispatchDeptEmail?: string;
  invoiceCCDispatch?: boolean;
  accountsDeptEmail?: string;
  invoiceCCAccounts?: boolean;
  invoiceLanguage?: string;

  // Address Details
  streetAddress1?: string;
  city1?: string;
  province1?: string;
  postalCode1?: string;
  streetAddress2?: string;
  city2?: string;
  province2?: string;
  postalCode2?: string;
  streetAddress3?: string;
  city3?: string;
  province3?: string;
  postalCode3?: string;

  // Payment & Billings
  preferredPaymentMethod?: string;
  terms?: string;
  payCycle?: string;
  creditLimit?: string;
  notes?: string;

  // Metadata
  isDraft?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastUpdated?: string;
}

export interface ClientResponse {
  success: boolean;
  message: string;
  client: ClientData;
}

export interface ClientDraftResponse {
  draft: ClientData | null;
  lastUpdated: string | null;
}

// Add client pagination parameters interface after the PositionDraftResponse interface
export interface ClientPaginationParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  companyNameFilter?: string;
  shortCodeFilter?: string;
  listNameFilter?: string;
  contactFilter?: string;
  emailFilter?: string;
  mobileFilter?: string;
  paymentMethodFilter?: string;
  paymentCycleFilter?: string;
}

export interface PaginatedClientResponse {
  clients: ClientData[];
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

export interface ClientDraftPaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  clientNameFilter?: string;
  creatorFilter?: string;
  updaterFilter?: string;
  dateFilter?: string;
  createdDateFilter?: string;
}

export interface PaginatedClientDraftResponse {
  drafts: ClientDraft[];
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

export const getClient = async (id: string): Promise<ClientData> => {
  try {
    const response = await api.get(`/api/clients/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch client");
    }
    throw error;
  }
};

export const getClients = async (
  params: ClientPaginationParams = {}
): Promise<PaginatedClientResponse> => {
  try {
    const url = new URL("/api/clients", API_URL);

    // Add pagination and filter parameters
    if (params.page) url.searchParams.append("page", params.page.toString());
    if (params.limit) url.searchParams.append("limit", params.limit.toString());
    if (params.searchTerm)
      url.searchParams.append("searchTerm", params.searchTerm);
    if (params.companyNameFilter)
      url.searchParams.append("companyNameFilter", params.companyNameFilter);
    if (params.shortCodeFilter)
      url.searchParams.append("shortCodeFilter", params.shortCodeFilter);
    if (params.listNameFilter)
      url.searchParams.append("listNameFilter", params.listNameFilter);
    if (params.contactFilter)
      url.searchParams.append("contactFilter", params.contactFilter);
    if (params.emailFilter)
      url.searchParams.append("emailFilter", params.emailFilter);
    if (params.mobileFilter)
      url.searchParams.append("mobileFilter", params.mobileFilter);
    if (params.paymentMethodFilter)
      url.searchParams.append(
        "paymentMethodFilter",
        params.paymentMethodFilter
      );
    if (params.paymentCycleFilter)
      url.searchParams.append("paymentCycleFilter", params.paymentCycleFilter);

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    console.error("Error fetching clients:", error);
    throw error;
  }
};

export const createClient = async (
  clientData: ClientData
): Promise<ClientResponse> => {
  try {
    const response = await api.post("/api/clients", clientData);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to create client");
    }
    throw error;
  }
};

export const updateClient = async (
  id: string,
  clientData: ClientData
): Promise<ClientResponse> => {
  try {
    const response = await api.put(`/api/clients/${id}`, clientData);
    // Clear cache for this client and the clients list
    clearCacheFor(`/api/clients/${id}`);
    clearCacheFor("/api/clients");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to update client");
    }
    throw error;
  }
};

export const deleteClient = async (
  id: string
): Promise<{ success: boolean; message: string; deletedId: string }> => {
  try {
    const response = await api.delete(`/api/clients/${id}`);
    // Clear cache for clients list after deletion
    clearCacheFor("/api/clients");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to delete client");
    }
    throw error;
  }
};

// Client drafts management
export interface ClientDraft {
  id: string;
  userId: string;
  companyName?: string;
  shortCode?: string;
  listName?: string;
  contactPersonName1?: string;
  createdAt: string;
  updatedAt: string;
  lastUpdated: string;
  createdByUserId: string;
  updatedByUserId: string;
  creatorDetails?: {
    id: string;
    email?: string;
    name: string;
    userType: string;
    createdAt: string;
  } | null;
  updaterDetails?: {
    id: string;
    email?: string;
    name: string;
    userType: string;
    updatedAt: string;
  } | null;
}

export interface ClientDraftPaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  companyNameFilter?: string;
  shortCodeFilter?: string;
  listNameFilter?: string;
  contactPersonFilter?: string;
  creatorFilter?: string;
  updaterFilter?: string;
  dateFilter?: string;
  createdDateFilter?: string;
}

export interface PaginatedClientDraftResponse {
  drafts: ClientDraft[];
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
export const saveClientDraft = async (
  draftData: Partial<ClientData>
): Promise<ClientDraftResponse> => {
  try {
    // For creating new drafts or updating drafts without an ID
    if (!draftData.id) {
      const response = await api.post("/api/clients/draft", draftData);
      return response.data;
    }

    // For updating existing drafts
    const response = await api.put(
      `/api/clients/draft/${draftData.id}`,
      draftData
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to save client draft"
      );
    }
    throw error;
  }
};

export const getClientDraft = async (): Promise<ClientDraftResponse> => {
  try {
    const response = await api.get("/api/clients/draft");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch client draft"
      );
    }
    throw error;
  }
};

export const getClientDraftById = async (
  id: string
): Promise<ClientDraftResponse> => {
  try {
    const response = await api.get(`/api/clients/draft/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch client draft"
      );
    }
    throw error;
  }
};

export const getAllClientDrafts = async (
  params: ClientDraftPaginationParams = {}
): Promise<PaginatedClientDraftResponse> => {
  try {
    const queryParams = new URLSearchParams();

    // Add all parameters to query string
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.companyNameFilter)
      queryParams.append("companyNameFilter", params.companyNameFilter);
    if (params.shortCodeFilter)
      queryParams.append("shortCodeFilter", params.shortCodeFilter);
    if (params.listNameFilter)
      queryParams.append("listNameFilter", params.listNameFilter);
    if (params.contactPersonFilter)
      queryParams.append("contactPersonFilter", params.contactPersonFilter);
    if (params.creatorFilter)
      queryParams.append("creatorFilter", params.creatorFilter);
    if (params.updaterFilter)
      queryParams.append("updaterFilter", params.updaterFilter);
    if (params.dateFilter) queryParams.append("dateFilter", params.dateFilter);
    if (params.createdDateFilter)
      queryParams.append("createdDateFilter", params.createdDateFilter);

    const response = await api.get(
      `/api/clients/drafts?${queryParams.toString()}`
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch client drafts"
      );
    }
    throw error;
  }
};

export const deleteClientDraft = async (
  id: string
): Promise<{ success: boolean; message: string; deletedId: string }> => {
  try {
    const response = await api.delete(`/api/clients/draft/${id}`);
    // Clear cache for drafts list after deletion
    clearCacheFor("/api/clients/drafts");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to delete client draft"
      );
    }
    throw error;
  }
};