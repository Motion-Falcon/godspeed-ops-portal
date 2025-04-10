import { supabase } from './supabaseClient';
import type { User } from '@supabase/supabase-js';

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

// Reset password 
export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  
  if (error) throw error;
};

// Check auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
  
  return data.subscription.unsubscribe;
}; 