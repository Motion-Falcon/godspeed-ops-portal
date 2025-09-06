import axios from "axios";
import { api, API_URL } from "./index";

// Jobseeker Metrics API functions

// Type definitions matching the backend response
export interface Assignment {
  id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
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

export interface CandidateInfo {
  id: string;
  firstName: string;
  lastName: string;
}

export interface JobseekerMetricsResponse {
  candidate: CandidateInfo;
  metrics: Metric[];
}

// Query parameters interface
export interface MetricsQueryParams {
  timeRange?: string; // Number of months to look back (default: "12")
}

/**
 * Get comprehensive dashboard metrics for a specific jobseeker
 * @param candidateId - The ID of the candidate
 * @param params - Query parameters (timeRange)
 * @returns Promise<JobseekerMetricsResponse>
 */
export const getJobseekerMetrics = async (
  candidateId: string,
  params: MetricsQueryParams = {}
): Promise<JobseekerMetricsResponse> => {
  try {
    const url = new URL(`/api/metrics/jobseekers/${candidateId}`, API_URL);

    // Add query parameters
    if (params.timeRange) {
      url.searchParams.append("timeRange", params.timeRange);
    }

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch jobseeker metrics"
      );
    }
    throw error;
  }
};

// Expiry Status Counts Types
export interface ExpiryStatusCounts {
  expired: number;
  expiringUnder30: number;
  expiringUnder60: number;
  expiringUnder90: number;
  expiringAfter90: number;
  noData: number;
  totalWithData: number;
}

export interface ExpiryStatusSummary {
  criticalCount: number;
  urgentCount: number;
  warningCount: number;
  cautionCount: number;
}

export interface ExpiryStatusResponse {
  totalProfiles: number;
  sin: ExpiryStatusCounts;
  workPermit: ExpiryStatusCounts;
  summary: ExpiryStatusSummary;
  generatedAt: string;
}

/**
 * Get expiry status counts for SIN and Work Permit documents
 * @returns Promise<ExpiryStatusResponse>
 */
export const getExpiryStatusCounts = async (): Promise<ExpiryStatusResponse> => {
  try {
    const response = await api.get("/api/metrics/jobseekers/expiry-status-counts");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch expiry status counts"
      );
    }
    throw error;
  }
};