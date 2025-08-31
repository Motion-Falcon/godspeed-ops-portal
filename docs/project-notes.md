## Godspeed Ops Portal – Project Notes

Last updated: <!-- DATE -->

### Purpose
Working notes collected while scanning the `client/` and `server/` folders. Use this file to generate concise executive summaries and to provide context for ideation.

### High-level Overview
- App type: React + Vite frontend, Node/Express backend
- Auth: Supabase Auth, JWT in frontend context; server middleware for token verification
- DB: PostgreSQL (Supabase) with SQL migrations
- Realtime: Supabase realtime for recent activities
- Internationalization: Custom `useLanguage()` context with `en` and `fr` JSON locales
- Activity logging: Centralized middleware driving recent activity feed and audit

---

### Client
#### Tech & Structure
- Build tool: Vite
- TypeScript React app
- Key directories: `components/`, `pages/`, `contexts/`, `services/api/`, `styles/`

#### Core Concepts
- Language provider with `t(key, vars)` for all UI strings
- Auth context wrapping routes and protected pages
- Dashboard widgets including recent activities feed and metrics
- Feature areas: Users, Clients, Positions, Jobseekers, Timesheets, Invoices, Reports, Training

#### Notable Files
- `src/App.tsx`: Router and layout integration
- `src/contexts/language/`: Provider and translation files
- `src/services/api/`: Typed API layer for server routes
- `src/hooks/useRecentActivities.ts`: Realtime feed subscription

---

### Server
#### Tech & Structure
- Express app with modular routes
- Middleware: Auth, Activity Logger, Email Notifier, Security
- SQL migrations for schema and RLS policies

#### Core Concepts
- Activity logging pattern: middleware captures post-handler entity via `res.locals`
- Domain routes for: auth, users, clients, positions, invoices, reports, timesheets
- Email templates for notifications and onboarding

#### Notable Files
- `src/index.ts`: App bootstrap and route registration
- `src/middleware/activityLogger.ts`: Central activity capture & broadcast
- `src/db/migrations/`: Schema evolution and realtime setup

---

### API Endpoints (to be enumerated)
High-level: `/api/auth`, `/api/user`, `/api/clients`, `/api/positions`, `/api/invoices`, `/api/timesheets`, `/api/reports`, `/api/ai-insights`, etc.

---

### Data Model Notes (to be enumerated)
Key tables: users, jobseeker_profiles (+ drafts), clients, positions (+ drafts), invoices, timesheets, bulk_timesheets, recent_activities

---

### Realtime & Activity Feed (initial)
- `recent_activities` table and realtime broadcast triggers
- Client `useRecentActivities` subscribes for updates

---

### Internationalization Rules
- All user-facing strings must use `t()`
- Keys mirrored in `en.json` and `fr.json`

---

### Build & Deploy
- Vite client build
- Node/Express server
- Supabase as backend services provider

---

### Findings
<!-- APPEND FINDINGS BELOW. Keep concise, link to files, include key patterns and TODOs. -->

#### Client (React + Vite)
- Routing and layout: `src/App.tsx` mounts providers and defines routes with role guards.
  - Public: `/login`, `/signup`, `/verification-pending`, `/forgot-password`, `/complete-signup`, `/reset-password`, `/two-factor-auth`.
  - Authenticated: dashboards, profiles, client/position/timesheet/invoice management, reports, bulk timesheets, recruiter hierarchy, invite recruiter.
  - Role routes: `AdminRoute`, `RecruiterRoute`, `JobSeekerRoute` via `components/ProtectedRoute.tsx` and `useAuth()`.
- Auth context: `contexts/AuthContext.tsx`
  - Tracks `user`, role helpers (admin/recruiter/jobseeker), profile verification status for jobseekers.
  - Validates Supabase session, caches state, exposes `refetchProfileStatus()`.
- Translation system: `contexts/language/language-provider.tsx`
  - `useLanguage().t(key, vars)` with nested keys and interpolation; persists language; ensure all user-facing text uses this.
- API client: `services/api/index.ts`
  - Base URL `VITE_API_URL`; attaches Supabase JWT; GET request cache (60s) + in-flight dedupe; global 401/403 sign-out.
  - Token cache with early refresh window; exported helpers `clearTokenCache`, `clearRequestCache`.
- Auth API wrappers: `services/api/auth.ts`
  - Register/login/logout, password reset/update, resend verification, OTP send/verify (Twilio), onboarding completion, 2FA validate/complete, health checks, email/phone availability.
- User API: `services/api/user.ts` invite recruiter, resend invitation, list users (filters/pagination), get user by id, update manager, set roles.
- Client API: `services/api/client.ts` CRUD + drafts with rich filters/pagination and snake/camel transforms; cache busting on updates.
- Position API: `services/api/position.ts` CRUD + drafts, generate code, candidate matching and assignments, client positions, assignments per candidate.
- Recent activity feed: `hooks/useRecentActivities.ts`, `components/dashboard/RecentActivities.tsx`
  - Fetches initial activities, paginated load-more, realtime subscription to `recent_activities` via Supabase Postgres Changes; formats display messages and icons for many action types.
- Guards: `components/ProtectedRoute.tsx`
  - Enforces onboarding completion, jobseeker profile status routing (create/pending/rejected restrictions), allows utility routes when pending/rejected.

#### Server (Express)
- Bootstrap: `src/index.ts`
  - Security middlewares: `forceTLS`, `helmet` CSP, request ID, sanitization, CORS; health endpoints `/` and `/health`.
  - Mounts routers: `/api/auth`, `/api/users`, `/api/profile`, `/api/jobseekers`, `/api/clients`, `/api/positions` (+ `/api/positions/draft` first), `/api/timesheets`, `/api/bulk-timesheets`, `/api/invoices`, `/api/metrics/*`, `/api/reports`, `/api/ai`.
- Auth middleware: `middleware/auth.ts`
  - `authenticateToken` validates Supabase JWT; `authorizeRoles([...])`; `isAdminOrRecruiter` helper.
- Activity logging: `middleware/activityLogger.ts`
  - Configurable hooks: `beforeOperation`, `activityData`, `onSuccess`, `onError`, `afterOperation`.
  - Inserts into `recent_activities` with rich entity context and metadata; expects user on `req.user` (uses service key).
  - Action types include CRUD for jobseekers/clients/positions/timesheets/invoices, assignments, user management (roles/manager), onboarding, recruiter invitations, email sends, bulk timesheets.
- Email notifier: `middleware/emailNotifier.ts`
  - Post-response success emails via SendGrid; supports array of emails for bulk operations.
- Security: `middleware/security.ts`
  - `helmet` CSP, HSTS, request ID header, input sanitization (basic HTML character escaping), API and sensitive rate limiters.

#### Key Routes and Endpoints
- Auth (`routes/auth.ts`):
  - POST `/api/auth/send-verification` (Twilio OTP), `/verify-otp`
  - POST `/register` (sets system user in logger), `/login`, `/validate-credentials` (2FA precheck), `/complete-2fa`, `/logout`
  - POST `/reset-password`, `/update-password`, `/complete-onboarding` (activity logged)
  - POST `/resend-verification`
  - GET `/me`, `/check-email`, `/check-phone`
- Users (`routes/user.ts`):
  - GET `/api/users` (filters/pagination via `list_auth_users`), `/api/users/:id`
  - PATCH `/:id/manager` (prevents cycles; logs `update_user_manager`)
  - PATCH `/:id/roles` (logs `update_user_roles`, guards admin)
  - POST `/invite-recruiter` (Supabase admin invite; logs), `/resend-invitation` (invite or onboarding reminder; logs)
- Clients (`routes/clients.ts`):
  - GET `/api/clients` (filters/pagination), `/:id`
  - POST `/` (log `create_client`), PUT `/:id` (log `update_client`), DELETE `/:id` (log `delete_client`)
  - Drafts: GET `/drafts`, GET `/draft`, GET `/draft/:id`, POST `/draft`, PUT `/draft/:id?`, DELETE `/draft/:id` with activity logs
- Positions (`routes/positions.ts`):
  - GET `/api/positions` (filters/pagination), `/client/:clientId`, `/:id`, `/generate-code/:clientId`
  - POST `/` (log `create_position`), PUT `/:id` (log `update_position`), DELETE `/:id` (log `delete_position`)
  - Assignments: POST `/:id/assign` (log `assign_jobseeker` + email), DELETE `/:id/assign/:candidateId` (log `remove_jobseeker` + email)
  - GET `/:id/assignments`, GET `/candidate/:candidateId/assignments` (filters, role-aware)
- Jobseekers (`routes/jobseekers.ts`):
  - GET `/api/jobseekers` (list with filters/pagination)
  - GET `/profile/:id` (detailed; enrich docs with AI validation), PUT `/profile/:id/status` (verify/reject/pending; logs), PUT `/profile/:id/update` (logs + AI verification callback)
  - DELETE `/profile/:id` (delete + clear `hasProfile`)
  - Drafts: GET `/drafts`, GET `/drafts/:id`, POST `/drafts`, PUT `/drafts/:id`, DELETE `/drafts/:id`
  - Matching: GET `/position-candidates/:positionId` (stored proc `find_matching_candidates`, client-side filters/pagination)
  - Note: A route is defined as `router.get('/api/profile/check-email'...)` inside this module; verify mount path to avoid double `/api` prefix.
- Timesheets (`routes/timesheets.ts`):
  - GET `/generate-invoice-number`, GET `/` (filters), GET `/:id`
  - POST `/` (log `create_timesheet` + optional email), PUT `/:id` (log `update_timesheet` + optional email), DELETE `/:id` (log `delete_timesheet`)
  - GET `/jobseeker/:jobseekerUserId`, PATCH `/:id/document`
- Bulk Timesheets (`routes/bulkTimesheets.ts`):
  - GET `/generate-invoice-number`, GET `/`, GET `/:id`
  - POST `/` (log `create_bulk_timesheet` + per-jobseeker email option)
  - PUT `/:id` (log `update_bulk_timesheet` + per-jobseeker email option)
  - POST `/:id/send-emails` (send selected jobseekers; log `send_bulk_timesheet_email`)
  - DELETE `/:id` (log `delete_bulk_timesheet`)
- Invoices (`routes/invoices.ts`):
  - GET `/generate-invoice-number`, GET `/` (filters), GET `/:id`
  - POST `/` (log `create_invoice`), PUT `/:id` (log `update_invoice`), DELETE `/:id` (log `delete_invoice`)
  - PATCH `/:id/document`, POST `/:id/send-email` (SendGrid w/ attachments; log `send_invoice_email`)
- Reports (`routes/reports.ts`):
  - POST `/timesheet`, `/margin`, `/invoice`, `/deduction`, `/rate-list`, `/clients`, `/sales`, `/envelope-printing-position`
- Metrics:
  - `/api/timesheet-metrics` (aggregate timesheet KPIs)
  - `/api/invoice-metrics` (aggregate invoice KPIs)
  - `/api/jobseeker-metrics/:candidateId` (candidate assignment history KPIs)
  - `/api/metrics/recruiters` (clients, positions; global or per recruiter)
- AI Insights (`routes/aiInsights.ts`):
  - GET `/api/ai/insights`, `/api/ai/insights/timerange` (documents scanned via `ai_validation`, matched slots via positions)
- Profile (`routes/profile.ts`):
  - POST `/api/profile/submit` (create jobseeker profile; sets `hasProfile`, AI verification callback; logs `create_jobseeker`)
  - GET `/api/profile` (current user), PUT `/api/profile/draft`, GET `/api/profile/draft`, GET `/api/profile/check-email`

#### Database and Realtime
- Migrations include: clients/positions/timesheets/invoices tables, jobseeker profiles (+ drafts), recent activities table, realtime triggers (`enable_recent_activities_realtime.sql`, `update_activity_trigger_for_broadcast.sql`), helper functions (`list_auth_users`, `generate_next_position_code`, `get_user_id_by_email`, `get_user_id_by_phone`, candidate matching proc).
- Realtime: client subscribes to `recent_activities` Postgres changes; server writes activities on successful operations.

#### Integrations
- Supabase (Auth, Postgres, Storage, Realtime), Twilio Verify (OTP), SendGrid (email), External AI Verification service (`AI_VERIFICATION_URL`).

#### Security & Compliance
- JWT validation via Supabase admin SDK (`authenticateToken`).
- Rate limiting, CSP via `helmet`, HSTS in production, basic input sanitization.
- Role-based authorization on all sensitive endpoints.

#### Environment Variables
- Server: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `SENDGRID_API_KEY`, `DEFAULT_FROM_EMAIL`, `CLIENT_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `AI_VERIFICATION_URL`, `PORT`.
- Client: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

#### Notable Patterns and Constraints
- Activity logging is mandatory for significant operations; use `res.locals` to pass entities; avoid hardcoded strings in messages.
- Frontend i18n: ensure any new UI leverages `t()` with keys added to both `en.json`/`fr.json`.
- Axios GET caching can serve stale data up to 60s; `clearCacheFor` used after mutations.
- Some server list endpoints perform client-side filtering after breadth fetch (scalability consideration).
- Potential route path anomaly: `routes/jobseekers.ts` defines `router.get('/api/profile/check-email'...)` which may mount as `/api/jobseekers/api/profile/check-email`.



