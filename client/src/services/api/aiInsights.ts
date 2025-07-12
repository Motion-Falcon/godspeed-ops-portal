import axios from "axios";
import { api, API_URL } from "./index";

// AI Insights API functions

// Type definitions matching the backend response
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
  redirectTo: string;
}

export interface TimeRange {
  months: number;
  startDate: string;
  endDate: string;
}

// Basic AI insights response (non-metric card structure)
export interface AIInsightsResponse {
  totalDocumentsScanned: number;
  totalJobseekersMatched: number;
  lastUpdated: string;
  summary: {
    documentsScanned: {
      description: string;
      source: string;
    };
    jobseekersMatched: {
      description: string;
      source: string;
    };
  };
}

// Time-filtered AI insights response (metric card structure)
export interface AIInsightsMetricsResponse {
  metrics: Metric[];
  timeRange: TimeRange;
  scope: string;
}

// Query parameters interface
export interface AIInsightsQueryParams {
  months?: string; // Number of months to look back (default: "12")
}

/**
 * Get basic AI insights (simple format)
 * @returns Promise<AIInsightsResponse>
 */
export const getAIInsights = async (): Promise<AIInsightsResponse> => {
  try {
    const response = await api.get("/api/ai/insights");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch AI insights"
      );
    }
    throw error;
  }
};

/**
 * Get time-filtered AI insights with metric card structure
 * @param params - Query parameters (months)
 * @returns Promise<AIInsightsMetricsResponse>
 */
export const getAIInsightsWithTimeRange = async (
  params: AIInsightsQueryParams = {}
): Promise<AIInsightsMetricsResponse> => {
  try {
    const url = new URL(`/api/ai/insights/timerange`, API_URL);

    // Add query parameters
    if (params.months) {
      url.searchParams.append("months", params.months);
    }

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch AI insights with time range"
      );
    }
    throw error;
  }
}; 