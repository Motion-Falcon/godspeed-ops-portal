import type { User } from '@supabase/supabase-js';

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
  if (!user || !isJobSeeker(user)) return false;
  
  const metadata = user.user_metadata || {};
  return !!metadata.hasProfile;
} 