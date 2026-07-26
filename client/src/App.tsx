import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';
import { AuthProvider } from './contexts/AuthContext';
import {
  ProtectedRoute,
  PublicRoute,
  JobSeekerRoute,
  RoleRoute,
  SuperAdminRoute,
} from './components/ProtectedRoute';
import { Signup } from './pages/Authentication/Signup';
import { Login } from './pages/Authentication/Login';
import { VerificationPending } from './pages/Authentication/VerificationPending';
import { EmailConfirmed } from './pages/Authentication/EmailConfirmed';
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
import { TimesheetView } from './pages/TimesheetManagement/TimesheetView';
import { TwoFactorAuth } from './pages/Authentication/TwoFactorAuth';
import { ClientManagement } from './pages/ClientManagement/ClientManagement';
import { InvoiceManagement } from './pages/InvoiceManagement/InvoiceManagement';
import { InvoiceList } from './pages/InvoiceManagement/InvoiceList';
import { InvoiceView } from './pages/InvoiceManagement/InvoiceView';
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
import { EnvelopePrintingByDueDateReport } from './pages/Reports/EnvelopePrintingByDueDateReport';
import { LanguageProvider } from "./contexts/language/language-provider";
import './styles/main.css';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { BulkTimesheetManagement } from './pages/TimesheetManagement/BulkTimesheetManagement';
import { BulkTimesheetJobseekerManagement } from './pages/TimesheetManagement/BulkTimesheetJobseekerManagement';
import { TimesheetList } from './pages/TimesheetManagement/TimesheetList';
import { GodspeedAIChat } from './pages/GodspeedAIChat';
import { RecruiterHierarchy } from './pages/RecruiterHierarchy';
import { InviteRecruiter } from './pages/RecruiterManagement/InviteRecruiter';
import { DropdownOptionsManagement } from './pages/Admin/DropdownOptionsManagement';
import { CalendarPage } from './pages/Calendar/CalendarPage';
import { ConsentListPage } from './pages/Consent/ConsentListPage';
import { CreateConsentPage } from './pages/Consent/CreateConsentPage';
import { ConsentDetailPage } from './pages/Consent/ConsentDetailPage';
import { ConsentTemplatePage } from './pages/Consent/ConsentTemplatePage';
import { EmailTemplatePreviewPage } from './pages/EmailTemplatePreview/EmailTemplatePreviewPage';
import { ConsentPage } from './pages/Consent/ConsentPage';
import { OnboardingConsent } from './pages/Consent/OnboardingConsent';
import { TermsOfService } from './pages/Legal/TermsOfService';
import { PrivacyPolicy } from './pages/Legal/PrivacyPolicy';
import {
  AI_CHAT_ROLES,
  ALL_USERS_ROLES,
  BULK_TIMESHEET_ROLES,
  CALENDAR_ROLES,
  CLIENT_CREATE_ROLES,
  CLIENT_DRAFT_ROLES,
  CLIENT_LIST_ROLES,
  CONSENT_CREATE_ROLES,
  CONSENT_LIST_ROLES,
  DROPDOWN_OPTIONS_ROLES,
  INVOICE_MANAGEMENT_ROLES,
  INVITE_INTERNAL_USER_ROLES,
  JOBSEEKER_CREATE_ROLES,
  JOBSEEKER_DRAFT_ROLES,
  JOBSEEKER_LIST_ROLES,
  JOBSEEKER_MANAGEMENT_CREATE_ROLES,
  POSITION_CREATE_ROLES,
  POSITION_DRAFT_ROLES,
  POSITION_LIST_ROLES,
  POSITION_MATCHING_ROLES,
  RECRUITER_HIERARCHY_ROLES,
  REPORTS_ROLES,
  SIN_WORK_PERMIT_ROLES,
  TIMESHEET_MANAGEMENT_ROLES,
} from './constants/accessControl';

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider defaultTheme="light" storageKey="godspeed-theme">
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
              <Route path="/email-confirmed" element={<EmailConfirmed />} />
              
              {/* Public consent page (no authentication required) */}
              <Route path="/consent" element={<ConsentPage />} />
              
              {/* Legal pages (no authentication required) */}
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />

              {/* Protected routes for all authenticated users */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<UserProfile />} />
                <Route path="/onboarding-consent" element={<OnboardingConsent />} />
                <Route path="/training-modules" element={<TrainingModules />} />

                <Route element={<RoleRoute allowedRoles={AI_CHAT_ROLES} />}>
                  <Route path="/ai-chat" element={<GodspeedAIChat />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={CALENDAR_ROLES} />}>
                  <Route path="/calendar" element={<CalendarPage />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={ALL_USERS_ROLES} />}>
                  <Route path="/all-users-management" element={<AllUsersManagement />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={JOBSEEKER_CREATE_ROLES} />}>
                  <Route path="/profile/create" element={<ProfileCreate />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={JOBSEEKER_MANAGEMENT_CREATE_ROLES} />}>
                  <Route path="/jobseekers/profile/account-created" element={<ProfileAccountCreated />} />
                  <Route path="/jobseekers/profile/success" element={<ProfileSuccess />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={JOBSEEKER_LIST_ROLES} />}>
                  <Route path="/jobseekers/:id" element={<JobSeekerProfile />} />
                  <Route path="/jobseeker-management" element={<JobSeekerManagement />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={JOBSEEKER_CREATE_ROLES} />}>
                  <Route path="/jobseekers/:id/edit" element={<ProfileEdit />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={SIN_WORK_PERMIT_ROLES} />}>
                  <Route path="/sin-work-permit-management" element={<SinWorkPermitManagement />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={JOBSEEKER_DRAFT_ROLES} />}>
                  <Route path="/jobseekers/drafts" element={<JobseekerDrafts />} />
                  <Route path="/jobseekers/drafts/edit/:id" element={<JobseekerProfileDraftEdit />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={CLIENT_LIST_ROLES} />}>
                  <Route path="/client-management" element={<ClientManagement />} />
                  <Route path="/client-management/view/:id" element={<ClientView />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={CLIENT_CREATE_ROLES} />}>
                  <Route path="/client-management/create" element={<ClientCreate />} />
                  <Route path="/client-management/edit/:id" element={<ClientEdit />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={CLIENT_DRAFT_ROLES} />}>
                  <Route path="/client-management/drafts" element={<ClientDrafts />} />
                  <Route path="/client-management/drafts/edit/:id" element={<ClientDraftEdit />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={POSITION_LIST_ROLES} />}>
                  <Route path="/position-management" element={<PositionManagement />} />
                  <Route path="/position-management/view/:id" element={<PositionView />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={POSITION_CREATE_ROLES} />}>
                  <Route path="/position-management/create" element={<PositionCreate />} />
                  <Route path="/position-management/create-subcategory" element={<PositionCreate defaultSubcategory={true} />} />
                  <Route path="/position-management/edit/:id" element={<PositionEdit />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={POSITION_DRAFT_ROLES} />}>
                  <Route path="/position-management/drafts" element={<PositionDrafts />} />
                  <Route path="/position-management/drafts/edit/:id" element={<PositionDraftEdit />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={POSITION_MATCHING_ROLES} />}>
                  <Route path="/position-matching" element={<PositionMatching />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={TIMESHEET_MANAGEMENT_ROLES} />}>
                  <Route path="/timesheet-management" element={<TimesheetManagement />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={BULK_TIMESHEET_ROLES} />}>
                  <Route path="/bulk-timesheet-management" element={<BulkTimesheetManagement />} />
                  <Route
                    path="/bulk-timesheet-management/jobseeker"
                    element={<BulkTimesheetJobseekerManagement />}
                  />
                  <Route path="/timesheet-management/list" element={<TimesheetList />} />
                  <Route path="/timesheet-management/view/:id" element={<TimesheetView />} />
                  <Route path="/timesheet-management/view" element={<TimesheetView />} />
                  <Route
                    path="/bulk-timesheet-management/list"
                    element={<Navigate to="/timesheet-management/list" replace />}
                  />
                </Route>

                <Route element={<RoleRoute allowedRoles={INVOICE_MANAGEMENT_ROLES} />}>
                  <Route path="/invoice-management" element={<InvoiceManagement />} />
                  <Route path="/invoice-management/create" element={<InvoiceManagement />} />
                  <Route path="/invoice-management/list" element={<InvoiceList />} />
                  <Route path="/invoice-management/view/:id" element={<InvoiceView />} />
                  <Route path="/invoice-management/view" element={<InvoiceView />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={REPORTS_ROLES} />}>
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/reports/weekly-timesheet" element={<WeeklyTimesheet />} />
                  <Route path="/reports/deduction" element={<DeductionReport />} />
                  <Route path="/reports/margin" element={<MarginReport />} />
                  <Route path="/reports/rate-list" element={<RateList />} />
                  <Route path="/reports/invoice" element={<InvoiceReport />} />
                  <Route path="/reports/clients" element={<ClientsReport />} />
                  <Route path="/reports/sales" element={<SalesReport />} />
                  <Route path="/reports/envelope-printing-position" element={<EnvelopePrintingReport />} />
                  <Route path="/reports/envelope-printing-by-due-date" element={<EnvelopePrintingByDueDateReport />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={RECRUITER_HIERARCHY_ROLES} />}>
                  <Route path="/recruiter-hierarchy" element={<RecruiterHierarchy />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={CONSENT_LIST_ROLES} />}>
                  <Route path="/consent-dashboard" element={<ConsentListPage />} />
                  <Route path="/consent-dashboard/:documentId" element={<ConsentDetailPage />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={CONSENT_CREATE_ROLES} />}>
                  <Route path="/consent-dashboard/new" element={<CreateConsentPage />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={DROPDOWN_OPTIONS_ROLES} />}>
                  <Route path="/admin/dropdown-options" element={<DropdownOptionsManagement />} />
                </Route>

                <Route element={<RoleRoute allowedRoles={INVITE_INTERNAL_USER_ROLES} />}>
                  <Route path="/invite-recruiter" element={<InviteRecruiter />} />
                </Route>

                <Route element={<SuperAdminRoute />}>
                  <Route path="/consent-dashboard/templates" element={<ConsentTemplatePage />} />
                  <Route path="/email-template-preview" element={<EmailTemplatePreviewPage />} />
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
