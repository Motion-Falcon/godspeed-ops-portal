import { apiCall } from "./apiCall";
import axios from "axios";

// Generate position code for a client
export const generatePositionCode = async (
  clientId: string
): Promise<{ positionCode: string; clientShortCode: string }> => {
  try {
    const response = await api.get(`positions/generate-code/${clientId}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to generate position code");
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

    const url = `positions/client/${clientId}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch client positions");
    }
    throw error;
  }
};
