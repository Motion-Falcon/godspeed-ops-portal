import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { User } from "@supabase/supabase-js";
import {
  getCurrentUser,
  onAuthStateChange,
  logoutUser,
  UserRole,
  getUserType,
  isAdmin,
  isRecruiter,
  isJobSeeker,
  hasJobseekerProfile,
  getJobseekerVerificationStatus,
} from "../lib/auth";
import { supabase } from "../lib/supabaseClient";
import { clearTokenCache } from "../services/api";

// Define possible verification statuses
export type VerificationStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "not_created";

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
  isProfileLoading: boolean;
  refetchProfileStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  userType: "jobseeker",
  isAdmin: false,
  isRecruiter: false,
  isJobSeeker: true,
  profileVerificationStatus: "not_created",
  hasProfile: false,
  isProfileLoading: false,
  refetchProfileStatus: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileVerificationStatus, setProfileVerificationStatus] =
    useState<VerificationStatus>("not_created");
  const [hasProfile, setHasProfile] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Use ref to track validation status and prevent duplicate validations
  const isValidatingRef = useRef(false);

  // Compute user type and role flags
  const userType = getUserType(user);
  const isUserAdmin = isAdmin(user);
  const isUserRecruiter = isRecruiter(user);
  const isUserJobSeeker = isJobSeeker(user);

  // Function to fetch jobseeker profile status
  const fetchProfileStatus = async (userId: string, user: User | null) => {
    if (!userId || !isUserJobSeeker) {
      setProfileVerificationStatus("not_created");
      setHasProfile(false);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    
    const hasProfile = hasJobseekerProfile(user);
    setHasProfile(hasProfile);

    if (hasProfile) {
      const profileVerificationStatus = await getJobseekerVerificationStatus(
        userId
      );
      setProfileVerificationStatus(profileVerificationStatus);
    }
    
    setIsProfileLoading(false);
  };

  // Public method to refetch profile status
  const refetchProfileStatus = async () => {
    if (user?.id) {
      await fetchProfileStatus(user.id, user);
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
        console.error("Session validation error:", error || "No session found");
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
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        console.error("User validation error:", userError || "User not found");
        // If user doesn't exist, force logout
        await logoutUser();
        clearTokenCache();
        return null;
      }

      isValidatingRef.current = false;
      return userData.user;
    } catch (error) {
      console.error("Token validation error:", error);
      await logoutUser();
      clearTokenCache();
      return null;
    } finally {
      isValidatingRef.current = false;
    }
  };

  // Fetch profile status when user changes
  useEffect(() => {
    if (user?.id && isUserJobSeeker) {
      fetchProfileStatus(user.id, user);
    } else {
      // For non-jobseekers or when no user, immediately set loading to false
      setProfileVerificationStatus("not_created");
      setHasProfile(false);
      setIsProfileLoading(false);
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
        console.error("Error checking auth state", error);
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
        hasProfile,
        isProfileLoading,
        refetchProfileStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
