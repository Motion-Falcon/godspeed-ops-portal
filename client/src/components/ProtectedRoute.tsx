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
    console.log('JobSeeker routing - Path:', location.pathname, '| hasProfile:', hasProfile, '| verificationStatus:', profileVerificationStatus);
    
    // Handle profile creation page
    if (location.pathname === '/profile/create') {
      console.log('Profile creation page - checking conditions');
      // If user already has a profile, they shouldn't access profile creation
      if (hasProfile) {
        console.log('User has profile - redirecting from profile creation');
        // If profile is verified, go to dashboard, otherwise to verification pending
        if (profileVerificationStatus === 'verified') {
          console.log('Profile verified - redirecting to dashboard');
          return <Navigate to="/dashboard" replace />;
        } else {
          console.log('Profile pending verification - redirecting to verification pending');
          return <Navigate to="/profile-verification-pending" replace />;
        }
      }
      console.log('No profile - allowing access to profile creation');
      // If they don't have a profile, allow access to profile creation
    } 
    // Handle verification pending page
    else if (location.pathname === '/profile-verification-pending') {
      console.log('Verification pending page - checking conditions');
      // If user doesn't have a profile, they should create one first
      if (!hasProfile) {
        console.log('No profile - redirecting to profile creation');
        return <Navigate to="/profile/create" replace />;
      }
      // If profile is verified, they should go to dashboard
      if (profileVerificationStatus === 'verified') {
        console.log('Profile verified - redirecting to dashboard');
        return <Navigate to="/dashboard" replace />;
      }
      console.log('Profile pending verification - allowing access to verification pending');
      // Otherwise, allow access to verification pending
    }
    // Handle dashboard and other protected routes
    else if (location.pathname === '/dashboard' || location.pathname.startsWith('/jobseekers/')) {
      console.log('Dashboard or jobseeker route - checking conditions');
      // If user doesn't have a profile, they need to create one
      if (!hasProfile) {
        console.log('No profile - redirecting to profile creation');
        return <Navigate to="/profile/create" replace />;
      }
      // If profile is not verified, they can't access dashboard
      if (profileVerificationStatus !== 'verified') {
        console.log('Profile not verified - redirecting to verification pending');
        return <Navigate to="/profile-verification-pending" replace />;
      }
      console.log('Profile verified - allowing access to dashboard/jobseeker routes');
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