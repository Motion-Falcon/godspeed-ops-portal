import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute, PublicRoute, JobSeekerRoute, RecruiterRoute, AdminRoute } from './components/ProtectedRoute';
import { Signup } from './pages/Authentication/Signup';
import { Login } from './pages/Authentication/Login';
import { VerificationPending } from './pages/Authentication/VerificationPending';
import { CompleteSignup } from './pages/Authentication/CompleteSignup';
import { ProfileVerificationPending } from './pages/JobseekerManagement/ProfileVerificationPending';
import { ProfileVerificationRejected } from './pages/JobseekerManagement/ProfileVerificationRejected';
import { ForgotPassword } from './pages/Authentication/ForgotPassword';
import { ResetPassword } from './pages/Authentication/ResetPassword';
import { ProfileCreate } from './pages/JobseekerProfile/ProfileCreate';
import { ProfileAccountCreated } from './pages/JobseekerProfile/ProfileAccountCreated';
import { ProfileSuccess } from './pages/JobseekerProfile/ProfileSuccess';
import { JobSeekerProfile } from './pages/JobseekerManagement/JobSeekerProfile';
import { GeometricShapes } from './components/GeometricShapes';
import { ProfileEdit } from './pages/JobseekerProfile/ProfileEdit';
import { ClientCreate } from './pages/ClientManagement/ClientCreate';
import { ClientEdit } from './pages/ClientManagement/ClientEdit';
import { ClientDrafts } from './pages/ClientManagement/ClientDrafts';
import { ClientDraftEdit } from './pages/ClientManagement/ClientDraftEdit';
import { ClientView } from './pages/ClientManagement/ClientView';
import { JobSeekerManagement } from './pages/JobseekerManagement/JobSeekerManagement';
import { SinWorkPermitManagement } from './pages/JobseekerManagement/SinWorkPermitManagement';
import { PositionManagement } from './pages/PositionManagement/PositionManagement';
import { PositionCreate } from './pages/PositionManagement/PositionCreate';
import { PositionEdit } from './pages/PositionManagement/PositionEdit';
import { PositionDrafts } from './pages/PositionManagement/PositionDrafts';
import { PositionDraftEdit } from './pages/PositionManagement/PositionDraftEdit';
import { PositionView } from './pages/PositionManagement/PositionView';
import { PositionMatching } from './pages/PositionManagement/PositionMatching';
import { JobseekerDrafts } from './pages/JobseekerProfile/JobseekerDrafts';
import { JobseekerProfileDraftEdit } from './pages/JobseekerProfile/JobseekerProfileDraftEdit';
import { TrainingModules } from './pages/TrainingModules';
import { UserProfile } from './pages/UserProfile';
import { JobSeekerPositions } from './pages/JobseekerManagement/JobSeekerPositions';
import { TimesheetManagement } from './pages/TimesheetManagement/TimesheetManagement';
import { TwoFactorAuth } from './pages/Authentication/TwoFactorAuth';
import { ClientManagement } from './pages/ClientManagement/ClientManagement';
import { InvoiceManagement } from './pages/InvoiceManagement/InvoiceManagement';
import { InvoiceList } from './pages/InvoiceManagement/InvoiceList';
import { AllUsersManagement } from './pages/AllUsersManagement';
// import FloatingChat from './components/FloatingChat';
import { Reports } from './pages/Reports/Reports';
import { WeeklyTimesheet } from './pages/Reports/WeeklyTimesheet';
import { MarginReport } from './pages/Reports/MarginReport';
import { RateList } from './pages/Reports/RateList';
import { DeductionReport } from './pages/Reports/DeductionReport';
import { InvoiceReport } from './pages/Reports/InvoiceReport';
import { ClientsReport } from './pages/Reports/ClientsReport';
import { SalesReport } from './pages/Reports/SalesReport';
import { EnvelopePrintingReport } from './pages/Reports/EnvelopePrintingReport';
import { LanguageProvider } from "./contexts/language/language-provider";
import './styles/main.css';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { MetricExamplePage } from './pages/Dashboard/MetricExamplePage';
import { BulkTimesheetManagement } from './pages/BulkTimesheetManagement/BulkTimesheetManagement';
import { BulkTimesheetList } from './pages/BulkTimesheetManagement/BulkTimesheetList';
import { GodspeedAIChat } from './pages/GodspeedAIChat';
import { RecruiterHierarchy } from './pages/RecruiterHierarchy';
import { InviteRecruiter } from './pages/RecruiterManagement/InviteRecruiter';
import { CalendarPage } from './pages/Calendar/CalendarPage';
import { ConsentListPage } from './pages/Consent/ConsentListPage';
import { CreateConsentPage } from './pages/Consent/CreateConsentPage';
import { ConsentDetailPage } from './pages/Consent/ConsentDetailPage';
import { ConsentPage } from './pages/Consent/ConsentPage';

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider defaultTheme="system" storageKey="godspeed-theme">
        <AuthProvider>
          <Router>
            <GeometricShapes />
            {/* <FloatingChat /> */}
            <Routes>
              {/* Public routes */}
              <Route element={<PublicRoute />}>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/verification-pending" element={<VerificationPending />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/complete-signup" element={<CompleteSignup />} />
              </Route>

              {/* Routes accessible regardless of auth status */}
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/two-factor-auth" element={<TwoFactorAuth />} />
              
              {/* Public consent page (no authentication required) */}
              <Route path="/consent" element={<ConsentPage />} />

              {/* Protected routes for all authenticated users */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<UserProfile />} />
                <Route path="/profile/create" element={<ProfileCreate />} />
                <Route path="/jobseekers/:id/edit" element={<ProfileEdit />} />
                <Route path="/jobseekers/:id" element={<JobSeekerProfile />} />
                <Route path="/training-modules" element={<TrainingModules />} />
                <Route path="/ai-chat" element={<GodspeedAIChat />} />
                <Route path="/metric-examples" element={<MetricExamplePage />} />
                <Route path="/reports" element={<Reports />} />

                <Route element={<RecruiterRoute />}>
                  <Route path="/jobseekers/profile/account-created" element={<ProfileAccountCreated />} />
                  <Route path="/jobseekers/profile/success" element={<ProfileSuccess />} />
                  <Route path="/jobseeker-management" element={<JobSeekerManagement />} />
                  <Route path="/sin-work-permit-management" element={<SinWorkPermitManagement />} />
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
                  <Route path="/reports/deduction" element={<DeductionReport />} />
                  <Route path="/reports/margin" element={<MarginReport />} />
                  <Route path="/reports/rate-list" element={<RateList />} />
                  <Route path="/reports/invoice" element={<InvoiceReport />} />
                  <Route path="/reports/clients" element={<ClientsReport />} />
                  <Route path="/reports/sales" element={<SalesReport />} />
                  <Route path="/reports/envelope-printing-position" element={<EnvelopePrintingReport />} />
                  <Route path="/bulk-timesheet-management" element={<BulkTimesheetManagement />} />
                  <Route path="/bulk-timesheet-management/list" element={<BulkTimesheetList />} />
                  <Route path="/recruiter-hierarchy" element={<RecruiterHierarchy />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/consent-dashboard" element={<ConsentListPage />} />
                  <Route path="/consent-dashboard/new" element={<CreateConsentPage />} />
                  <Route path="/consent-dashboard/:documentId" element={<ConsentDetailPage />} />
                  {/* Add more recruiter-specific routes here */}
                </Route>

                <Route element={<AdminRoute />}>
                  <Route path="/invite-recruiter" element={<InviteRecruiter />} />
                </Route>
                
                <Route element={<JobSeekerRoute />}>
                  <Route path="/profile-verification-pending" element={<ProfileVerificationPending />} />
                  <Route path="/profile-verification-rejected" element={<ProfileVerificationRejected />} />
                  <Route path="/my-positions" element={<JobSeekerPositions />} />
                  {/* Add more jobseeker-specific routes here */}
                </Route>
                
              </Route>

              {/* Redirects */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
