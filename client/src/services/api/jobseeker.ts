import axios, { AxiosRequestConfig } from "axios";
import { api, clearCacheFor } from "./index";
import {
  JobSeekerProfile,
  JobSeekerDetailedProfile,
} from "../../types/jobseeker";
import { ProfileData } from "./profile";

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  nameFilter?: string;
  emailFilter?: string;
  phoneFilter?: string;
  locationFilter?: string;
  experienceFilter?: string;
  statusFilter?: string;
  dateFilter?: string;
  employeeIdFilter?: string;
  sinNumberFilter?: string;
  sinExpiryFilter?: string;
  workPermitUciFilter?: string;
  workPermitExpiryFilter?: string;
  sinExpiryStatusFilter?: string;
  workPermitExpiryStatusFilter?: string;
}

export interface PaginatedJobSeekerResponse {
  profiles: JobSeekerProfile[];
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

export const getJobseekerProfiles = async (
  params: PaginationParams = {}
): Promise<PaginatedJobSeekerResponse> => {
  try {
    const config: AxiosRequestConfig = {
      method: "GET",
      url: "/api/jobseekers",
      params: {
        page: params.page || 1,
        limit: params.limit || 10,
        ...(params.search && { search: params.search }),
        ...(params.nameFilter && { nameFilter: params.nameFilter }),
        ...(params.emailFilter && { emailFilter: params.emailFilter }),
        ...(params.phoneFilter && { phoneFilter: params.phoneFilter }),
        ...(params.locationFilter && { locationFilter: params.locationFilter }),
        ...(params.employeeIdFilter && {
          employeeIdFilter: params.employeeIdFilter,
        }),
        ...(params.experienceFilter &&
          params.experienceFilter !== "all" && {
            experienceFilter: params.experienceFilter,
          }),
        ...(params.statusFilter &&
          params.statusFilter !== "all" && {
            statusFilter: params.statusFilter,
          }),
        ...(params.dateFilter && { dateFilter: params.dateFilter }),
        ...(params.sinNumberFilter && { sinNumberFilter: params.sinNumberFilter }),
        ...(params.sinExpiryFilter && { sinExpiryFilter: params.sinExpiryFilter }),
        ...(params.workPermitUciFilter && { workPermitUciFilter: params.workPermitUciFilter }),
        ...(params.workPermitExpiryFilter && { workPermitExpiryFilter: params.workPermitExpiryFilter }),
        ...(params.sinExpiryStatusFilter &&
          params.sinExpiryStatusFilter !== "all" && {
            sinExpiryStatusFilter: params.sinExpiryStatusFilter,
          }),
        ...(params.workPermitExpiryStatusFilter &&
          params.workPermitExpiryStatusFilter !== "all" && {
            workPermitExpiryStatusFilter: params.workPermitExpiryStatusFilter,
          }),
      },
    };

    const response = await api.get("/api/jobseekers", config);
    return response.data;
  } catch (error) {
    console.error("Error fetching jobseeker profiles:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch jobseeker profiles"
      );
    }
    throw error;
  }
};

export const getJobseekerProfile = async (
  id: string
): Promise<JobSeekerDetailedProfile> => {
  try {
    const response = await api.get(`/api/jobseekers/profile/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch jobseeker profile"
      );
    }
    throw error;
  }
};

export const updateJobseekerStatus = async (
  id: string,
  status: "pending" | "verified" | "rejected",
  rejectionReason: string | null = null
) => {
  try {
    const response = await api.put(`/api/jobseekers/profile/${id}/status`, {
      status,
      rejectionReason,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to update jobseeker status"
      );
    }
    throw error;
  }
};

// Add delete jobseeker function
export const deleteJobseeker = async (
  id: string
): Promise<{ message: string; deletedId: string }> => {
  try {
    const response = await api.delete(`/api/jobseekers/profile/${id}`);
    // Clear cache for jobseeker list after deletion
    clearCacheFor("/api/jobseekers");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to delete jobseeker profile"
      );
    }
    throw error;
  }
};

// Add JobseekerProfileDraftResponse type
export interface JobseekerDraftResponse {
  draft: ProfileData;
  currentStep: number;
  lastUpdated: string | null;
  email?: string;
  title?: string;
  createdAt?: string;
  createdByUserId?: string;
  updatedAt?: string;
  updatedByUserId?: string;
}

export interface JobseekerDraft {
  id: string;
  user_id: string;
  data: Record<string, unknown>;
  email: string;
  lastUpdated: string;
  createdAt: string;
  createdByUserId: string;
  updatedAt: string;
  updatedByUserId: string;
}

// Add pagination parameters interface for drafts
export interface DraftPaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  emailFilter?: string;
  creatorFilter?: string;
  updaterFilter?: string;
  dateFilter?: string;
  createdDateFilter?: string;
}

// Add paginated response interface for drafts
export interface PaginatedDraftResponse {
  drafts: JobseekerDraft[];
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

// Add new functions for jobseeker profile drafts
export const getAllJobseekerDrafts = async (
  params: DraftPaginationParams = {}
): Promise<PaginatedDraftResponse> => {
  try {
    // Build query parameters
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.emailFilter)
      queryParams.append("emailFilter", params.emailFilter);
    if (params.creatorFilter)
      queryParams.append("creatorFilter", params.creatorFilter);
    if (params.updaterFilter)
      queryParams.append("updaterFilter", params.updaterFilter);
    if (params.dateFilter) queryParams.append("dateFilter", params.dateFilter);
    if (params.createdDateFilter)
      queryParams.append("createdDateFilter", params.createdDateFilter);

    const response = await api.get(
      `/api/jobseekers/drafts?${queryParams.toString()}`
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch jobseeker drafts"
      );
    }
    throw error;
  }
};

export const getJobseekerDraft = async (
  id: string
): Promise<JobseekerDraftResponse> => {
  try {
    const response = await api.get(`/api/jobseekers/drafts/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch jobseeker draft"
      );
    }
    throw error;
  }
};

export const saveJobseekerDraft = async (
  draftData: Partial<ProfileData>
): Promise<{
  id: string;
  lastUpdated: string;
  email?: string;
  title?: string;
  createdAt?: string;
  createdByUserId?: string;
  updatedAt?: string;
  updatedByUserId?: string;
}> => {
  try {
    // Make sure email is included in the top level if it exists in the data
    const requestData = {
      ...draftData,
      email: draftData.email, // Ensure email is explicitly included
    };

    // For creating new drafts or updating drafts without an ID
    if (!draftData.id) {
      const response = await api.post("/api/jobseekers/drafts", requestData);
      return response.data.draft;
    }

    // For updating existing drafts
    const response = await api.put(
      `/api/jobseekers/drafts/${draftData.id}`,
      requestData
    );
    return response.data.draft;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to save jobseeker draft"
      );
    }
    throw error;
  }
};

export const deleteJobseekerDraft = async (
  id: string
): Promise<{ deletedId: string }> => {
  try {
    const response = await api.delete(`/api/jobseekers/drafts/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to delete jobseeker draft"
      );
    }
    throw error;
  }
};
