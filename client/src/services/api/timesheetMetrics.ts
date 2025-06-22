import axios from "axios";
import { api, API_URL } from "./index";

// Type definitions matching the backend response
export interface TimesheetMetric {
  id: string;
  label: string;
  currentValue: number;
  previousValue: number;
  unit: string;
  formatType: string;
  description: string;
  historicalData: Array<{
    period: string;
    value: number;
    date: Date | string;
  }>;
}

export interface TimesheetMetricsResponse {
  metrics: TimesheetMetric[];
}

/**
 * Get aggregate timesheet metrics for admin/recruiter dashboard
 * @returns Promise<TimesheetMetricsResponse>
 */
export const getTimesheetMetrics = async (): Promise<TimesheetMetricsResponse> => {
  try {
    const url = new URL("/api/timesheet-metrics", API_URL);
    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch timesheet metrics"
      );
    }
    throw error;
  }
}; 