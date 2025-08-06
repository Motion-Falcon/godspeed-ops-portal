import axios from "axios";
import { supabase } from "../../lib/supabaseClient";
import {
  api,
  API_URL,
  getAuthToken,
  handleResponse,
  clearTokenCache,
  clearRequestCache,
} from "./index";

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

// Get all auth users with filters and pagination
export const getAllAuthUsersAPI = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  nameFilter?: string;
  emailFilter?: string;
  mobileFilter?: string;
  userTypeFilter?: string;
  emailVerifiedFilter?: string;
} = {}) => {
  try {
    const response = await api.get('/api/auth/users', { params });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Failed to fetch auth users');
    }
    throw error;
  }
};
