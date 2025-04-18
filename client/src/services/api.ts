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
  try {
    // Get the current session to ensure we have the latest token
    const { data: sessionData } = await supabase.auth.getSession();
    
    if (!sessionData.session || !sessionData.session.access_token) {
      throw new Error('No active session found for password update');
    }
    
    // Create a temporary instance with the current token to ensure authorization
    const tempApi = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionData.session.access_token}`
      }
    });
    
    const response = await tempApi.post('/api/auth/update-password', { password });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Password update failed');
    }
    throw error;
  }
};

export const resendVerificationEmailAPI = async (email: string) => {
  try {
    const response = await api.post('/api/auth/resend-verification', { email });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || 'Failed to resend verification email');
    }
    throw error;
  }
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

export default api; 