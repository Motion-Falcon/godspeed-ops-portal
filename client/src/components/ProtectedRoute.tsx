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

  // Handle jobseeker profile-based routing for all protected routes
  if (isJobSeeker) {
    const path = location.pathname;

    // Define route access rules for job seekers
    if (path === "/profile/create") {
      // Redirect if user already has a profile
      if (hasProfile) {
        return (
          <Navigate
            to={
              profileVerificationStatus === "verified"
                ? "/dashboard"
                : profileVerificationStatus === "pending"
                ? "/profile-verification-pending"
                : ""
            }
            replace
          />
        );
      }
      // Allow access to profile creation if no profile exists
    } else if (path === "/profile-verification-pending") {
      // Redirect to profile creation if no profile
      if (!hasProfile) {
        return <Navigate to="/profile/create" replace />;
      }
      // Redirect to dashboard if profile is verified
      if (profileVerificationStatus === "verified") {
        return <Navigate to="/dashboard" replace />;
      }
      if (profileVerificationStatus === "rejected") {
        return <Navigate to="/profile-verification-rejected" replace />;
      }
      // Otherwise allow access to verification pending page
    } else if (path === "/dashboard" || path.startsWith("/jobseekers/")) {
      // Redirect to profile creation if no profile
      if (!hasProfile) {
        return <Navigate to="/profile/create" replace />;
      }
      // Redirect to verification pending if profile not verified
      if (profileVerificationStatus === "pending") {
        return <Navigate to="/profile-verification-pending" replace />;
      }
      // Allow access to dashboard/jobseeker routes if profile is verified
    } else if (path === "/profile-verification-rejected") {
      // Redirect to dashboard if profile is verified
      if (profileVerificationStatus === "verified") {
        return <Navigate to="/dashboard" replace />;
      }
      if (profileVerificationStatus === "pending") {
        return <Navigate to="/profile-verification-pending" replace />;
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
