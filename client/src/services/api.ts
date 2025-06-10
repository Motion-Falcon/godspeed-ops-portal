import axios, { AxiosRequestConfig } from "axios";
import { supabase } from "../lib/supabaseClient";
import { JobSeekerProfile, JobSeekerDetailedProfile } from "../types/jobseeker";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Request caching system
interface CacheRecord {
  data: unknown;
  timestamp: number;
  promise?: Promise<unknown>;
}

// Cache duration in milliseconds (5 seconds)
const CACHE_DURATION = 5000;

// Request cache for GET requests
const requestCache: Record<string, CacheRecord> = {};

// Generate cache key from request config
const getCacheKey = (config: AxiosRequestConfig): string => {
  return `${config.method}:${config.url}:${JSON.stringify(
    config.params || {}
  )}`;
};

// Clear entire request cache
export const clearRequestCache = () => {
  Object.keys(requestCache).forEach((key) => {
    delete requestCache[key];
  });
};

// Clear specific cache entry
export const clearCacheFor = (url: string) => {
  Object.keys(requestCache).forEach((key) => {
    if (key.includes(url)) {
      delete requestCache[key];
    }
  });
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Token caching mechanism
let cachedToken: string | null = null;
let tokenExpiryTime: number | null = null;

// Function to get token with caching
const getAuthToken = async () => {
  // If we have a cached token that isn't expired, use it
  const currentTime = Date.now();
  if (cachedToken && tokenExpiryTime && currentTime < tokenExpiryTime) {
    return cachedToken;
  }

  // Otherwise fetch a new token
  const { data } = await supabase.auth.getSession();

  if (data.session?.access_token) {
    cachedToken = data.session.access_token;
    // Set expiry time to 5 minutes before actual expiry to be safe
    // If expiry is not available, cache for 55 minutes (default Supabase token lasts 1 hour)
    const expiresIn = data.session.expires_in || 3600;
    tokenExpiryTime = currentTime + (expiresIn - 300) * 1000;
    return cachedToken;
  }

  // No token available
  cachedToken = null;
  tokenExpiryTime = null;
  return null;
};

// Clear token cache on logout
export const clearTokenCache = () => {
  cachedToken = null;
  tokenExpiryTime = null;
  clearRequestCache(); // Also clear request cache on logout
};

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    // Add auth token
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Implement request deduplication for GET requests
    if (config.method?.toLowerCase() === "get") {
      const cacheKey = getCacheKey(config);
      const currentTime = Date.now();
      const cachedResponse = requestCache[cacheKey];

      // If we have a valid cached response, use it
      if (
        cachedResponse &&
        currentTime - cachedResponse.timestamp < CACHE_DURATION
      ) {
        // If there's an in-flight request, wait for it and return its result
        if (cachedResponse.promise) {
          return {
            ...config,
            adapter: async () => {
              try {
                // Wait for the in-flight request to complete
                await cachedResponse.promise;
                
                // Get the cached data (should be populated now)
                const updatedCache = requestCache[cacheKey];
                if (updatedCache && updatedCache.data) {
                  return Promise.resolve({
                    data: updatedCache.data,
                    status: 200,
                    statusText: "OK",
                    headers: {},
                    config,
                    request: {},
                  });
                }
                
                // Fallback: make the actual request if cache is somehow empty
                delete config.adapter;
                const response = await axios(config);
                return response;
              } catch (error) {
                // If the in-flight request failed, make a new request
                delete config.adapter;
                const response = await axios(config);
                return response;
              }
            },
          };
        }

        // For completed requests, return the cached data
        return {
          ...config,
          adapter: () => {
            return Promise.resolve({
              data: cachedResponse.data,
              status: 200,
              statusText: "OK",
              headers: {},
              config,
              request: {},
            });
          },
        };
      }

      // Track this as an in-flight request
      const requestPromise = Promise.resolve(); // Placeholder promise
      requestCache[cacheKey] = {
        data: null,
        timestamp: currentTime,
        promise: requestPromise,
      };
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Cache successful GET responses
    if (response.config.method?.toLowerCase() === "get") {
      const cacheKey = getCacheKey(response.config);
      requestCache[cacheKey] = {
        data: response.data,
        timestamp: Date.now(),
        promise: undefined, // Clear promise as request is complete
      };
    }
    return response;
  },
  async (error) => {
    return Promise.reject(error);
  }
);

// Auth API calls
export const registerUserAPI = async (
  email: string,
  password: string,
  name: string,
  phoneNumber?: string
) => {
  try {
    const response = await api.post("/api/auth/register", {
      email,
      password,
      name,
      phoneNumber,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      // Handle specific status codes
      if (error.response.status === 400 && error.response.data.error) {
        // Usually indicates validation error or duplicate email
        throw new Error(error.response.data.error);
      } else if (error.response.status === 409) {
        // Alternative status for conflicts (e.g., duplicate email)
        throw new Error(
          error.response.data.error ||
            "An account with this email already exists"
        );
      } else if (error.response.status === 422) {
        // Unprocessable entity - often validation errors
        throw new Error(
          error.response.data.error || "Invalid registration data"
        );
      } else {
        // Generic error handling for other status codes
        throw new Error(error.response.data.error || "Registration failed");
      }
    }
    // For non-Axios errors
    throw error;
  }
};

export const loginUserAPI = async (email: string, password: string) => {
  try {
    // Clear caches before login attempt
    clearTokenCache();
    clearRequestCache();
    const response = await api.post("/api/auth/login", {
      email,
      password,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Login failed");
    }
    throw error;
  }
};

export const logoutUserAPI = async () => {
  try {
    const response = await api.post("/api/auth/logout");
    // Clear caches on logout
    clearTokenCache();
    clearRequestCache();
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Logout failed");
    }
    throw error;
  }
};

export const resetPasswordAPI = async (email: string) => {
  try {
    const response = await api.post("/api/auth/reset-password", { email });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Password reset failed");
    }
    throw error;
  }
};

export const updatePasswordAPI = async (password: string) => {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("No authentication token available");
  }

  const response = await fetch(`${API_URL}/api/auth/update-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  });

  return handleResponse(response);
};

export const resendVerificationEmailAPI = async (email: string) => {
  const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  return handleResponse(response);
};

export const sendOtpAPI = async (phoneNumber: string) => {
  try {
    const response = await api.post("/api/auth/send-verification", {
      phoneNumber,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to send verification code"
      );
    }
    throw error;
  }
};

export const verifyOtpAPI = async (phoneNumber: string, code: string) => {
  try {
    const response = await api.post("/api/auth/verify-otp", {
      phoneNumber,
      code,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Invalid verification code");
    }
    throw error;
  }
};

export const fetchUserData = async () => {
  try {
    const response = await api.get("/api/auth/me");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch user data");
    }
    throw error;
  }
};

export const fetchData = async () => {
  try {
    const response = await api.get("/api/data");
    return response.data;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
};

// Define Profile Data Types
interface ProfileData {
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
interface ProfileResponse {
  profile: ProfileData;
}

interface DraftResponse {
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

// Helper to handle common response patterns
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || `API error: ${response.status}`;
    throw new Error(errorMessage);
  }
  return response.json();
};

// Check API and auth health
export const checkApiHealth = async () => {
  try {
    // First check if we can fetch the token
    const token = await getAuthToken();
    if (!token) {
      return { status: "error", message: "No valid authentication token" };
    }

    // Check Supabase user validity
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return {
        status: "error",
        message:
          "Invalid Supabase token: " + (error?.message || "User not found"),
      };
    }

    // Check server API connection
    const response = await fetch(`${API_URL}/health`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return {
        status: "error",
        message: `API connection error: ${response.status}`,
      };
    }

    return { status: "healthy", user: data.user.email };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Unknown error checking API health",
    };
  }
};

interface PaginationParams {
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
}

interface PaginatedJobSeekerResponse {
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
        ...(params.employeeIdFilter && { employeeIdFilter: params.employeeIdFilter }),
        ...(params.experienceFilter &&
          params.experienceFilter !== "all" && {
            experienceFilter: params.experienceFilter,
          }),
        ...(params.statusFilter &&
          params.statusFilter !== "all" && {
            statusFilter: params.statusFilter,
          }),
        ...(params.dateFilter && { dateFilter: params.dateFilter }),
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

// Add this function with the other profile-related functions
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

// Add this function after checkEmailAvailability
export const checkAuthEmailAvailability = async (
  email: string
): Promise<{ available: boolean; email: string; existingUserId?: string }> => {
  try {
    const response = await api.get(`/api/auth/check-email`, {
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

export const checkPhoneAvailability = async (
  phone: string
): Promise<{ available: boolean; phone: string; existingUserId?: string }> => {
  try {
    const response = await api.get(`/api/auth/check-phone`, {
      params: { phone },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to check phone availability"
      );
    }
    throw error;
  }
};

// Client management API functions
export interface ClientData {
  id?: string;
  companyName?: string;
  billingName?: string;
  shortCode?: string;
  listName?: string;
  website?: string;
  clientManager?: string;
  salesPerson?: string;
  accountingPerson?: string;
  mergeInvoice?: boolean;
  currency?: string;
  workProvince?: string;

  // Contact Details
  contactPersonName1?: string;
  emailAddress1?: string;
  mobile1?: string;
  contactPersonName2?: string;
  emailAddress2?: string;
  invoiceCC2?: boolean;
  mobile2?: string;
  contactPersonName3?: string;
  emailAddress3?: string;
  invoiceCC3?: boolean;
  mobile3?: string;
  dispatchDeptEmail?: string;
  invoiceCCDispatch?: boolean;
  accountsDeptEmail?: string;
  invoiceCCAccounts?: boolean;
  invoiceLanguage?: string;

  // Address Details
  streetAddress1?: string;
  city1?: string;
  province1?: string;
  postalCode1?: string;
  streetAddress2?: string;
  city2?: string;
  province2?: string;
  postalCode2?: string;
  streetAddress3?: string;
  city3?: string;
  province3?: string;
  postalCode3?: string;

  // Payment & Billings
  preferredPaymentMethod?: string;
  terms?: string;
  payCycle?: string;
  creditLimit?: string;
  notes?: string;

  // Metadata
  isDraft?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastUpdated?: string;
}

export interface ClientResponse {
  success: boolean;
  message: string;
  client: ClientData;
}

export interface ClientDraftResponse {
  draft: ClientData | null;
  lastUpdated: string | null;
}

// Add client pagination parameters interface after the PositionDraftResponse interface
export interface ClientPaginationParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  companyNameFilter?: string;
  shortCodeFilter?: string;
  listNameFilter?: string;
  contactFilter?: string;
  emailFilter?: string;
  mobileFilter?: string;
  paymentMethodFilter?: string;
  paymentCycleFilter?: string;
}

export interface PaginatedClientResponse {
  clients: ClientData[];
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

export const getClients = async (
  params: ClientPaginationParams = {}
): Promise<PaginatedClientResponse> => {
  try {
    const url = new URL("/api/clients", API_URL);

    // Add pagination and filter parameters
    if (params.page) url.searchParams.append("page", params.page.toString());
    if (params.limit) url.searchParams.append("limit", params.limit.toString());
    if (params.searchTerm)
      url.searchParams.append("searchTerm", params.searchTerm);
    if (params.companyNameFilter)
      url.searchParams.append("companyNameFilter", params.companyNameFilter);
    if (params.shortCodeFilter)
      url.searchParams.append("shortCodeFilter", params.shortCodeFilter);
    if (params.listNameFilter)
      url.searchParams.append("listNameFilter", params.listNameFilter);
    if (params.contactFilter)
      url.searchParams.append("contactFilter", params.contactFilter);
    if (params.emailFilter)
      url.searchParams.append("emailFilter", params.emailFilter);
    if (params.mobileFilter)
      url.searchParams.append("mobileFilter", params.mobileFilter);
    if (params.paymentMethodFilter)
      url.searchParams.append(
        "paymentMethodFilter",
        params.paymentMethodFilter
      );
    if (params.paymentCycleFilter)
      url.searchParams.append("paymentCycleFilter", params.paymentCycleFilter);

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    console.error("Error fetching clients:", error);
    throw error;
  }
};

export const getClient = async (id: string): Promise<ClientData> => {
  try {
    const response = await api.get(`/api/clients/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch client");
    }
    throw error;
  }
};

export const createClient = async (
  clientData: ClientData
): Promise<ClientResponse> => {
  try {
    const response = await api.post("/api/clients", clientData);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to create client");
    }
    throw error;
  }
};

export const updateClient = async (
  id: string,
  clientData: ClientData
): Promise<ClientResponse> => {
  try {
    const response = await api.put(`/api/clients/${id}`, clientData);
    // Clear cache for this client and the clients list
    clearCacheFor(`/api/clients/${id}`);
    clearCacheFor("/api/clients");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to update client");
    }
    throw error;
  }
};

export const deleteClient = async (
  id: string
): Promise<{ success: boolean; message: string; deletedId: string }> => {
  try {
    const response = await api.delete(`/api/clients/${id}`);
    // Clear cache for clients list after deletion
    clearCacheFor("/api/clients");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to delete client");
    }
    throw error;
  }
};

// Client drafts management
export const saveClientDraft = async (
  draftData: Partial<ClientData>
): Promise<ClientDraftResponse> => {
  try {
    // For creating new drafts or updating drafts without an ID
    if (!draftData.id) {
      const response = await api.post("/api/clients/draft", draftData);
      return response.data;
    }

    // For updating existing drafts
    const response = await api.put(
      `/api/clients/draft/${draftData.id}`,
      draftData
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to save client draft"
      );
    }
    throw error;
  }
};

export const getClientDraft = async (): Promise<ClientDraftResponse> => {
  try {
    const response = await api.get("/api/clients/draft");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch client draft"
      );
    }
    throw error;
  }
};

export const getClientDraftById = async (
  id: string
): Promise<ClientDraftResponse> => {
  try {
    const response = await api.get(`/api/clients/draft/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch client draft"
      );
    }
    throw error;
  }
};

export interface ClientDraft {
  id: string;
  userId: string;
  companyName?: string;
  shortCode?: string;
  listName?: string;
  contactPersonName1?: string;
  createdAt: string;
  updatedAt: string;
  lastUpdated: string;
  createdByUserId: string;
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

export interface ClientDraftPaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  companyNameFilter?: string;
  shortCodeFilter?: string;
  listNameFilter?: string;
  contactPersonFilter?: string;
  creatorFilter?: string;
  updaterFilter?: string;
  dateFilter?: string;
  createdDateFilter?: string;
}

export interface PaginatedClientDraftResponse {
  drafts: ClientDraft[];
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

export const getAllClientDrafts = async (
  params: ClientDraftPaginationParams = {}
): Promise<PaginatedClientDraftResponse> => {
  try {
    const queryParams = new URLSearchParams();

    // Add all parameters to query string
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.companyNameFilter)
      queryParams.append("companyNameFilter", params.companyNameFilter);
    if (params.shortCodeFilter)
      queryParams.append("shortCodeFilter", params.shortCodeFilter);
    if (params.listNameFilter)
      queryParams.append("listNameFilter", params.listNameFilter);
    if (params.contactPersonFilter)
      queryParams.append("contactPersonFilter", params.contactPersonFilter);
    if (params.creatorFilter)
      queryParams.append("creatorFilter", params.creatorFilter);
    if (params.updaterFilter)
      queryParams.append("updaterFilter", params.updaterFilter);
    if (params.dateFilter) queryParams.append("dateFilter", params.dateFilter);
    if (params.createdDateFilter)
      queryParams.append("createdDateFilter", params.createdDateFilter);

    const response = await api.get(
      `/api/clients/drafts?${queryParams.toString()}`
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch client drafts"
      );
    }
    throw error;
  }
};

export const deleteClientDraft = async (
  id: string
): Promise<{ success: boolean; message: string; deletedId: string }> => {
  try {
    const response = await api.delete(`/api/clients/draft/${id}`);
    // Clear cache for drafts list after deletion
    clearCacheFor("/api/clients/drafts");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to delete client draft"
      );
    }
    throw error;
  }
};

// Position management API functions
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

// Add position pagination parameters interface
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

// Add paginated response interface for positions
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

// Position Drafts

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

// New function for validating credentials without creating session
export const validateCredentialsAPI = async (
  email: string,
  password: string
) => {
  try {
    // Clear caches before validation
    clearTokenCache();
    clearRequestCache();
    const response = await api.post("/api/auth/validate-credentials", {
      email,
      password,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Credential validation failed"
      );
    }
    throw error;
  }
};

// New function for completing 2FA and creating session
export const complete2FAAPI = async (email: string, password: string) => {
  try {
    const response = await api.post("/api/auth/complete-2fa", {
      email,
      password,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to complete 2FA");
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
    if (params.emailFilter) queryParams.append("emailFilter", params.emailFilter);
    if (params.phoneFilter) queryParams.append("phoneFilter", params.phoneFilter);
    if (params.experienceFilter) queryParams.append("experienceFilter", params.experienceFilter);
    if (params.availabilityFilter) queryParams.append("availabilityFilter", params.availabilityFilter);
    if (params.weekendAvailabilityFilter) queryParams.append("weekendAvailabilityFilter", params.weekendAvailabilityFilter);
    if (params.cityFilter) queryParams.append("cityFilter", params.cityFilter);
    if (params.provinceFilter) queryParams.append("provinceFilter", params.provinceFilter);
    if (params.onlyAvailable) queryParams.append("onlyAvailable", params.onlyAvailable);
    if (params.sortBy) queryParams.append("sortBy", params.sortBy);
    if (params.sortOrder) queryParams.append("sortOrder", params.sortOrder);

    const response = await api.get(`/api/jobseekers/position-candidates/${positionId}?${queryParams.toString()}`);
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
    assigned_jobseekers: data.assigned_jobseekers
  } as PositionData;
};

export const assignCandidateToPosition = async (
  positionId: string,
  candidateId: string,
  startDate: string,
  endDate: string,
): Promise<{
  success: boolean;
  message: string;
  assignedJobseekers: string[];
  position: PositionData;
  assignment?: Record<string, unknown>;
}> => {
  try {
    const response = await api.post(
      `/api/positions/${positionId}/assign`,
      { 
        candidateId,
        startDate,
        endDate
      }
    );

    return {
      success: response.data.success,
      message: response.data.message,
      assignedJobseekers: response.data.assignedJobseekers,
      position: transformPositionData(response.data.position),
      assignment: response.data.assignment
    };
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: { error?: string } } };
    console.error("Error assigning candidate to position:", error);
    return {
      success: false,
      message: axiosError.response?.data?.error || "Failed to assign candidate",
      assignedJobseekers: [],
      position: {} as PositionData
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

    return {
      success: response.data.success,
      message: response.data.message,
      assignedJobseekers: response.data.assignedJobseekers,
      position: transformPositionData(response.data.position)
    };
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: { error?: string } } };
    console.error("Error removing candidate from position:", error);
    return {
      success: false,
      message: axiosError.response?.data?.error || "Failed to remove candidate",
      assignedJobseekers: [],
      position: {} as PositionData
    };
  }
};

export interface AssignmentRecord {
  id: string;
  candidateId: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  jobseekerProfile?: {
    id: string;
    firstName: string;
    lastName: string;
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
      assignments: response.data.assignments || []
    };
  } catch (error: unknown) {
    console.error("Error fetching position assignments:", error);
    return {
      success: false,
      assignments: []
    };
  }
};

export default api;
