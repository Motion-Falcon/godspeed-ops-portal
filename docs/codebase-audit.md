I audited the codebase from the actual implementation. Both builds pass: `client pnpm build` and `server pnpm build`.

Status key: **Fully working** means the code path is wired end to end assuming env services are configured. **Partially built** means meaningful code exists but wiring, permissions, UI, or dependencies are incomplete. **Scaffolded/stubbed** means mostly placeholder, disabled, or demo-only.

**Platform & Access**
- Authentication and account lifecycle: Users can register, log in, verify email/phone, reset passwords, complete onboarding, and fetch their current session/profile. Access: all user types. Status: **Fully working**.
- Internal 2FA: Internal users are required to verify by phone OTP after password login. Access: admin/recruiter-type internal users. Status: **Partially built** because the password is temporarily carried through client route state during 2FA.
- Role-based access control: Routes, menus, and backend middleware restrict features by role. Access: all roles. Status: **Partially built** because several frontend/backend role rules do not match.
- Jobseeker onboarding gates: Jobseekers are forced through employment agreement, profile creation, pending, rejected, or verified flows. Access: jobseeker. Status: **Fully working**.
- Internal user invitations and hierarchy: Admin-style users can invite recruiters/internal users, assign managers, and manage user roles/hierarchy. Access: admin, recruiter managers/directors in UI. Status: **Partially built** due permission mismatches with backend.
- Theme, language, legal pages: App supports light/dark theme, English/French locale toggling (including merged `en/timesheet.json` and `fr/timesheet.json` bundles for all timesheet screens), terms, and privacy pages. Access: all users/public where applicable. Status: **Fully working**.
- Sidebar menu scroll persistence: Hamburger menu restores scroll position across navigation and refresh via session storage (`menuScrollState.ts`). Access: users with sidebar. Status: **Fully working**.
- Company switcher: Header has a company selector component. Access: internal users if enabled. Status: **Scaffolded/stubbed**; I did not see it enabled by a real route.

**Jobseeker Management**
- Jobseeker profile creation/editing: Captures personal info, work preferences, payment details, documents, SIN/work permit data, and profile metadata. Access: jobseeker, admin, recruiter, recruiter manager/director. Status: **Fully working**.
- Profile drafts: Jobseeker profiles can be saved as drafts and resumed/deleted. Access: admin, recruiter, recruiter manager/director. Status: **Fully working**.
- Profile verification: Internal users can approve/reject jobseeker profiles and jobseekers see pending/rejected states. Access: admin/recruiter-type roles. Status: **Fully working**.
- Jobseeker listing/search/filtering: Internal users can browse, filter, paginate, update, and delete jobseekers. Access: admin, recruiter, bookkeeper, recruiter/accountant managers, recruiter director. Status: **Fully working**, with backend access broader than UI in places.
- Jobseeker detail view: Shows profile, documents, position assignments, and consent records. Access: permitted internal users and jobseeker self-flows. Status: **Fully working**.
- Jobseeker self-service profile and positions: Jobseekers can view their own profile and assigned positions. Access: jobseeker. Status: **Fully working**.
- Expiry monitoring: SIN/work permit expiry fields and expiry count metrics exist. Access: internal roles. Status: **Partially built**; one metrics route ordering/authorization issue may break some calls.

**Client Management**
- Client CRUD: Users can create, view, update, delete, and search clients with contacts, billing, addresses, payment, WSIB, and status fields. Access: admin, recruiter manager, accountant manager, recruiter director. Status: **Fully working**.
- Client drafts: Client forms can be saved, resumed, listed, and deleted as drafts. Access: admin, recruiter manager, accountant manager, recruiter director. Status: **Fully working**.
- Client consent history: Client profiles can show related consent records. Access: internal consent/client roles. Status: **Fully working**.
- Client inactivity tracking: Database fields and monitor logic exist for last activity/inactive clients. Access: internal users. Status: **Partially built**; I saw backend/schema support, but not a complete dedicated management UI.

**Position & Placement**
- Position CRUD: Users can create, edit, delete, list, and view positions with client, dates, rates, shifts, category/subcategory, and premium pay fields. Access: admin, recruiter, bookkeeper, recruiter/accountant managers, recruiter director for viewing; create/edit mostly manager/admin/director. Status: **Fully working**.
- Position drafts: Positions can be saved and resumed as drafts. Access: admin, recruiter manager, recruiter director. Status: **Fully working**.
- Position code generation: Backend generates unique position codes. Access: position creators. Status: **Fully working**.
- Candidate matching and assignment: Positions can surface candidates and assign/remove jobseekers. Access: admin, recruiter, recruiter manager/director. Status: **Partially built** because matching depends on embedding/vector infrastructure and DB functions.
- Candidate assignment tracking: Assignment lists are available by position and by candidate. Access: internal users and jobseeker self views. Status: **Fully working**.
- Invoicing-only position subcategories: Schema and logic distinguish invoice-only subcategories from normal assignment/calendar use. Access: position managers. Status: **Fully working**.

**Timesheet & Payroll**

_Module layout (May 2026):_ Client code lives under `client/src/pages/TimesheetManagement/` (pages, hooks, components, calculation helpers). Server API was split from monolithic `routes/timesheets.ts` into `routes/timesheet.routes.ts`, `controllers/timesheet.controller.ts`, `services/timesheet.service.ts`, `services/timesheet.email.ts`, and `types/timesheet.types.ts`. Routes remain mounted at `/api/timesheets`.

| Route | Page | UI roles |
| --- | --- | --- |
| `/timesheet-management` | Single timesheet | `TIMESHEET_MANAGEMENT_ROLES` |
| `/bulk-timesheet-management` | Bulk by client | `BULK_TIMESHEET_ROLES` (admin, bookkeeper) |
| `/bulk-timesheet-management/jobseeker` | Bulk by jobseeker | `BULK_TIMESHEET_ROLES` |
| `/timesheet-management/list` | All timesheets | `BULK_TIMESHEET_ROLES` |
| `/bulk-timesheet-management/list` | Redirect → list | — |

- Single timesheet entry: Jobseeker → client → position → week cascade; daily hours grid; load/create/update one record per combination; live payroll preview; bonus/deduction/notes; optional email on submit. Access: admin, recruiter, bookkeeper, recruiter manager/director (UI). Status: **Fully working**.
- Hybrid payroll split: Shared `timesheetCalculations.ts` drives regular/overtime, premium rates, payment-method deductions, and SIN cap behavior in single and bulk forms. Access: timesheet roles. Status: **Fully working**.
- Bulk timesheet (client-centric): Select client, position, week; auto-load assigned jobseekers; per-worker forms; batch submit creates **one timesheet per worker** with unique invoice numbers, progress UI, duplicate skip, and partial-failure reporting. Invoice-only subcategory positions show a banner (no assignees). Access: admin, bookkeeper. Status: **Fully working** for create/update batch flows.
- Bulk timesheet (jobseeker-centric): Select jobseeker, client, week; add multiple position rows (`BulkJobseekerPositionCard`); prefills existing week data; same per-row invoice/batch submit behavior as client bulk. Access: admin, bookkeeper. Status: **Fully working** for create/update batch flows.
- All timesheets list: Paginated index with column filters (invoice #, client, position, jobseeker, billing email, date range, email status); send/resend email per row; header shortcuts to both bulk creators. Access: admin, bookkeeper. Status: **Fully working** for list/filter/email; **Partially built** for delete (see below).
- Timesheet email workflow: Create/update optional email via `emailNotifier`; manual send via `POST /api/timesheets/send-email/:id`; templates in `email-templates/timesheet-*.ts`. Prefers billing email over primary. Access: timesheet roles (backend `authorizeRoles(["admin","recruiter","jobseeker"])` expands `recruiter` to include bookkeeper and other internal roles). Status: **Fully working** if SendGrid/config is present.
- Timesheet delete API: `DELETE /api/timesheets/:id` implemented with activity logging. Access: same expanded recruiter group. Status: **Fully working** on server; **not wired** from current timesheet UI pages.
- Timesheet list delete UI: `ConfirmationModal` and `deleteTimesheet` API client exist, but `useTimesheetsList.handleConfirmDelete` is an empty placeholder and `TimesheetListTable` has no delete action buttons—only email actions. Status: **Partially built**.
- Timesheet detail view from list: No dedicated view/edit route from list rows; staff use single or bulk entry screens to edit by selection. Status: **Not present** on list (by design currently).
- Document metadata on timesheet: `PATCH /api/timesheets/:id/document` for attachment metadata. Access: timesheet roles. Status: **Fully working** where used.
- Deprecated client paths: `pages/BulkTimesheetManagement/` removed; old `BulkTimesheetList` removed; `/bulk-timesheet-management/list` redirects to `/timesheet-management/list`.

**Invoicing & Billing**
- Invoice creation/editing: Users can build invoices from timesheets, manual line items, supplier/PO details, tax settings, notes, payment terms, and attachments. Access: admin, accountant manager. Status: **Fully working**.
- Invoice PDF generation/storage/preview: Client code generates PDFs and updates invoice document metadata. Access: invoice roles. Status: **Fully working**.
- Invoice list/search/send/delete: Users can list, filter, delete, send, and resend invoices. Access: admin, accountant manager. Status: **Fully working**.
- Invoice number generation: Backend generates invoice numbers for invoices/timesheets. Access: billing/timesheet roles. Status: **Fully working**.

**Reports & Analytics**
- Reports hub: Dedicated reports area links to timesheet, margin, invoice, deduction, rate list, clients, sales, and envelope-printing reports. Access: admin, bookkeeper, accountant manager, recruiter director. Status: **Fully working**.
- CSV export/filtering: Report pages support filters and export utilities. Access: report roles. Status: **Fully working**.
- Operational metrics: Dashboards pull recruiter, client, position, timesheet, invoice, jobseeker, and AI metrics. Access: dashboard roles. Status: **Partially built** because some metrics endpoints have authorization/order issues.
- AI insights analytics: Counts AI validation records and position capacity. Access: internal dashboards. Status: **Partially built**; server contains a TODO about missing/unused historical `created_at` logic.

**Digital Consent & Compliance**
- Consent requests: Users can create consent documents for clients/jobseekers, select templates, upload/generate documents, and send signing links. Access: UI allows admin/recruiter/manager/director roles. Status: **Partially built** due backend requiring superadmin on request creation.
- Public consent signing: Tokenized public pages let recipients view and submit signed consent. Access: public token holders. Status: **Fully working**.
- Consent records dashboard/detail: Internal users can view consent records, documents, statuses, and entity history. Access: consent roles. Status: **Fully working**.
- Consent templates: Templates and autofill field definitions exist. Access: superadmin UI/admin backend. Status: **Partially built** due role mismatch.
- Jobseeker employment agreement: Jobseekers must complete onboarding consent before normal app access. Access: jobseeker. Status: **Fully working**.
- Legal pages: Terms and privacy pages exist as public routes. Access: public/all users. Status: **Fully working**.

**AI Features**
- AI chat page: Internal users can open an embedded external AI chat app in an iframe. Access: internal staff roles. Status: **Partially built** because the main app delegates functionality to an external service.
- Floating AI chat widget: A richer streaming chat component exists. Access: would be internal users. Status: **Scaffolded/stubbed**; it is commented out in `App.tsx`.
- AI document validation: Profile create/update calls an AI validation service asynchronously for uploaded documents. Access: jobseeker/profile flows. Status: **Partially built** because failures are logged but do not affect user flow.
- AI candidate matching infrastructure: Vector/embedding schema and candidate matching behavior exist. Access: placement roles. Status: **Partially built** because it depends on optional DB embedding functions/services.

**Training**
- Video training modules: Training page shows YouTube-based modules for AODA, workplace violence/harassment, WHMIS, and health/safety. Access: internal users and jobseekers. Status: **Fully working** for playback.
- Document/interactive modules: Additional modules are marked coming soon. Access: training users. Status: **Scaffolded/stubbed**.
- Training completion tracking: Module data has completion fields but no persistent backend tracking. Access: training users. Status: **Scaffolded/stubbed**.

**Dashboards & Activity**
- Role dashboards: App routes users to admin, recruiter, or jobseeker dashboard variants. Access: respective roles. Status: **Fully working**, except metrics caveats.
- Recent activity feed: Server logs activities and client subscribes to realtime activity updates. Access: dashboard/internal views. Status: **Fully working**.
- Jobseeker dashboard metrics: Jobseekers see profile/position-related dashboard data. Access: jobseeker. Status: **Partially built**; backend jobseeker metrics route appears not to allow jobseeker role.
- Metrics example page: Demo metrics route/page exists. Access: all authenticated users. Status: **Scaffolded/stubbed**.

**Calendar**
- Calendar events: Calendar displays position and assignment-based events with day/month views. Access: internal staff roles. Status: **Fully working**.
- Calendar summaries: Backend returns event summaries for date ranges. Access: internal staff roles. Status: **Fully working**.
- Calendar filters: Client/jobseeker filter component and some quick filters are present but commented out. Access: internal staff roles. Status: **Scaffolded/stubbed**.

**Communications & Notifications**
- Email workflows: Code supports verification, welcome, first-login reminder, onboarding reminder, employment agreement, consent, assignment/removal, timesheet, invoice, and recruiter invitation emails. Access: relevant users. Status: **Fully working** if SendGrid/Supabase email config is present.
- Email template preview: Preview route exists for template rendering. Access: superadmin route. Status: **Fully working**.
- SMS OTP: Twilio-backed phone OTP is used for verification and 2FA. Access: users with phone verification flows. Status: **Fully working** if Twilio env vars are configured.
- Toast notifications: UI uses toasts for success/error feedback. Access: all authenticated users. Status: **Fully working**.
- General notification center: I did not find a real inbox/notification center. Status: **Not present**.

**Admin & Configuration**
- Dropdown option management: Admin/config UI manages dropdown values used across forms. Access: admin/manager/director in UI. Status: **Partially built** because backend writes appear admin-only.
- User and role management: User list, role update, manager assignment, and hierarchy routes exist. Access: admin/recruiter director in UI. Status: **Partially built** because backend allows broader recruiter-style access.
- Recruiter hierarchy: Dedicated hierarchy data/routes exist. Access: admin/recruiter director UI. Status: **Fully working** with permission caveat.
- Security headers/CORS: Server configures Helmet, CORS, JSON limits, and auth middleware. Access: platform-level. Status: **Partially built**.
- Database migrations/RLS/storage: Migrations define tables, indexes, RLS helpers, storage buckets, triggers, and realtime publication. Access: platform-level. Status: **Partially built** because app often uses service-role server access, so route authorization is the main enforcement layer.

**Clear Flags**
- **Security concern:** Global API rate limiting is defined but disabled, and many sensitive route-level limiters are commented out, including auth-adjacent/public consent paths.
- **Security concern:** Backend permissions are often broader than frontend permissions because `authorizeRoles(["recruiter"])` expands to several internal roles. Reports, invoices, users, and other APIs may be callable by roles that the UI does not expose.
- **Bug/permission mismatch:** Consent request creation UI allows several roles, but backend uses `requireSuperAdmin`; many users may see the UI and fail on submit.
- **Bug/permission mismatch:** Dropdown option management UI allows manager/director roles, but backend write routes appear admin-only.
- **Bug/permission mismatch:** Internal user invite/resend UI allows manager/director roles, but backend invite routes appear admin-only.
- **Bug:** Jobseeker dashboard metrics likely fail for jobseekers because the candidate metrics endpoint allows admin/recruiter roles only.
- **Bug:** `GET /api/metrics/jobseekers/:candidateId` appears before `GET /api/metrics/jobseekers/expiry-status-counts`, so the expiry route may be swallowed as a candidate ID.
- **UI without active backend/use:** Training completion/progress, company switcher, metrics example page, and calendar filters are present but not fully wired.
- **Commented out/scaffolded:** Floating AI chat widget, calendar filter UI, and several “coming soon” training modules.
- **Timesheet list delete not wired:** Backend delete and client `deleteTimesheet()` exist; list confirm handler is a no-op and table exposes no delete control—only email send/resend.
- **Doc drift (timesheet):** `docs/email-triggers-documentation.txt` and `docs/email-triggers-table.txt` still cite removed `server/src/routes/timesheets.ts`; handlers now live under `timesheet.routes.ts` / `timesheet.controller.ts`.
- **Security concern if re-enabled:** Floating AI chat renders markdown with `dangerouslySetInnerHTML` and sanitization disabled; it is currently inactive.
- **Maintainability concern:** Several debug `console.log` calls remain in header/activity code.
- **Build concern:** Client bundle is very large and Vite reports eval usage from dependencies, but build succeeds.

*Last updated: May 24, 2026 — Timesheet & Payroll section expanded after module refactor, jobseeker bulk entry, and all-timesheets list.*

Audit complete.
