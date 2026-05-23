# Role Access Control

This file is the source of truth for role-based access in the portal.

## Roles

- `admin`
- `recruiter`
- `bookkeeper`
- `recruiter_manager`
- `accountant_manager`
- `sales`
- `recruiter_director`
- `jobseeker`

## Page-Level Access

These rules map directly to the hamburger menu pages and route guards.

### Common Pages

| Page | Allowed roles |
| --- | --- |
| Dashboard | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `accountant_manager`, `sales`, `recruiter_director`, `jobseeker` |
| Calendar | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `accountant_manager`, `sales`, `recruiter_director` |
| Training | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `accountant_manager`, `sales`, `recruiter_director`, `jobseeker` |
| AI Chat | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `accountant_manager`, `sales`, `recruiter_director` |
| Dropdown Options | `admin`, `recruiter_manager`, `accountant_manager`, `recruiter_director` |

### User Management

| Page | Allowed roles |
| --- | --- |
| All Users | `admin`, `recruiter_director` |
| Recruiter Hierarchy | `admin`, `recruiter_director` |
| Invite Recruiter/Accountant | `admin`, `recruiter_manager`, `accountant_manager`, `recruiter_director` |

### Jobseekers

| Page | Allowed roles |
| --- | --- |
| All Jobseekers | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `accountant_manager`, `recruiter_director` |
| Create Jobseeker | `admin`, `recruiter`, `recruiter_manager`, `recruiter_director` |
| Jobseeker Drafts | `admin`, `recruiter`, `recruiter_manager`, `recruiter_director` |
| SIN / Work Permit Management | `admin`, `recruiter`, `recruiter_manager`, `recruiter_director` |

### Clients

| Page | Allowed roles |
| --- | --- |
| All Clients | `admin`, `recruiter_manager`, `accountant_manager`, `recruiter_director` |
| Create Client | `admin`, `recruiter_manager`, `accountant_manager`, `recruiter_director` |
| Draft Clients | `admin`, `recruiter_manager`, `accountant_manager`, `recruiter_director` |

### Positions

| Page | Allowed roles |
| --- | --- |
| All Positions | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `accountant_manager`, `recruiter_director` |
| Create Position | `admin`, `recruiter_manager`, `recruiter_director` |
| Draft Positions | `admin`, `recruiter_manager`, `recruiter_director` |
| Position Matching | `admin`, `recruiter`, `recruiter_manager`, `recruiter_director` |

### Documents

| Page | Allowed roles |
| --- | --- |
| All Consent Documents | `admin`, `recruiter`, `recruiter_manager`, `recruiter_director` |
| Create Consent Document | `admin`, `recruiter`, `recruiter_manager`, `recruiter_director` |

### Timesheets

| Page | Allowed roles |
| --- | --- |
| Timesheet Management | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `recruiter_director` |
| Create Bulk Timesheet (Client) | `admin`, `bookkeeper` |
| Create Bulk Timesheet (Job Seeker) | `admin`, `bookkeeper` |
| Bulk Timesheet List | `admin`, `bookkeeper` |

### Finance

| Page | Allowed roles |
| --- | --- |
| Invoice Management | `admin`, `accountant_manager` |
| Invoice List | `admin`, `accountant_manager` |

### Reports

| Page | Allowed roles |
| --- | --- |
| Reports | `admin`, `bookkeeper`, `accountant_manager`, `recruiter_director` |

## Non-Menu Route Inheritance

These routes inherit the menu-page access above.

- Jobseeker details: `/jobseekers/:id` uses `All Jobseekers`
- Jobseeker edit/create helper routes: `/profile/create`, `/jobseekers/:id/edit`
  - `jobseeker` is also allowed for self-service onboarding/profile flow
- Jobseeker draft edit: `/jobseekers/drafts/edit/:id` uses `Jobseeker Drafts`
- Client view: `/client-management/view/:id` uses `All Clients`
- Client edit: `/client-management/edit/:id` uses `Create Client`
- Client draft edit: `/client-management/drafts/edit/:id` uses `Draft Clients`
- Position view: `/position-management/view/:id` uses `All Positions`
- Position edit: `/position-management/edit/:id` uses `Create Position`
- Position create subcategory: `/position-management/create-subcategory` uses `Create Position`
- Position draft edit: `/position-management/drafts/edit/:id` uses `Draft Positions`
- Consent detail: `/consent-dashboard/:documentId` uses `All Consent Documents`
- Reports subpages under `/reports/*` use `Reports`

## Implementation Notes

- Frontend page access is centralized in `client/src/constants/accessControl.ts`.
- Menu visibility must follow the same constants as route guards.
- Route guards use exact role matching for page-level access.
- Legacy metadata roles are still normalized:
  - `manager` -> `recruiter_manager`
  - `accountant` -> `bookkeeper`

## Action-Level Permissions

These are not the page-level rules. They must be enforced separately inside pages and APIs.

| Action | Allowed roles |
| --- | --- |
| Assign roles in All Users | `admin`, `recruiter_director` |
| Delete jobseeker profile | `admin`, `recruiter_manager`, `recruiter_director` |
| Delete Client | `admin`, `recruiter_manager`, `recruiter_director` |
| Delete Position | `admin`, `recruiter_manager`, `recruiter_director` |
| Remove assigned jobseeker from a position | `admin`, `recruiter_manager`, `recruiter_director` |
| Invite Recruiter/Accountant submit action | `admin`, `recruiter_manager`, `accountant_manager`, `recruiter_director` |
