import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute, PublicRoute, JobSeekerRoute, RecruiterRoute } from './components/ProtectedRoute';
import { Signup } from './pages/Signup';
import { Login } from './pages/Login';
import { VerificationPending } from './pages/VerificationPending';
import { ProfileVerificationPending } from './pages/ProfileVerificationPending';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { ProfileCreate } from './pages/JobseekerProfile/ProfileCreate';
import { ProfileAccountCreated } from './pages/JobseekerProfile/ProfileAccountCreated';
import { JobSeekersList } from './pages/JobSeekersList';
import { JobSeekerProfile } from './pages/JobSeekerProfile';
import { GeometricShapes } from './components/GeometricShapes';
import { ProfileEdit } from './pages/JobseekerProfile/ProfileEdit';
import './styles/main.css';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="godspeed-theme">
      <AuthProvider>
        <Router>
          <GeometricShapes />
          <Routes>
            {/* Public routes */}
            <Route element={<PublicRoute />}>
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login />} />
              <Route path="/verification-pending" element={<VerificationPending />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
            </Route>

            {/* Routes accessible regardless of auth status */}
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes for all authenticated users */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile/create" element={<ProfileCreate />} />

              <Route element={<RecruiterRoute />}>
                <Route path="/profile-account-created" element={<ProfileAccountCreated />} />
                <Route path="/jobseekers" element={<JobSeekersList />} />
                <Route path="/jobseekers/:id" element={<JobSeekerProfile />} />
                <Route path="/jobseekers/:id/edit" element={<ProfileEdit />} />
                {/* Add more recruiter-specific routes here */}
              </Route>
              
              <Route element={<JobSeekerRoute />}>
                <Route path="/profile-verification-pending" element={<ProfileVerificationPending />} />
                {/* Add more jobseeker-specific routes here */}
              </Route>
              
            </Route>

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/signup" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
