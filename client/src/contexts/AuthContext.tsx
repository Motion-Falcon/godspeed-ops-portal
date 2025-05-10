import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange, logoutUser } from '../lib/auth';
import { supabase } from '../lib/supabaseClient';
import { UserRole, getUserType, isAdmin, isRecruiter, isJobSeeker, hasJobseekerProfile } from '../types/auth';
import { clearTokenCache } from '../services/api';

// Define possible verification statuses
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'not_created';

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  userType: UserRole;
  isAdmin: boolean;
  isRecruiter: boolean;
  isJobSeeker: boolean;
  profileVerificationStatus: VerificationStatus;
  hasProfile: boolean;
  refetchProfileStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  userType: 'jobseeker',
  isAdmin: false,
  isRecruiter: false,
  isJobSeeker: true,
  profileVerificationStatus: 'not_created',
  hasProfile: false,
  refetchProfileStatus: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileVerificationStatus, setProfileVerificationStatus] = useState<VerificationStatus>('not_created');
  const [hasProfile, setHasProfile] = useState(false);
  
  // Use ref to track validation status and prevent duplicate validations
  const isValidatingRef = useRef(false);
  
  // Compute user type and role flags
  const userType = getUserType(user);
  const isUserAdmin = isAdmin(user);
  const isUserRecruiter = isRecruiter(user);
  const isUserJobSeeker = isJobSeeker(user);
  const userHasProfile = hasJobseekerProfile(user);

  // Function to fetch jobseeker profile status
  const fetchProfileStatus = async (userId: string) => {
    if (!userId || !isUserJobSeeker) {
      setProfileVerificationStatus('not_created');
      setHasProfile(false);
      return;
    }

    // First check if the user metadata indicates they have a profile
    // This can help avoid unnecessary database calls
    if (user?.user_metadata?.hasProfile) {
      setHasProfile(true);
    } else {
      // Default to false until we confirm from the database
      setHasProfile(false);
    }

    try {
      const { data: profile, error } = await supabase
        .from('jobseeker_profiles')
        .select('verification_status')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile status:', error);
        setProfileVerificationStatus('not_created');
        setHasProfile(false);
        
        // If there was an error but user metadata indicates they have a profile,
        // update the metadata to match reality
        if (user?.user_metadata?.hasProfile) {
          try {
            await supabase.auth.updateUser({
              data: { hasProfile: false }
            });
          } catch (metadataError) {
            console.error('Error updating user metadata:', metadataError);
          }
        }
        return;
      }

      if (profile) {
        setHasProfile(true);
        const status = profile.verification_status as VerificationStatus || 'pending';
        setProfileVerificationStatus(status);
        
        // If database shows a profile exists but metadata doesn't reflect this, update it
        if (!user?.user_metadata?.hasProfile) {
          try {
            await supabase.auth.updateUser({
              data: { hasProfile: true }
            });
          } catch (metadataError) {
            console.error('Error updating user metadata:', metadataError);
          }
        }
      } else {
        setProfileVerificationStatus('not_created');
        setHasProfile(false);
        
        // If no profile found but metadata says one exists, update metadata
        if (user?.user_metadata?.hasProfile) {
          try {
            await supabase.auth.updateUser({
              data: { hasProfile: false }
            });
          } catch (metadataError) {
            console.error('Error updating user metadata:', metadataError);
          }
        }
      }
    } catch (error) {
      console.error('Error in fetchProfileStatus:', error);
      setProfileVerificationStatus('not_created');
      setHasProfile(false);
    }
  };

  // Public method to refetch profile status
  const refetchProfileStatus = async () => {
    if (user?.id) {
      await fetchProfileStatus(user.id);
    }
  };

  // Validate token on startup and when user changes
  const validateToken = async (user: User | null) => {
    if (!user) return null;
    
    // Prevent multiple concurrent validations
    if (isValidatingRef.current) {
      return user;
    }
    
    isValidatingRef.current = true;
    
    try {
      // Try to get session - this will also refresh token if needed
      const { data, error } = await supabase.auth.getSession();
      
      if (error || !data.session) {
        console.error('Session validation error:', error || 'No session found');
        // If no valid session, force logout
        await logoutUser();
        clearTokenCache();
        return null;
      }
      
      // Use the user from the session if available, otherwise fetch
      if (data.session.user) {
        isValidatingRef.current = false;
        return data.session.user;
      }
      
      // Only fetch user if we don't have it from the session already
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        console.error('User validation error:', userError || 'User not found');
        // If user doesn't exist, force logout
        await logoutUser();
        clearTokenCache();
        return null;
      }
      
      isValidatingRef.current = false;
      return userData.user;
    } catch (error) {
      console.error('Token validation error:', error);
      await logoutUser();
      clearTokenCache();
      return null;
    } finally {
      isValidatingRef.current = false;
    }
  };

  // Update hasProfile from user metadata when user changes
  useEffect(() => {
    // Use hasProfile from metadata as initial value
    if (user) {
      const metadataHasProfile = !!user.user_metadata?.hasProfile;
      setHasProfile(metadataHasProfile);
    } else {
      setHasProfile(false);
    }
  }, [user]);

  // Fetch profile status when user changes
  useEffect(() => {
    if (user?.id && isUserJobSeeker) {
      fetchProfileStatus(user.id);
    } else if (!user || !isUserJobSeeker) {
      setProfileVerificationStatus('not_created');
      setHasProfile(false);
    }
  }, [user?.id, isUserJobSeeker]);

  useEffect(() => {
    let isMounted = true;
    
    // Check for existing user session
    const checkUser = async () => {
      try {
        const user = await getCurrentUser();
        // Validate the token if user exists
        const validatedUser = user ? await validateToken(user) : null;
        if (isMounted) {
          setUser(validatedUser);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error checking auth state', error);
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    checkUser();

    // Listen for auth state changes
    const unsubscribe = onAuthStateChange(async (user) => {
      // Only re-validate if the auth state actually changed
      if (isMounted) {
        // Validate user token when auth state changes
        const validatedUser = user ? await validateToken(user) : null;
        setUser(validatedUser);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        userType,
        isAdmin: isUserAdmin,
        isRecruiter: isUserRecruiter,
        isJobSeeker: isUserJobSeeker,
        profileVerificationStatus,
        hasProfile: userHasProfile || hasProfile, // Use both sources for redundancy
        refetchProfileStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext); 