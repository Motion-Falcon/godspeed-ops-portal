import { createClient } from '@supabase/supabase-js';

// Get the Supabase URL and anon key from environment variables
// These should be defined in your .env.local file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate that environment variables are defined
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Error: Supabase URL and anon key must be defined in environment variables.',
    '\nURL:', supabaseUrl ? 'Defined' : 'Missing',
    '\nKey:', supabaseAnonKey ? 'Defined' : 'Missing'
  );
  throw new Error('Supabase environment variables are missing.');
}

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for common Supabase tables
export type Tables = {
  jobseeker_profile_drafts: {
    id: string;
    user_id: string;
    form_data: Record<string, unknown>;
    last_updated: string;
    current_step: number;
  };
  jobseeker_profiles: {
    id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    dob: string;
    email: string;
    mobile: string;
    license_number?: string;
    passport_number?: string;
    sin_number?: string;
    sin_expiry?: string;
    business_number?: string;
    corporation_name?: string;
    verification_status: 'pending' | 'verified' | 'rejected';
    created_at: string;
    updated_at: string;
  };
};

// Helper functions for common operations

/**
 * Fetches the current user's profile draft if it exists
 */
export async function getProfileDraft() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }
    
    const { data, error } = await supabase
      .from('jobseeker_profile_drafts')
      .select('*')
      .eq('user_id', user.id)
      .single();
      
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error fetching profile draft:', error);
    return null;
  }
}

/**
 * Fetches the current user's profile if it exists
 */
export async function getProfile() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }
    
    const { data, error } = await supabase
      .from('jobseeker_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
      
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
} 