import { supabase } from './supabaseClient';
import type { User, AuthError } from '@supabase/supabase-js';
import { resendVerificationEmailAPI, updatePasswordAPI } from '../services/api';
import { VerificationStatus } from '../contexts/AuthContext';

// User role types
export type UserRole = 'jobseeker' | 'recruiter' | 'admin';

// Extended user with our custom fields
export interface AppUser extends User {
  user_metadata: {
    name: string;
    user_type: UserRole;
    hasProfile?: boolean;
    [key: string]: unknown;
  };
}

// Function to get user type safely with fallback
export function getUserType(user: User | null): UserRole {
  if (!user) return 'jobseeker'; // Default when no user
  
  const metadata = user.user_metadata || {};
  const userType = metadata.user_type;
  
  if (userType === 'recruiter' || userType === 'admin') {
    return userType;
  }
  
  return 'jobseeker'; // Default
}

// Check if user has specific role
export function hasRole(user: User | null, role: UserRole): boolean {
  return getUserType(user) === role;
}

// Check if user is admin
export function isAdmin(user: User | null): boolean {
  return getUserType(user) === 'admin';
}

// Check if user is recruiter
export function isRecruiter(user: User | null): boolean {
  return getUserType(user) === 'recruiter';
}

// Check if user is jobseeker
export function isJobSeeker(user: User | null): boolean {
  return getUserType(user) === 'jobseeker';
}

// Check if jobseeker has created a profile
export function hasJobseekerProfile(user: User | null): boolean {
  if (!user) return false;
  
  const metadata = user.user_metadata || {};
  return metadata.hasProfile;
} 

// Get jobseeker profile verification status
export async function getJobseekerVerificationStatus(userId: string | undefined): Promise<VerificationStatus> {
  if (!userId) return 'not_created';
  
  try {
    const { data: profile, error } = await supabase
      .from('jobseeker_profiles')
      .select('verification_status')
      .eq('user_id', userId)
      .single();
      
    if (error || !profile) {
      return 'not_created';
    }
    
    return (profile.verification_status as VerificationStatus) || 'pending';
  } catch (error) {
    console.error('Error fetching verification status:', error);
    return 'not_created';
  }
}
// Register a new user
export const registerUser = async (
  email: string, 
  password: string, 
  name: string
) => {
  // Use the API endpoint instead of direct Supabase call
  const response = await import('../services/api').then(api => api.registerUserAPI(email, password, name));
  return response;
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
  
  if (error) {
    // Check specifically for the email_not_confirmed error
    if (error.message === "Email not confirmed" || (error as AuthError).code === "email_not_confirmed") {
      // Return a special response indicating email is not verified
      return { 
        user: null, 
        session: null, 
        emailVerified: false,
        email // Return the email so we can use it for the verification page
      };
    }
    // Otherwise throw the error as usual
    throw error;
  }
  
  if (rememberMe && data.session) {
    // Configure persistent session (30 days)
    await supabase.auth.setSession({
      access_token: data.session.access_token || '',
      refresh_token: data.session.refresh_token || '',
    });
  }
  
  return {
    ...data,
    emailVerified: true
  };
};

// Check if user email is verified
export const isEmailVerified = async () => {
  const { data } = await supabase.auth.getUser();
  // email_confirmed_at will be null if the email isn't verified
  return !!data.user?.email_confirmed_at;
};

// Logout user
export const logoutUser = async () => {
  try {
    // First, call Supabase signOut to invalidate the session server-side
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    // Clear any localStorage items that might contain auth data
    localStorage.removeItem('supabase.auth.token');
    
    // Clear any potential session cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    // Force reload to clear any in-memory state
    window.location.reload();
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

// Get current user
export const getCurrentUser = async (): Promise<User | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user;
};

// Reset password request (sends email)
export const resetPassword = async (email: string) => {
  // Ensure the origin doesn't have a trailing slash before appending the path
  const origin = window.location.origin;
  const redirectURL = origin.endsWith('/')
    ? `${origin}reset-password`
    : `${origin}/reset-password`;
    
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectURL,
  });
  
  if (error) throw error;
};

// Update password with reset token
export const updatePasswordWithResetToken = async (password: string) => {
  // First check if we have an active session (most likely case when link clicked)
  const { data: sessionData } = await supabase.auth.getSession();
  
  if (sessionData.session) {
    // Try the direct Supabase update with the active session
    const { error: directError } = await supabase.auth.updateUser({ password });
    
    if (!directError) {
      return { success: true };
    }
    
    // If direct update fails, try the API
    const result = await updatePasswordAPI(password);
    return { success: true, ...result };
  }
  
  // If no active session, check URL tokens
  // First check the URL hash for tokens
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = hashParams.get('access_token');
  
  // Also check query parameters (direct from email link)
  const queryParams = new URLSearchParams(window.location.search);
  const recoveryToken = queryParams.get('token');
  
  // Handle case where we have access token in the hash (post Supabase redirect)
  if (accessToken) {
    // Set the session with hash tokens
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: hashParams.get('refresh_token') || '',
    });
    
    // Call the API to update the password
    const result = await updatePasswordAPI(password);
    return { success: true, ...result };
  }
  
  // Handle case where we have a direct token from the URL
  if (recoveryToken) {
    // First try to verify the token
    const { error } = await supabase.auth.verifyOtp({
      token_hash: recoveryToken,
      type: 'recovery'
    });
    
    if (error) {
      throw new Error('Invalid or expired token. Please request a new reset link.');
    }
    
    // Now update the password with the new session
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw updateError;
    
    return { success: true };
  }
  
  // Last resort - try direct password update if we somehow have a session
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  
  return { success: true };
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
  const { data } = supabase.auth.onAuthStateChange((_, session) => {
    callback(session?.user || null);
  });
  
  return data.subscription.unsubscribe;
}; 