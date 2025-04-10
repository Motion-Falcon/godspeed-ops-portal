import { supabase } from './supabaseClient';
import type { User } from '@supabase/supabase-js';
import { resendVerificationEmailAPI, updatePasswordAPI } from '../services/api';

// Register a new user
export const registerUser = async (
  email: string, 
  password: string, 
  name: string
) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });
  
  if (error) throw error;
  return data;
};

// Login existing user
export const loginUser = async (
  email: string, 
  password: string,
  rememberMe: boolean = false 
) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  
  if (rememberMe) {
    // Configure persistent session (30 days)
    await supabase.auth.setSession({
      access_token: data.session?.access_token || '',
      refresh_token: data.session?.refresh_token || '',
    });
  }
  
  return data;
};

// Logout user
export const logoutUser = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Get current user
export const getCurrentUser = async (): Promise<User | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user;
};

// Reset password request (sends email)
export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  
  if (error) throw error;
};

// Update password with reset token
export const updatePasswordWithResetToken = async (password: string) => {
  try {
    console.log('Starting password reset process');
    
    // Check both hash and query parameters for tokens
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search);
    
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const typeFromHash = hashParams.get('type');
    
    const initialToken = queryParams.get('token');
    const typeFromQuery = queryParams.get('type');
    
    console.log('Hash params found:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      type: typeFromHash
    });
    
    console.log('Query params found:', {
      hasToken: !!initialToken,
      type: typeFromQuery
    });
    
    // Validate we have the right tokens
    if (!accessToken || !refreshToken || typeFromHash !== 'recovery') {
      console.error('Invalid token data:', { 
        accessToken: !!accessToken, 
        refreshToken: !!refreshToken, 
        type: typeFromHash 
      });
      throw new Error('Invalid or expired password reset link');
    }
    
    // Set the session with the tokens from the URL
    console.log('Setting session with tokens');
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      throw sessionError;
    }
    
    // Use the API endpoint instead of direct Supabase call
    console.log('Calling updatePasswordAPI');
    const result = await updatePasswordAPI(password);
    return { success: true, ...result };
  } catch (error) {
    console.error('Update password error:', error);
    throw error;
  }
};

// Resend verification email - using server API
export const resendVerificationEmail = async (email: string) => {
  try {
    return await resendVerificationEmailAPI(email);
  } catch (error) {
    console.error('Resend verification error:', error);
    throw error;
  }
};

// Check auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
  
  return data.subscription.unsubscribe;
}; 