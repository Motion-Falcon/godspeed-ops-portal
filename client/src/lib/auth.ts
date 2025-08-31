import { supabase } from './supabaseClient';
import type { User, AuthError } from '@supabase/supabase-js';
import { VerificationStatus } from '../contexts/AuthContext';
import { complete2FAAPI, registerUserAPI, resendVerificationEmailAPI, updatePasswordAPI, validateCredentialsAPI } from '../services/api/auth';
import { getAuthUserByIdAPI } from '../services/api/user';
import type { AllAuthUserListItem } from '../types/auth';

// User role types
export type UserRole = 'jobseeker' | 'recruiter' | 'admin';

// Extended user with our custom fields
export interface AppUser extends User {
  user_metadata: {
    name: string;
    user_type: UserRole;
    hasProfile?: boolean;
    user_role?: unknown;
    hierarchy?: unknown;
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
  return (metadata as Record<string, unknown>).hasProfile as boolean;
}

// Get jobseeker profile verification status
export async function getJobseekerVerificationStatus(userId: string | undefined): Promise<VerificationStatus> {
  if (!userId) return 'not_created';
  
  try {
    const { data: profile, error } = await supabase
      .from('jobseeker_profiles')
      .select('verification_status, rejection_reason')
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

// Helper: safely extract roles array from a raw user JSON (e.g., API "raw" field)
export function getUserRolesFromRaw(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  const root = raw as Record<string, unknown>;
  const meta = root['user_metadata'];
  if (!meta || typeof meta !== 'object') return [];
  const metaObj = meta as Record<string, unknown>;
  const roles = metaObj['user_role'];
  if (!Array.isArray(roles)) return [];
  return roles.filter((r): r is string => typeof r === 'string');
}

// Helper: safely extract manager_id (uuid string) from raw user JSON
export function getUsersManagerIdFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const meta = root['user_metadata'];
  if (!meta || typeof meta !== 'object') return null;
  const metaObj = meta as Record<string, unknown>;
  const hierarchy = metaObj['hierarchy'];
  if (!hierarchy || typeof hierarchy !== 'object') return null;
  const hierObj = hierarchy as Record<string, unknown>;
  const managerId = hierObj['manager_id'];
  return typeof managerId === 'string' && managerId.length > 0 ? managerId : null;
}

// New: Get a user's manager details by the user's id using the server API
export async function getUsersManager(userId: string): Promise<AllAuthUserListItem | null> {
  if (!userId) return null;
  const user = await getAuthUserByIdAPI(userId);
  if (!user) return null;
  const managerId = getUsersManagerIdFromRaw(user.raw);
  if (!managerId) return null;
  const manager = await getAuthUserByIdAPI(managerId);
  return manager || null;
}

// Register a new user
export const registerUser = async (
  email: string, 
  password: string, 
  name: string,
  phoneNumber?: string
) => {
  // Use the API endpoint instead of direct Supabase call
  const response = await registerUserAPI(email, password, name, phoneNumber);
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

// New function: Validate credentials for 2FA flow
export const validateCredentials = async (
  email: string, 
  password: string
) => {
  const result = await validateCredentialsAPI(email, password);
  
  // Only set session if email is verified
  if (!result.requiresTwoFactor && result.user?.user_metadata?.email_verified) {
    // For non-recruiters with verified email, we get a session back - set it in Supabase
    if (result.session) {
      await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
    }
  }
  
  return result;
};

// New function: Complete 2FA and create session
export const complete2FA = async (
  email: string, 
  password: string,
  rememberMe: boolean = false
) => {
  const result = await complete2FAAPI(email, password);
  
  if (result.session) {
    // Set the session in Supabase
    await supabase.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
    });
    
    if (rememberMe) {
      // Configure persistent session (30 days)
      await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
    }
  }
  
  return result;
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

// Helper function to check if user is a recruiter based on email
export const isRecruiterEmail = (email: string): boolean => {
  return email.includes('@godspeedxp') || email.includes('@motionfalcon');
};
