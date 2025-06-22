import axios from "axios";
import { api, clearCacheFor } from "./index";

// Define Profile Data Types
export interface ProfileData {
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  mobile: string;
  licenseNumber?: string;
  passportNumber?: string;
  sinNumber?: string;
  sinExpiry?: string;
  businessNumber?: string;
  corporationName?: string;
  street?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  workPreference?: string;
  bio?: string; // Brief professional description (max 100 chars)
  licenseType?: string;
  experience?: string;
  manualDriving?: "Yes" | "No" | "NA";
  availability?: "Full-Time" | "Part-Time";
  weekendAvailability?: boolean;
  payrateType?: "Hourly" | "Daily" | "Monthly";
  billRate?: string;
  payRate?: string;
  paymentMethod?: string;
  hstGst?: string;
  cashDeduction?: string;
  overtimeEnabled?: boolean;
  overtimeHours?: string;
  overtimeBillRate?: string;
  overtimePayRate?: string;
  documents?: Array<{
    documentType: string;
    documentTitle?: string;
    documentFile?: File;
    documentPath?: string;
    documentFileName?: string;
    documentNotes?: string;
    id?: string;
  }>;
  currentStep?: number;
  // Use Record for additional properties with specific types
  [key: string]:
    | string
    | boolean
    | number
    | undefined
    | File
    | Array<{ [key: string]: string | boolean | number | undefined | File }>;
}

// Define response types
export interface ProfileResponse {
  profile: ProfileData;
}

export interface DraftResponse {
  draft: ProfileData | null;
  currentStep: number;
  lastUpdated: string | null;
  createdAt?: string | null;
  createdByUserId?: string | null;
  updatedAt?: string | null;
  updatedByUserId?: string | null;
}

// Profile API endpoints
export const submitProfile = async (profileData: ProfileData) => {
  try {
    const response = await api.post("/api/profile/submit", profileData);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      // Log the error details for debugging
      console.error("Profile submission error details:", error.response.data);

      // Return a more specific error message if available
      const errorMessage =
        error.response.data.error ||
        (error.response.status === 409
          ? "A profile with this email already exists"
          : "Failed to submit profile");

      throw new Error(errorMessage);
    }
    // For non-Axios errors, rethrow
    throw error;
  }
};
// Add updateProfile function for editing existing profiles
export const updateProfile = async (id: string, profileData: ProfileData) => {
  try {
    const response = await api.put(
      `/api/jobseekers/profile/${id}/update`,
      profileData
    );
    // Clear cache for this profile and the profiles list
    clearCacheFor(`/api/jobseekers/${id}`);
    clearCacheFor("/api/jobseekers");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("Profile update error details:", error.response.data);
      const errorMessage =
        error.response.data.error || "Failed to update profile";
      throw new Error(errorMessage);
    }
    throw error;
  }
};
export const getProfile = async (): Promise<ProfileResponse> => {
  try {
    const response = await api.get("/api/profile");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch profile");
    }
    throw error;
  }
};

export const saveDraft = async (
  draftData: Partial<ProfileData> & { currentStep?: number }
) => {
  try {
    const response = await api.put("/api/profile/draft", draftData);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to save profile draft"
      );
    }
    throw error;
  }
};

export const getDraft = async (): Promise<DraftResponse> => {
  try {
    const response = await api.get("/api/profile/draft");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch profile draft"
      );
    }
    throw error;
  }
};

export const checkEmailAvailability = async (
  email: string
): Promise<{
  available: boolean;
  email: string;
  existingProfileId?: string;
  existingDraftId?: string;
}> => {
  try {
    const response = await api.get(`/api/profile/check-email`, {
      params: { email },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to check email availability"
      );
    }
    throw error;
  }
};
