import axios, { AxiosRequestConfig } from "axios";
import { supabase } from "../../lib/supabaseClient";

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

// Helper to handle common response patterns
export const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || `API error: ${response.status}`;
    throw new Error(errorMessage);
  }
  return response.json();
};

export { api, API_URL, getAuthToken };
