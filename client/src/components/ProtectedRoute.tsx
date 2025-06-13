import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { UserRole } from "../types/auth";

interface RoleRouteProps {
  allowedRoles?: UserRole[];
}

export const ProtectedRoute = () => {
  const {
    isAuthenticated,
    isLoading,
    isJobSeeker,
    profileVerificationStatus,
    hasProfile,
    isProfileLoading,
  } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Special handling for 2FA route - prevent access if user is already authenticated
  // This prevents bypassing 2FA by accessing the route directly
  if (location.pathname === "/two-factor-auth" && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Simplified jobseeker route access logic
  if (isJobSeeker) {
    const currentPath = location.pathname;

    // Show loading state while profile data is being fetched
    if (isProfileLoading) {
      return (
        <div className="flex h-screen w-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        </div>
      );
    }

    // Case 1: No profile - only allow profile creation
    if (!hasProfile) {
      if (currentPath !== "/profile/create") {
        return <Navigate to="/profile/create" replace />;
      }
    }
    // Case 2: Has profile but verification pending - only allow pending page
    else if (profileVerificationStatus === "pending") {
      if (currentPath !== "/profile-verification-pending") {
        return <Navigate to="/profile-verification-pending" replace />;
      }
    }
    // Case 3: Has profile but verification rejected - only allow rejected page
    else if (profileVerificationStatus === "rejected") {
      if (currentPath !== "/profile-verification-rejected") {
        return <Navigate to="/profile-verification-rejected" replace />;
      }
    }
    // Case 4: Has profile and verified - block access to the first three routes
    else if (profileVerificationStatus === "verified") {
      const restrictedPaths = [
        "/profile/create",
        "/profile-verification-pending", 
        "/profile-verification-rejected"
      ];
      
      if (restrictedPaths.includes(currentPath)) {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  return <Outlet />;
};

export const RoleRoute = ({ allowedRoles = [] }: RoleRouteProps) => {
  const { isAuthenticated, isLoading, userType } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userType)) {
    // Redirect to dashboard if user doesn't have required role
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export const AdminRoute = () => {
  return <RoleRoute allowedRoles={["admin"]} />;
};

export const RecruiterRoute = () => {
  return <RoleRoute allowedRoles={["recruiter", "admin"]} />;
};

export const JobSeekerRoute = () => {
  // Only handle jobseeker vs recruiter/admin role restrictions here
  // The profile status logic is now in ProtectedRoute
  return <RoleRoute allowedRoles={["jobseeker"]} />;
};

export const PublicRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
