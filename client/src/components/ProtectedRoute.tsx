import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types/auth';

interface RoleRouteProps {
  allowedRoles?: UserRole[];
}

export const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

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