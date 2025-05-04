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
import { ProfileSuccess } from './pages/JobseekerProfile/ProfileSuccess';
import { JobSeekersList } from './pages/JobSeekersList';
import { JobSeekerProfile } from './pages/JobSeekerProfile';
import { GeometricShapes } from './components/GeometricShapes';
import { ProfileEdit } from './pages/JobseekerProfile/ProfileEdit';
import { ClientManagement } from './pages/ClientManagement';
import { ClientCreate } from './pages/ClientManagement/ClientCreate';
import { ClientEdit } from './pages/ClientManagement/ClientEdit';
import { ClientDrafts } from './pages/ClientManagement/ClientDrafts';
import { ClientDraftEdit } from './pages/ClientManagement/ClientDraftEdit';
import { ClientView } from './pages/ClientManagement/ClientView';
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
              <Route path="/jobseekers/:id/edit" element={<ProfileEdit />} />
              <Route path="/jobseekers/:id" element={<JobSeekerProfile />} />

              <Route element={<RecruiterRoute />}>
                <Route path="/jobseekers/profile/account-created" element={<ProfileAccountCreated />} />
                <Route path="/jobseekers/profile/success" element={<ProfileSuccess />} />
                <Route path="/jobseekers" element={<JobSeekersList />} />
                <Route path="/client-management" element={<ClientManagement />} />
                <Route path="/client-management/create" element={<ClientCreate />} />
                <Route path="/client-management/view/:id" element={<ClientView />} />
                <Route path="/client-management/edit/:id" element={<ClientEdit />} />
                <Route path="/client-management/drafts" element={<ClientDrafts />} />
                <Route path="/client-management/drafts/edit/:id" element={<ClientDraftEdit />} />
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
