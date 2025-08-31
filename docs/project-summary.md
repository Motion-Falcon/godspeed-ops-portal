## Godspeed Ops Portal – Executive Summary

Purpose: A staffing operations portal with role-based workflows for recruiters, jobseekers, and admins. It manages clients, positions, jobseeker profiles, assignments, timesheets (single and bulk), invoices, reports, metrics, and activity auditing with realtime updates.

Architecture
- Frontend: React + Vite (TypeScript), custom i18n (`useLanguage()`), Supabase Auth integration, Axios API client with token/dedup caching, realtime activities via Supabase Postgres Changes.
- Backend: Node/Express, Supabase (Auth/Postgres/Storage/Realtime), activity logging middleware, SendGrid email, Twilio OTP, AI document verification webhook, SQL migrations and RPCs.

Core Concepts
- Authentication and Roles: Supabase JWT, `authenticateToken`, `authorizeRoles(['admin','recruiter','jobseeker'])`. Onboarding gating for recruiters; jobseeker profile status routing (create/pending/rejected/verified).
- Activity Logging: Mandatory for significant operations. `activityLogger` writes to `recent_activities` with primary/secondary/tertiary entities, message, category, priority. Frontend subscribes and renders humanized messages.
- Data Domains: Users (invite, hierarchy, roles), Clients (+drafts), Positions (+drafts), Jobseekers (+drafts, AI validation, assignments), Timesheets (+bulk), Invoices (PDF + email), Reports (various), Metrics (timesheet/invoice/recruiter/jobseeker), AI Insights.

Key Integrations
- Supabase: Auth, Postgres, Storage, Realtime; RPCs like `list_auth_users`, `generate_next_position_code`, `get_user_id_by_email`, `find_matching_candidates`.
- Twilio Verify for phone OTP; SendGrid for transactional emails; external AI verification service (`AI_VERIFICATION_URL`).

Important Endpoints (high-level)
- Auth: register/login/logout; OTP send/verify; 2FA validate/complete; onboarding; password reset/update; user/me; check email/phone.
- Users: list/get users; set manager; set roles; invite recruiter; resend invitation.
- Profile: submit profile (creates user or links existing; sets hasProfile; AI callback); get current; drafts (save/get); profile email availability.
- Jobseekers: list; detailed by profile id/user id; update status (verify/reject/pending); update profile; delete; drafts CRUD; candidate matching; candidate assignments listing.
- Clients: list (filters/pagination), get, create/update/delete; drafts CRUD.
- Positions: list; by client; get; generate code; create/update/delete; assign/remove candidate; list assignments.
- Timesheets: generate invoice number; list/get; create/update/delete; get by jobseeker; patch document.
- Bulk Timesheets: generate invoice number; list/get; create/update/delete; send selected jobseeker emails.
- Invoices: generate invoice number; list/get; create/update/delete; patch document; send email with attachments.
- Reports: timesheet, margin, invoice, deduction, rate-list, clients, sales, envelope printing.
- Metrics: timesheet, invoice, jobseeker (per candidate), recruiter (clients, positions) global or per recruiter.
- AI Insights: aggregate counts and historical breakdowns.

Realtime and Auditing
- `recent_activities` table with realtime broadcast; client hook `useRecentActivities` renders activity feed; server logs on success using `res.locals` payloads.

Security
- JWT validation, role enforcement, `helmet` CSP, HSTS in prod, rate limiting, input sanitization, CORS. Many list endpoints filter at DB; some apply additional server-side filtering (scale consideration).

Internationalization
- All user-facing strings must use `useLanguage().t(key)` with entries in `en.json` and `fr.json`.

Environment
- Client: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Server: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `SENDGRID_API_KEY`, `DEFAULT_FROM_EMAIL`, `CLIENT_URL`, `TWILIO_*`, `AI_VERIFICATION_URL`.

Notable Constraints / TODOs
- Verify route `routes/jobseekers.ts` path for `'/api/profile/check-email'` to avoid double `/api` prefix.
- Some server endpoints fetch wide data and filter in Node for joined/derived fields; consider SQL views/procs for scalability.


