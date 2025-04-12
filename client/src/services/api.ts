import axios from 'axios';
import { supabase } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if user is logged in
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  
  if (data.session?.access_token) {
    config.headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  
  return config;
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
  const response = await fetch(`${API_URL}/auth/resend-verification`, {
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

// Helper to handle common response patterns
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || `API error: ${response.status}`;
    throw new Error(errorMessage);
  }
  return response.json();
};

// Get auth token from Supabase
const getAuthToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
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

export default api; 