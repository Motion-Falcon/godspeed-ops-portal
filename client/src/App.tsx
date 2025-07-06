import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute, PublicRoute, JobSeekerRoute, RecruiterRoute } from './components/ProtectedRoute';
import { Signup } from './pages/Signup';
import { Login } from './pages/Login';
import { VerificationPending } from './pages/VerificationPending';
import { ProfileVerificationPending } from './pages/ProfileVerificationPending';
import { ProfileVerificationRejected } from './pages/ProfileVerificationRejected';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { ProfileCreate } from './pages/JobseekerProfile/ProfileCreate';
import { ProfileAccountCreated } from './pages/JobseekerProfile/ProfileAccountCreated';
import { ProfileSuccess } from './pages/JobseekerProfile/ProfileSuccess';
import { JobSeekerProfile } from './pages/JobSeekerProfile';
import { GeometricShapes } from './components/GeometricShapes';
import { ProfileEdit } from './pages/JobseekerProfile/ProfileEdit';
import { ClientCreate } from './pages/ClientManagement/ClientCreate';
import { ClientEdit } from './pages/ClientManagement/ClientEdit';
import { ClientDrafts } from './pages/ClientManagement/ClientDrafts';
import { ClientDraftEdit } from './pages/ClientManagement/ClientDraftEdit';
import { ClientView } from './pages/ClientManagement/ClientView';
import { JobSeekerManagement } from './pages/JobSeekerManagement';
import { PositionManagement } from './pages/PositionManagement';
import { PositionCreate } from './pages/PositionManagement/PositionCreate';
import { PositionEdit } from './pages/PositionManagement/PositionEdit';
import { PositionDrafts } from './pages/PositionManagement/PositionDrafts';
import { PositionDraftEdit } from './pages/PositionManagement/PositionDraftEdit';
import { PositionView } from './pages/PositionManagement/PositionView';
import { PositionMatching } from './pages/PositionMatching';
import { JobseekerDrafts } from './pages/JobseekerProfile/JobseekerDrafts';
import { JobseekerProfileDraftEdit } from './pages/JobseekerProfile/JobseekerProfileDraftEdit';
import { TrainingModules } from './pages/TrainingModules';
import { UserProfile } from './pages/UserProfile';
import { JobSeekerPositions } from './pages/JobSeekerPositions';
import { TimesheetManagement } from './pages/TimesheetManagement/TimesheetManagement';
import './styles/main.css';
import { TwoFactorAuth } from './pages/TwoFactorAuth';
import { Dashboard } from './pages/dashboard/Dashboard';
import { MetricExamplePage } from './pages/dashboard/MetricExamplePage';
import { ClientManagement } from './pages/ClientManagement/ClientManagement';
import { InvoiceManagement } from './pages/InvoiceManagement/InvoiceManagement';
import { InvoiceList } from './pages/InvoiceManagement/InvoiceList';
import { AllUsersManagement } from './pages/AllUsersManagement';
import FloatingChat from './components/FloatingChat';
import { Reports } from './pages/Reports/Reports';
import { WeeklyTimesheet } from './pages/Reports/WeeklyTimesheet';
import { MarginReport } from './pages/Reports/MarginReport';
import { RateList } from './pages/Reports/RateList';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="godspeed-theme">
      <AuthProvider>
        <Router>
          <GeometricShapes />
          <FloatingChat />
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
            <Route path="/two-factor-auth" element={<TwoFactorAuth />} />

            {/* Protected routes for all authenticated users */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<UserProfile />} />
              <Route path="/profile/create" element={<ProfileCreate />} />
              <Route path="/jobseekers/:id/edit" element={<ProfileEdit />} />
              <Route path="/jobseekers/:id" element={<JobSeekerProfile />} />
              <Route path="/training-modules" element={<TrainingModules />} />
              <Route path="/metric-examples" element={<MetricExamplePage />} />
              <Route path="/reports" element={<Reports />} />

              <Route element={<RecruiterRoute />}>
                <Route path="/jobseekers/profile/account-created" element={<ProfileAccountCreated />} />
                <Route path="/jobseekers/profile/success" element={<ProfileSuccess />} />
                <Route path="/jobseeker-management" element={<JobSeekerManagement />} />
                <Route path="/all-users-management" element={<AllUsersManagement />} />
                <Route path="/jobseekers/drafts" element={<JobseekerDrafts />} />
                <Route path="/jobseekers/drafts/edit/:id" element={<JobseekerProfileDraftEdit />} />
                <Route path="/client-management" element={<ClientManagement />} />
                <Route path="/client-management/create" element={<ClientCreate />} />
                <Route path="/client-management/view/:id" element={<ClientView />} />
                <Route path="/client-management/edit/:id" element={<ClientEdit />} />
                <Route path="/client-management/drafts" element={<ClientDrafts />} />
                <Route path="/client-management/drafts/edit/:id" element={<ClientDraftEdit />} />
                <Route path="/position-management" element={<PositionManagement />} />
                <Route path="/position-management/create" element={<PositionCreate />} />
                <Route path="/position-management/view/:id" element={<PositionView />} />
                <Route path="/position-management/edit/:id" element={<PositionEdit />} />
                <Route path="/position-management/drafts" element={<PositionDrafts />} />
                <Route path="/position-management/drafts/edit/:id" element={<PositionDraftEdit />} />
                <Route path="/position-matching" element={<PositionMatching />} />
                <Route path="/timesheet-management" element={<TimesheetManagement />} />
                <Route path="/invoice-management" element={<InvoiceManagement />} />
                <Route path="/invoice-management/create" element={<InvoiceManagement />} />
                <Route path="/invoice-management/list" element={<InvoiceList />} />
                <Route path="/reports/weekly-timesheet" element={<WeeklyTimesheet />} />
                <Route path="/reports/margin" element={<MarginReport />} />
                <Route path="/reports/rate-list" element={<RateList />} />
                {/* Add more recruiter-specific routes here */}
              </Route>
              
              <Route element={<JobSeekerRoute />}>
                <Route path="/profile-verification-pending" element={<ProfileVerificationPending />} />
                <Route path="/profile-verification-rejected" element={<ProfileVerificationRejected />} />
                <Route path="/my-positions" element={<JobSeekerPositions />} />
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
