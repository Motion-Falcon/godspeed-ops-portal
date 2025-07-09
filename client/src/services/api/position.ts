import axios, { AxiosRequestConfig } from "axios";
import { api, clearCacheFor } from "./index";

export interface PositionData {
  id?: string;

  // Basic Details
  client?: string; // Client ID
  clientName?: string; // For display only
  title?: string;
  positionCode?: string;
  startDate?: string;
  endDate?: string;
  showOnJobPortal?: boolean;
  clientManager?: string;
  salesManager?: string;
  positionNumber?: string;
  description?: string;

  // Address Details
  streetAddress?: string;
  city?: string;
  province?: string;
  postalCode?: string;

  // Employment Categorization
  employmentTerm?: string; // Permanent/Contract/Temporary
  employmentType?: string; // Full-Time/Part-Time
  positionCategory?: string; // Admin/AZ/etc.
  experience?: string;

  // Documents Required
  documentsRequired?: {
    license?: boolean;
    driverAbstract?: boolean;
    tdgCertificate?: boolean;
    sin?: boolean;
    immigrationStatus?: boolean;
    passport?: boolean;
    cvor?: boolean;
    resume?: boolean;
    articlesOfIncorporation?: boolean;
    directDeposit?: boolean;
  };

  // Position Details
  payrateType?: string; // Hourly/Daily/Monthly
  numberOfPositions?: number;
  regularPayRate?: string;
  markup?: string;
  billRate?: string;

  // Overtime
  overtimeEnabled?: boolean;
  overtimeHours?: string;
  overtimeBillRate?: string;
  overtimePayRate?: string;

  // Payment & Billings
  preferredPaymentMethod?: string;
  terms?: string;

  // Notes & Task
  notes?: string;
  assignedTo?: string;
  projCompDate?: string;
  taskTime?: string;

  // Assignment Management
  assignedJobseekers?: string[];

  // Metadata
  isDraft?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastUpdated?: string;
}

export interface PositionResponse {
  success: boolean;
  message: string;
  position: PositionData;
}

export interface PositionDraftResponse {
  draft: PositionData | null;
  lastUpdated: string | null;
}

export interface PositionDraft {
  id: string;
  userId: string;
  title?: string;
  clientName?: string;
  positionCode?: string;
  positionNumber?: string;
  startDate?: string;
  showOnJobPortal?: boolean;
  createdAt: string;
  lastUpdated: string;
  createdByUserId: string;
  updatedAt: string;
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


export interface PositionPaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  positionIdFilter?: string;
  titleFilter?: string;
  clientFilter?: string;
  locationFilter?: string;
  employmentTermFilter?: string;
  employmentTypeFilter?: string;
  positionCategoryFilter?: string;
  experienceFilter?: string;
  showOnPortalFilter?: string;
  dateFilter?: string;
}

export interface PaginatedPositionResponse {
  positions: PositionData[];
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

export interface PositionDraftPaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  jobTitleFilter?: string;
  creatorFilter?: string;
  updaterFilter?: string;
  dateFilter?: string;
  createdDateFilter?: string;
}
export interface PositionDraftFilters {
  page?: number;
  limit?: number;
  search?: string;
  titleFilter?: string;
  clientFilter?: string;
  positionIdFilter?: string;
  positionCodeFilter?: string;
  creatorFilter?: string;
  updaterFilter?: string;
  dateFilter?: string;
  createdDateFilter?: string;
  startDateFilter?: string;
}

export interface PaginatedPositionDraftResponse {
  drafts: PositionDraft[];
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

export interface CandidatePaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  statusFilter?: string;
  positionFilter?: string;
  dateFilter?: string;
}

export interface PaginatedCandidateResponse {
  assignments: CandidateAssignment[];
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

// Generate position code for a client
export const generatePositionCode = async (
  clientId: string
): Promise<{ positionCode: string; clientShortCode: string }> => {
  try {
    const response = await api.get(`/api/positions/generate-code/${clientId}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to generate position code"
      );
    }
    throw error;
  }
};

export const getPosition = async (id: string): Promise<PositionData> => {
  try {
    const response = await api.get(`/api/positions/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch position");
    }
    throw error;
  }
};

export const getPositions = async (
  params: PositionPaginationParams = {}
): Promise<PaginatedPositionResponse> => {
  try {
    const config: AxiosRequestConfig = {
      method: "GET",
      url: "/api/positions",
      params: {
        page: params.page || 1,
        limit: params.limit || 10,
        ...(params.search && { search: params.search }),
        ...(params.positionIdFilter && { positionIdFilter: params.positionIdFilter }),
        ...(params.titleFilter && { titleFilter: params.titleFilter }),
        ...(params.clientFilter && { clientFilter: params.clientFilter }),
        ...(params.locationFilter && { locationFilter: params.locationFilter }),
        ...(params.employmentTermFilter &&
          params.employmentTermFilter !== "all" && {
            employmentTermFilter: params.employmentTermFilter,
          }),
        ...(params.employmentTypeFilter &&
          params.employmentTypeFilter !== "all" && {
            employmentTypeFilter: params.employmentTypeFilter,
          }),
        ...(params.positionCategoryFilter &&
          params.positionCategoryFilter !== "all" && {
            positionCategoryFilter: params.positionCategoryFilter,
          }),
        ...(params.experienceFilter &&
          params.experienceFilter !== "all" && {
            experienceFilter: params.experienceFilter,
          }),
        ...(params.showOnPortalFilter &&
          params.showOnPortalFilter !== "all" && {
            showOnPortalFilter: params.showOnPortalFilter,
          }),
        ...(params.dateFilter && { dateFilter: params.dateFilter }),
      },
    };

    const response = await api.get("/api/positions", config);
    return response.data;
  } catch (error) {
    console.error("Error fetching positions:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch positions");
    }
    throw error;
  }
};

export const createPosition = async (
  positionData: PositionData
): Promise<PositionResponse> => {
  try {
    const response = await api.post("/api/positions", positionData);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to create position");
    }
    throw error;
  }
};

export const updatePosition = async (
  id: string,
  positionData: PositionData
): Promise<PositionResponse> => {
  console.log(`Attempting to update position with ID ${id}`, positionData);
  try {
    console.log(`Making PUT request to /api/positions/${id}`);
    const response = await api.put(`/api/positions/${id}`, positionData);
    console.log("Update position response:", response);

    // Clear cache for this position and the positions list
    clearCacheFor(`/api/positions/${id}`);
    clearCacheFor("/api/positions");
    return response.data;
  } catch (error) {
    console.error("Error updating position:", error);
    if (axios.isAxiosError(error) && error.response) {
      console.error("Server error details:", error.response.data);
      throw new Error(error.response.data.error || "Failed to update position");
    }
    throw error;
  }
};

export const deletePosition = async (
  id: string
): Promise<{ success: boolean; message: string; deletedId: string }> => {
  try {
    const response = await api.delete(`/api/positions/${id}`);
    // Clear cache for positions list after deletion
    clearCacheFor("/api/positions");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to delete position");
    }
    throw error;
  }
};

// Position drafts management
export const savePositionDraft = async (
  draftData: Partial<PositionData>
): Promise<PositionDraftResponse> => {
  try {
    // For creating new drafts or updating drafts without an ID
    if (!draftData.id) {
      const response = await api.post("/api/positions/draft", draftData);
      return response.data;
    }

    // For updating existing drafts
    const response = await api.put(
      `/api/positions/draft/${draftData.id}`,
      draftData
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to save position draft"
      );
    }
    throw error;
  }
};

export const getPositionDraft = async (): Promise<PositionDraftResponse> => {
  try {
    const response = await api.get("/api/positions/draft");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch position draft"
      );
    }
    throw error;
  }
};

export const getPositionDraftById = async (
  id: string
): Promise<PositionDraftResponse> => {
  try {
    const response = await api.get(`/api/positions/draft/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch position draft"
      );
    }
    throw error;
  }
};
export const getAllPositionDrafts = async (
  filters?: PositionDraftFilters
): Promise<PaginatedPositionDraftResponse> => {
  try {
    const queryParams = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          queryParams.append(key, value.toString());
        }
      });
    }

    const queryString = queryParams.toString();
    const url = queryString
      ? `/api/positions/drafts?${queryString}`
      : `/api/positions/drafts`;

    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching position drafts:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch position drafts"
      );
    }
    throw error;
  }
};

export const deletePositionDraft = async (
  id: string
): Promise<{ success: boolean; message: string; deletedId: string }> => {
  try {
    const response = await api.delete(`/api/positions/draft/${id}`);
    // Clear cache for drafts list after deletion
    clearCacheFor("/api/positions/drafts");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to delete position draft"
      );
    }
    throw error;
  }
};
// Position Candidates API
export interface PositionCandidate {
  id: string;
  candidateId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  mobile?: string;
  bio?: string;
  experience?: string;
  weekendAvailability?: boolean;
  availability?: string;
  similarityScore: number;
  isAvailable: boolean;
  status: string;
}

export interface PositionCandidateFilters {
  page?: number;
  limit?: number;
  search?: string;
  nameFilter?: string;
  emailFilter?: string;
  phoneFilter?: string;
  experienceFilter?: string;
  availabilityFilter?: string;
  weekendAvailabilityFilter?: string;
  cityFilter?: string;
  provinceFilter?: string;
  onlyAvailable?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface PaginatedCandidateResponse {
  candidates: PositionCandidate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalFiltered: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  positionId: string;
  position?: PositionData | null;
  filters?: PositionCandidateFilters;
}

// Position Candidates API
export const getPositionCandidates = async (
  positionId: string,
  params: PositionCandidateFilters = {}
): Promise<PaginatedCandidateResponse> => {
  try {
    const queryParams = new URLSearchParams();

    // Add pagination params
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());

    // Add filter params
    if (params.search) queryParams.append("search", params.search);
    if (params.nameFilter) queryParams.append("nameFilter", params.nameFilter);
    if (params.emailFilter)
      queryParams.append("emailFilter", params.emailFilter);
    if (params.phoneFilter)
      queryParams.append("phoneFilter", params.phoneFilter);
    if (params.experienceFilter)
      queryParams.append("experienceFilter", params.experienceFilter);
    if (params.availabilityFilter)
      queryParams.append("availabilityFilter", params.availabilityFilter);
    if (params.weekendAvailabilityFilter)
      queryParams.append(
        "weekendAvailabilityFilter",
        params.weekendAvailabilityFilter
      );
    if (params.cityFilter) queryParams.append("cityFilter", params.cityFilter);
    if (params.provinceFilter)
      queryParams.append("provinceFilter", params.provinceFilter);
    if (params.onlyAvailable)
      queryParams.append("onlyAvailable", params.onlyAvailable);
    if (params.sortBy) queryParams.append("sortBy", params.sortBy);
    if (params.sortOrder) queryParams.append("sortOrder", params.sortOrder);

    const response = await api.get(
      `/api/jobseekers/position-candidates/${positionId}?${queryParams.toString()}`
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch position candidates"
      );
    }
    throw error;
  }
};
/**
 * Assign candidate to position
 */

// Helper function to transform position data from snake_case to camelCase
const transformPositionData = (data: Record<string, unknown>): PositionData => {
  if (!data) return data as PositionData;

  return {
    ...data,
    numberOfPositions: data.number_of_positions as number,
    assignedJobseekers: data.assigned_jobseekers as string[],
    // Keep both formats for compatibility
    number_of_positions: data.number_of_positions,
    assigned_jobseekers: data.assigned_jobseekers,
  } as PositionData;
};

export const assignCandidateToPosition = async (
  positionId: string,
  candidateId: string,
  startDate: string,
  endDate: string
): Promise<{
  success: boolean;
  message: string;
  assignedJobseekers: string[];
  position: PositionData;
  assignment?: Record<string, unknown>;
}> => {
  try {
    const response = await api.post(`/api/positions/${positionId}/assign`, {
      candidateId,
      startDate,
      endDate,
    });

    // Clear cache for position assignments after successful assignment
    if (response.data.success) {
      clearCacheFor(`/api/positions/${positionId}/assignments`);
      clearCacheFor("/api/positions");
      clearCacheFor(`/api/jobseekers/position-candidates/${positionId}`);
    }

    return {
      success: response.data.success,
      message: response.data.message,
      assignedJobseekers: response.data.assignedJobseekers,
      position: transformPositionData(response.data.position),
      assignment: response.data.assignment,
    };
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: { error?: string } } };
    console.error("Error assigning candidate to position:", error);
    return {
      success: false,
      message: axiosError.response?.data?.error || "Failed to assign candidate",
      assignedJobseekers: [],
      position: {} as PositionData,
    };
  }
};

/**
 * Remove candidate from position
 */
export const removeCandidateFromPosition = async (
  positionId: string,
  candidateId: string
): Promise<{
  success: boolean;
  message: string;
  assignedJobseekers: string[];
  position: PositionData;
}> => {
  try {
    const response = await api.delete(
      `/api/positions/${positionId}/assign/${candidateId}`
    );

    // Clear cache for position assignments after successful removal
    if (response.data.success) {
      clearCacheFor(`/api/positions/${positionId}/assignments`);
      clearCacheFor("/api/positions");
      clearCacheFor(`/api/jobseekers/position-candidates/${positionId}`);
    }

    return {
      success: response.data.success,
      message: response.data.message,
      assignedJobseekers: response.data.assignedJobseekers,
      position: transformPositionData(response.data.position),
    };
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: { error?: string } } };
    console.error("Error removing candidate from position:", error);
    return {
      success: false,
      message: axiosError.response?.data?.error || "Failed to remove candidate",
      assignedJobseekers: [],
      position: {} as PositionData,
    };
  }
};

export interface AssignmentRecord {
  id: string;
  candidate_id: string;
  start_date: string;
  end_date?: string;
  status: "active" | "completed" | "upcoming" | "cancelled";
  updated_at: string;
  created_at: string;
  jobseekerProfile?: {
    employee_id: string;
    id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    mobile?: string;
  };
}
export const getPositionAssignments = async (
  positionId: string
): Promise<{
  success: boolean;
  assignments: AssignmentRecord[];
}> => {
  try {
    const response = await api.get(`/api/positions/${positionId}/assignments`);

    return {
      success: response.data.success,
      assignments: response.data.assignments || [],
    };
  } catch (error: unknown) {
    console.error("Error fetching position assignments:", error);
    return {
      success: false,
      assignments: [],
    };
  }
};

export interface CandidateAssignment {
  id: string;
  positionId: string;
  candidateId: string;
  startDate: string;
  endDate?: string;
  status: "active" | "completed" | "upcoming" | "cancelled";
  createdAt: string;
  updatedAt: string;
  position?: {
    id: string;
    positionCode: string;
    title: string;
    clientName: string;
    city: string;
    province: string;
    employmentTerm: string;
    employmentType: string;
    positionCategory: string;
    experience: string;
    showOnJobPortal: boolean;
    startDate: string;
    endDate?: string;
    regularPayRate: string;
    billRate: string;
    numberOfPositions: number;
  } | null;
}

export interface CandidateAssignmentsResponse {
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  statusCounts: {
    active: number;
    completed: number;
    upcoming: number;
    total: number;
  };
  assignments: CandidateAssignment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CandidateAssignmentFilters {
  page?: number;
  limit?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  employmentType?: string;
  positionCategory?: string;
}

// Get candidate assignments for a specific candidate
export const getCandidateAssignments = async (
  candidateId: string,
  params: CandidateAssignmentFilters = {}
): Promise<CandidateAssignmentsResponse> => {
  try {
    const queryParams = new URLSearchParams();

    // Add pagination params
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());

    // Add filter params
    if (params.status) queryParams.append("status", params.status);
    if (params.startDate) queryParams.append("startDate", params.startDate);
    if (params.endDate) queryParams.append("endDate", params.endDate);
    if (params.search) queryParams.append("search", params.search);
    if (params.employmentType) queryParams.append("employmentType", params.employmentType);
    if (params.positionCategory) queryParams.append("positionCategory", params.positionCategory);

    const response = await api.get(
      `/api/positions/candidate/${candidateId}/assignments?${queryParams.toString()}`
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch candidate assignments"
      );
    }
    throw error;
  }
};



// Client Positions Interface and API
export interface ClientPositionFilters {
  page?: number;
  limit?: number;
  search?: string;
  positionIdFilter?: string;
  titleFilter?: string;
  locationFilter?: string;
  employmentTermFilter?: string;
  employmentTypeFilter?: string;
  positionCategoryFilter?: string;
  experienceFilter?: string;
  showOnPortalFilter?: string;
  dateFilter?: string;
}

export interface ClientPositionsResponse {
  positions: PositionData[];
  client: {
    id: string;
    companyName: string;
    clientManager: string;
    accountingPerson: string;
    salesPerson: string;
  };
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

export const getClientPositions = async (
  clientId: string,
  params: ClientPositionFilters = {}
): Promise<ClientPositionsResponse> => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, value.toString());
      }
    });

    const url = `/api/positions/client/${clientId}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch client positions");
    }
    throw error;
  }
};
