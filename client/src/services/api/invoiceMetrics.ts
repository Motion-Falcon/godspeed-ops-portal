import axios from "axios";
import { api, API_URL } from "./index";

// Type definitions matching the backend response
export interface InvoiceMetric {
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

export interface InvoiceMetricsResponse {
  metrics: InvoiceMetric[];
}

/**
 * Get aggregate invoice metrics for admin/recruiter dashboard
 * @returns Promise<InvoiceMetricsResponse>
 */
export const getInvoiceMetrics = async (): Promise<InvoiceMetricsResponse> => {
  try {
    const url = new URL("/api/invoice-metrics", API_URL);
    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch invoice metrics"
      );
    }
    throw error;
  }
}; 