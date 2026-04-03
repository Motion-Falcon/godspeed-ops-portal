import axios from "axios";
import { api, clearCacheFor } from "./index";

export type DropdownListType =
  | "client_manager"
  | "client_representative"
  | "salesperson"
  | "accounting_person"
  | "accounting_manager"
  | "position_title";

export interface ClientDropdownOption {
  id: string;
  listType: string;
  name: string;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

// Raw response from API (snake_case)
interface RawDropdownOption {
  id: string;
  list_type: string;
  name: string;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

function toCamelCase(obj: RawDropdownOption): ClientDropdownOption {
  return {
    id: obj.id,
    listType: obj.list_type,
    name: obj.name,
    displayOrder: obj.display_order,
    createdAt: obj.created_at,
    updatedAt: obj.updated_at,
  };
}

/**
 * Fetch all dropdown options, optionally filtered by list type
 */
export const getDropdownOptions = async (
  listType?: DropdownListType
): Promise<ClientDropdownOption[]> => {
  try {
    const params = listType ? { listType } : {};
    const response = await api.get("/api/dropdown-options", { params });
    const raw = Array.isArray(response.data) ? response.data : [];
    return raw.map((item: RawDropdownOption) => toCamelCase(item));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data?.error || "Failed to fetch dropdown options"
      );
    }
    throw error;
  }
};

/**
 * Fetch dropdown options for a specific list type (returns names for dropdown)
 */
export const getDropdownOptionsByType = async (
  listType: DropdownListType
): Promise<ClientDropdownOption[]> => {
  try {
    const response = await api.get(`/api/dropdown-options/${listType}`);
    const raw = Array.isArray(response.data) ? response.data : [];
    return raw.map((item: RawDropdownOption) => toCamelCase(item));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data?.error || "Failed to fetch dropdown options"
      );
    }
    throw error;
  }
};

/**
 * Create a new dropdown option (Admin only)
 */
export const createDropdownOption = async (
  listType: DropdownListType,
  name: string,
  displayOrder?: number
): Promise<ClientDropdownOption> => {
  try {
    const response = await api.post("/api/dropdown-options", {
      listType,
      name: name.trim(),
      displayOrder: displayOrder ?? 0,
    });
    clearCacheFor("/api/dropdown-options");
    return toCamelCase(response.data as RawDropdownOption);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data?.error || "Failed to create dropdown option"
      );
    }
    throw error;
  }
};

/**
 * Update a dropdown option (Admin only)
 */
export const updateDropdownOption = async (
  id: string,
  updates: { name?: string; displayOrder?: number }
): Promise<ClientDropdownOption> => {
  try {
    const response = await api.put(`/api/dropdown-options/${id}`, updates);
    clearCacheFor("/api/dropdown-options");
    return toCamelCase(response.data as RawDropdownOption);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data?.error || "Failed to update dropdown option"
      );
    }
    throw error;
  }
};

/**
 * Delete a dropdown option (Admin only)
 */
export const deleteDropdownOption = async (
  id: string
): Promise<{ success: boolean; deletedId: string }> => {
  try {
    const response = await api.delete(`/api/dropdown-options/${id}`);
    clearCacheFor("/api/dropdown-options");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data?.error || "Failed to delete dropdown option"
      );
    }
    throw error;
  }
};

export const LIST_TYPE_LABELS: Record<DropdownListType, string> = {
  client_manager: "Client Manager",
  client_representative: "Client Representative",
  salesperson: "Sales Person",
  accounting_person: "Accounting Person",
  accounting_manager: "Accounting Manager",
  position_title: "Position Title",
};
