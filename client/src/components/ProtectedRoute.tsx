import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types/auth';

interface RoleRouteProps {
  allowedRoles?: UserRole[];
}

export const ProtectedRoute = () => {
  const { isAuthenticated, isLoading, isJobSeeker, profileVerificationStatus, hasProfile } = useAuth();
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
    // Handle profile creation page
    if (location.pathname === '/profile/create') {
      // If user already has a profile, they shouldn't access profile creation
      if (hasProfile) {
        // If profile is verified, go to dashboard, otherwise to verification pending
        if (profileVerificationStatus === 'verified') {
          return <Navigate to="/dashboard" replace />;
        } else {
          return <Navigate to="/profile-verification-pending" replace />;
        }
      }
      // If they don't have a profile, allow access to profile creation
    } 
    // Handle verification pending page
    else if (location.pathname === '/profile-verification-pending') {
      // If user doesn't have a profile, they should create one first
      if (!hasProfile) {
        return <Navigate to="/profile/create" replace />;
      }
      // If profile is verified, they should go to dashboard
      if (profileVerificationStatus === 'verified') {
        return <Navigate to="/dashboard" replace />;
      }
      // Otherwise, allow access to verification pending
    }
    // Handle dashboard and other protected routes
    else if (location.pathname === '/dashboard' || location.pathname.startsWith('/jobseeker/')) {
      // If user doesn't have a profile, they need to create one
      if (!hasProfile) {
        return <Navigate to="/profile/create" replace />;
      }
      // If profile is not verified, they can't access dashboard
      if (profileVerificationStatus !== 'verified') {
        return <Navigate to="/profile-verification-pending" replace />;
      }
      // If profile is verified, allow access to dashboard and other routes
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
  return <RoleRoute allowedRoles={['admin']} />;
};

export const RecruiterRoute = () => {
  return <RoleRoute allowedRoles={['recruiter', 'admin']} />;
};

export const JobSeekerRoute = () => {
  // Only handle jobseeker vs recruiter/admin role restrictions here
  // The profile status logic is now in ProtectedRoute
  return <RoleRoute allowedRoles={['jobseeker']} />;
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