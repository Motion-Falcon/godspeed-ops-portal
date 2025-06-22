import axios from "axios";
import { api, API_URL } from "./index";

// Recruiter Metrics API functions

// Type definitions matching the backend response
export interface JobseekerProfile {
  id: string;
  verification_status: string;
  created_at: string;
  created_by_user_id: string | null;
}

export interface Client {
  id: string;
  company_name: string;
  created_at: string;
  created_by_user_id: string | null;
}

export interface HistoricalDataPoint {
  period: string;
  value: number;
  date: Date | string;
}

export interface Metric {
  id: string;
  label: string;
  currentValue: number;
  previousValue: number;
  unit: string;
  formatType: string;
  description: string;
  historicalData: HistoricalDataPoint[];
}

export interface RecruiterInfo {
  id: string;
  email: string;
  name: string;
}

export interface TimeRange {
  months: number;
  startDate: string;
  endDate: string;
}

export interface RecruiterMetricsResponse {
  metrics: Metric[];
  timeRange: TimeRange;
  scope: "recruiter-specific" | "all-recruiters";
  recruiter?: RecruiterInfo; // Only included when specific recruiter is requested
}

export interface ClientMetricsResponse {
  metrics: Metric[];
  timeRange: TimeRange;
  scope: "recruiter-specific" | "all-recruiters";
  recruiter?: RecruiterInfo; // Only included when specific recruiter is requested
}

// Query parameters interface
export interface MetricsQueryParams {
  timeRange?: string; // Number of months to look back (default: "12")
}

/**
 * Get comprehensive dashboard metrics for all recruiters (total data)
 * @param params - Query parameters (timeRange)
 * @returns Promise<RecruiterMetricsResponse>
 */
export const getAllRecruitersMetrics = async (
  params: MetricsQueryParams = {}
): Promise<RecruiterMetricsResponse> => {
  try {
    const url = new URL(`/api/metrics/recruiters`, API_URL);

    // Add query parameters
    if (params.timeRange) {
      url.searchParams.append("timeRange", params.timeRange);
    }

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch recruiter metrics"
      );
    }
    throw error;
  }
};

/**
 * Get comprehensive dashboard metrics for a specific recruiter
 * @param recruiterId - The ID of the recruiter
 * @param params - Query parameters (timeRange)
 * @returns Promise<RecruiterMetricsResponse>
 */
export const getRecruiterMetrics = async (
  recruiterId: string,
  params: MetricsQueryParams = {}
): Promise<RecruiterMetricsResponse> => {
  try {
    const url = new URL(`/api/metrics/recruiters/${recruiterId}`, API_URL);

    // Add query parameters
    if (params.timeRange) {
      url.searchParams.append("timeRange", params.timeRange);
    }

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch recruiter metrics"
      );
    }
    throw error;
  }
};

/**
 * Get comprehensive client metrics for all recruiters (total data)
 * @param params - Query parameters (timeRange)
 * @returns Promise<ClientMetricsResponse>
 */
export const getAllRecruitersClientMetrics = async (
  params: MetricsQueryParams = {}
): Promise<ClientMetricsResponse> => {
  try {
    const url = new URL(`/api/metrics/recruiters/clients`, API_URL);

    // Add query parameters
    if (params.timeRange) {
      url.searchParams.append("timeRange", params.timeRange);
    }

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch client metrics"
      );
    }
    throw error;
  }
};

/**
 * Get comprehensive client metrics for a specific recruiter
 * @param recruiterId - The ID of the recruiter
 * @param params - Query parameters (timeRange)
 * @returns Promise<ClientMetricsResponse>
 */
export const getRecruiterClientMetrics = async (
  recruiterId: string,
  params: MetricsQueryParams = {}
): Promise<ClientMetricsResponse> => {
  try {
    const url = new URL(`/api/metrics/recruiters/clients/${recruiterId}`, API_URL);

    // Add query parameters
    if (params.timeRange) {
      url.searchParams.append("timeRange", params.timeRange);
    }

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch recruiter client metrics"
      );
    }
    throw error;
  }
};

export interface Position {
  id: string;
  title: string;
  number_of_positions: number;
  created_at: string;
  created_by_user_id: string;
}

export interface Assignment {
  id: string;
  position_id: string;
  candidate_id: string;
  status: string;
  created_at: string;
  created_by_user_id: string;
}

export interface PositionMetricsResponse {
  metrics: Metric[];
  timeRange: TimeRange;
  scope: "recruiter-specific" | "all-recruiters";
  recruiter?: RecruiterInfo; // Only included when specific recruiter is requested
}

/**
 * Get comprehensive position metrics for all recruiters (total data)
 * @param params - Query parameters (timeRange)
 * @returns Promise<PositionMetricsResponse>
 */
export const getAllRecruitersPositionMetrics = async (
  params: MetricsQueryParams = {}
): Promise<PositionMetricsResponse> => {
  try {
    const url = new URL(`/api/metrics/recruiters/positions`, API_URL);

    // Add query parameters
    if (params.timeRange) {
      url.searchParams.append("timeRange", params.timeRange);
    }

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch position metrics"
      );
    }
    throw error;
  }
};

/**
 * Get comprehensive position metrics for a specific recruiter
 * @param recruiterId - The ID of the recruiter
 * @param params - Query parameters (timeRange)
 * @returns Promise<PositionMetricsResponse>
 */
export const getRecruiterPositionMetrics = async (
  recruiterId: string,
  params: MetricsQueryParams = {}
): Promise<PositionMetricsResponse> => {
  try {
    const url = new URL(`/api/metrics/recruiters/positions/${recruiterId}`, API_URL);

    // Add query parameters
    if (params.timeRange) {
      url.searchParams.append("timeRange", params.timeRange);
    }

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch recruiter position metrics"
      );
    }
    throw error;
  }
}; 