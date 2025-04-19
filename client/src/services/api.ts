import axios, { AxiosRequestConfig } from 'axios';
import { supabase } from '../lib/supabaseClient';
import { JobSeekerProfile, JobSeekerDetailedProfile } from '../types/jobseeker';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
  return `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;
};

// Clear entire request cache
export const clearRequestCache = () => {
  Object.keys(requestCache).forEach(key => {
    delete requestCache[key];
  });
};

// Clear specific cache entry
export const clearCacheFor = (url: string) => {
  Object.keys(requestCache).forEach(key => {
    if (key.includes(url)) {
      delete requestCache[key];
    }
  });
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
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
api.interceptors.request.use(async (config) => {
  // Add auth token
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Implement request deduplication for GET requests
  if (config.method?.toLowerCase() === 'get') {
    const cacheKey = getCacheKey(config);
    const currentTime = Date.now();
    const cachedResponse = requestCache[cacheKey];
    
    // If we have a valid cached response, use it
    if (cachedResponse && currentTime - cachedResponse.timestamp < CACHE_DURATION) {
      // If there's an in-flight request, return its promise
      if (cachedResponse.promise) {
        const source = axios.CancelToken.source();
        config.cancelToken = source.token;
        source.cancel('Request canceled due to duplicate in-flight request');
        return Promise.reject({
          __CACHE_PROMISE__: cachedResponse.promise,
          config
        });
      }
      
      // For completed requests, return the cached data
      return {
        ...config,
        adapter: () => {
          return Promise.resolve({
            data: cachedResponse.data,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
            request: {}
          });
        }
      };
    }
    
    // Track this as an in-flight request
    const requestPromise = Promise.resolve(); // Placeholder promise
    requestCache[cacheKey] = {
      data: null,
      timestamp: currentTime,
      promise: requestPromise
    };
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor
api.interceptors.response.use((response) => {
  // Cache successful GET responses
  if (response.config.method?.toLowerCase() === 'get') {
    const cacheKey = getCacheKey(response.config);
    requestCache[cacheKey] = {
      data: response.data,
      timestamp: Date.now(),
      promise: undefined // Clear promise as request is complete
    };
  }
  return response;
}, async (error) => {
  // Check if this is our special cache case
  if (error.__CACHE_PROMISE__) {
    try {
      await error.__CACHE_PROMISE__;
      // Re-request using the same config, the cache should be populated now
      delete error.config.adapter; // Remove custom adapter
      const result = await axios(error.config);
      return result;
    } catch (e) {
      return Promise.reject(e);
    }
  }
  
  return Promise.reject(error);
});

// Auth API calls
export const registerUserAPI = async (email: string, password: string, name: string) => {
  try {
    const response = await api.post('/api/auth/register', {
      email,
      password,
      name,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Registration failed');
    }
    throw error;
  }
};

export const loginUserAPI = async (email: string, password: string) => {
  try {
    // Clear caches before login attempt
    clearTokenCache();
    clearRequestCache();
    const response = await api.post('/api/auth/login', {
      email,
      password,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Login failed');
    }
    throw error;
  }
};

export const logoutUserAPI = async () => {
  try {
    const response = await api.post('/api/auth/logout');
    // Clear caches on logout
    clearTokenCache();
    clearRequestCache();
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Logout failed');
    }
    throw error;
  }
};

export const resetPasswordAPI = async (email: string) => {
  try {
    const response = await api.post('/api/auth/reset-password', { email });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Password reset failed');
    }
    throw error;
  }
};

export const updatePasswordAPI = async (password: string) => {
  const token = await getAuthToken();
  
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  const response = await fetch(`${API_URL}/auth/update-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  });

  return handleResponse(response);
};

export const resendVerificationEmailAPI = async (email: string) => {
  const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  return handleResponse(response);
};

export const fetchUserData = async () => {
  try {
    const response = await api.get('/api/auth/me');
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Failed to fetch user data');
    }
    throw error;
  }
};

export const fetchData = async () => {
  try {
    const response = await api.get('/api/data');
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error);
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
  manualDriving?: 'Yes' | 'No' | 'NA';
  availability?: 'Full-Time' | 'Part-Time';
  weekendAvailability?: boolean;
  payrateType?: 'Hourly' | 'Daily' | 'Monthly';
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
  [key: string]: string | boolean | number | undefined | File | Array<{[key: string]: string | boolean | number | undefined | File}>;
}

// Define response types
interface ProfileResponse {
  profile: ProfileData;
}

interface DraftResponse {
  draft: ProfileData | null;
  currentStep: number;
  lastUpdated: string | null;
}

// Profile API endpoints
export const submitProfile = async (profileData: ProfileData) => {
  try {
    const response = await api.post('/api/profile/submit', profileData);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      // Log the error details for debugging
      console.error('Profile submission error details:', error.response.data);
      
      // Return a more specific error message if available
      const errorMessage = error.response.data.error || 
                          (error.response.status === 409 ? 'A profile with this email already exists' : 'Failed to submit profile');
      
      throw new Error(errorMessage);
    }
    // For non-Axios errors, rethrow
    throw error;
  }
};

export const getProfile = async (): Promise<ProfileResponse> => {
  try {
    const response = await api.get('/api/profile');
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Failed to fetch profile');
    }
    throw error;
  }
};

export const saveDraft = async (draftData: Partial<ProfileData> & { currentStep?: number }) => {
  try {
    const response = await api.put('/api/profile/draft', draftData);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Failed to save profile draft');
    }
    throw error;
  }
};

export const getDraft = async (): Promise<DraftResponse> => {
  try {
    const response = await api.get('/api/profile/draft');
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Failed to fetch profile draft');
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
      return { status: 'error', message: 'No valid authentication token' };
    }
    
    // Check Supabase user validity
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return { 
        status: 'error', 
        message: 'Invalid Supabase token: ' + (error?.message || 'User not found') 
      };
    }
    
    // Check server API connection
    const response = await fetch(`${API_URL}/health`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      return { 
        status: 'error', 
        message: `API connection error: ${response.status}` 
      };
    }
    
    return { status: 'healthy', user: data.user.email };
  } catch (error) {
    return { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error checking API health' 
    };
  }
};

// Jobseeker API functions
export const getJobseekerProfiles = async (): Promise<JobSeekerProfile[]> => {
  try {
    const response = await api.get('/api/jobseekers');
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Failed to fetch jobseeker profiles');
    }
    throw error;
  }
};

export const getJobseekerProfile = async (id: string): Promise<JobSeekerDetailedProfile> => {
  try {
    const response = await api.get(`/api/jobseekers/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Failed to fetch jobseeker profile');
    }
    throw error;
  }
};

export const updateJobseekerStatus = async (id: string, status: 'pending' | 'verified' | 'rejected') => {
  try {
    const response = await api.put(`/api/jobseekers/${id}/status`, { status });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Failed to update jobseeker status');
    }
    throw error;
  }
};

// Add this function with the other profile-related functions
export const checkEmailAvailability = async (email: string): Promise<{ available: boolean; email: string }> => {
  try {
    const response = await api.get(`/api/profile/check-email`, {
      params: { email }
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Failed to check email availability');
    }
    throw error;
  }
};

export default api; 