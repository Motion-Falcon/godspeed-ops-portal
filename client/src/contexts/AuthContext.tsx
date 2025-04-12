import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange, logoutUser } from '../lib/auth';
import { supabase } from '../lib/supabaseClient';
import { UserRole, getUserType, isAdmin, isRecruiter, isJobSeeker } from '../types/auth';

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  userType: UserRole;
  isAdmin: boolean;
  isRecruiter: boolean;
  isJobSeeker: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  userType: 'jobseeker',
  isAdmin: false,
  isRecruiter: false,
  isJobSeeker: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Compute user type and role flags
  const userType = getUserType(user);
  const isUserAdmin = isAdmin(user);
  const isUserRecruiter = isRecruiter(user);
  const isUserJobSeeker = isJobSeeker(user);

  // Validate token on startup and when user changes
  const validateToken = async (user: User | null) => {
    if (!user) return null;
    
    try {
      // Try to get session - this will also refresh token if needed
      const { data, error } = await supabase.auth.getSession();
      
      if (error || !data.session) {
        console.error('Session validation error:', error || 'No session found');
        // If no valid session, force logout
        await logoutUser();
        return null;
      }
      
      // Verify the user still exists
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        console.error('User validation error:', userError || 'User not found');
        // If user doesn't exist, force logout
        await logoutUser();
        return null;
      }
      
      return userData.user;
    } catch (error) {
      console.error('Token validation error:', error);
      await logoutUser();
      return null;
    }
  };

  useEffect(() => {
    // Check for existing user session
    const checkUser = async () => {
      try {
        const user = await getCurrentUser();
        // Validate the token if user exists
        const validatedUser = user ? await validateToken(user) : null;
        setUser(validatedUser);
      } catch (error) {
        console.error('Error checking auth state', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();

    // Listen for auth state changes
    const unsubscribe = onAuthStateChange(async (user) => {
      // Validate user token when auth state changes
      const validatedUser = user ? await validateToken(user) : null;
      setUser(validatedUser);
      setIsLoading(false);
    });

    return () => {
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext); 