Development Plan: Digital Consent Feature
Guiding Principle: Follow Existing Repository Standards
This document provides a structured plan for implementation. However, the existing codebase is the ultimate source of truth. If any instruction in this plan conflicts with an established pattern, convention, or structure found in your repository, you must follow the repository's standard. For example, if this document suggests creating a new folder but your project organizes similar files differently, adhere to the project's existing structure.

1. Overview & Goal
Objective: To build and integrate a secure system for requesting, capturing, and managing legally binding digital consent from clients and jobseekers within the Godspeed Ops Portal.

Workflow Summary:

Admin/Recruiter: Uploads a document and targets specific users (clients/jobseekers).

System: Generates a secure, unique link for each user and sends it via email.

User: Clicks the link, views the document, and provides consent by typing their name and checking a box.

System: Securely records the consent and provides a confirmation view if the link is accessed again.

Step 1: Foundational Backend Setup
This step prepares the database to store all consent-related information.

Backend
Action: Create a new SQL migration file in server/src/db/migrations/.

SQL Content:

-- Table to store the master consent documents uploaded by admins
CREATE TABLE public.consent_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Path in Supabase Storage
    uploaded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    version INT DEFAULT 1
);

-- Table to track each individual consent request and its status
CREATE TABLE public.consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.consent_documents(id) ON DELETE CASCADE,
    consentable_id UUID NOT NULL, -- Will store the ID from either clients or jobseeker_profiles
    consentable_type TEXT NOT NULL, -- Will store 'client' or 'jobseeker_profile'
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, expired
    consent_token TEXT NOT NULL UNIQUE, -- Secure, encrypted token
    sent_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    consented_name TEXT, -- The name the user typed
    ip_address TEXT, -- For audit purposes
    CONSTRAINT unique_consentable_document_version UNIQUE (consentable_id, consentable_type, document_id),
    CHECK (consentable_type IN ('client', 'jobseeker_profile'))
);

Acceptance Criteria:

A new SQL migration file is created.

The consent_documents and consent_records tables are created in the database.

Relationships and constraints are correctly established.

Step 2: Admin/Recruiter - Consent Management
This step builds the core functionality for admins and recruiters to create, view, and manage consent requests.

Backend
Actions:

Create a new route file: server/src/routes/consent.ts.

Implement the following secure endpoints within this file, placing all API logic here as per the existing repository pattern:

POST /api/consent/request: Handles document upload, creates records in consent_documents and consent_records, generates secure tokens, and sends emails.

GET /api/consent/documents: Lists all uploaded consent documents for the main dashboard.

GET /api/consent/records/:documentId: Lists all recipients and their status for a specific document.

POST /api/consent/resend: Accepts an array of consent_record_ids to resend emails.

Register the new router in server/src/index.ts.

Acceptance Criteria:

Admins/recruiters can create and send new consent requests via the API.

The APIs for listing documents and recipient statuses work correctly.

The API for resending emails functions as expected.

Frontend
Actions:

Create Pages: Create three new pages in client/src/pages/Consent/:

ConsentListPage.tsx: To display the main list of all consent request.

CreateConsentPage.tsx: A dedicated page for the new consent request form.

ConsentDetailPage.tsx: To show the detailed status of a single consent request, like list of users/clients for which these consents are with their status in tabular format.

Create Components in client/src/components/consent/:

ConsentRequestForm.tsx: The form UI for uploading a document and selecting recipients. This will be the main component used in CreateConsentPage.tsx.

ConsentDocumentsTable.tsx: The table for the ConsentListPage.

ConsentRecipientsTable.tsx: The table for the ConsentDetailPage, including selection checkboxes.

Implement UI Flow:

The ConsentListPage will display the table of all consent documents. A "New Consent Request" button will navigate to the CreateConsentPage.

Clicking a document in the table navigates to the ConsentDetailPage.

The ConsentDetailPage displays the recipient table with checkboxes and a "Resend Consent Email" button that calls the backend API.

Integrate Routing and Navigation:

In client/src/App.tsx, update the router to include the new protected routes for admin and recruiter roles. The routes should be nested to reflect the page hierarchy:

/consent-dashboard -> ConsentListPage.tsx

/consent-dashboard/new -> CreateConsentPage.tsx

/consent-dashboard/:documentId -> ConsentDetailPage.tsx

In your main navigation file (e.g., hamburgermenu.tsx), add a new "Consent Management" section with two links: "Create Consent" (pointing to /consent-dashboard/new) and "View Consents" (pointing to /consent-dashboard).

Acceptance Criteria:

The admin/recruiter UI is functional, with dedicated pages for listing, creating, and viewing detailed consent statuses.

The "Resend Email" functionality works correctly from the detail page.

The UI reuses the common table component for a consistent look and feel.

A "Consent Management" section with two distinct links ("Create Consent" and "View Consents") is present in the main navigation for authorized users, and all routes are correctly configured and protected.

Step 3: Public-Facing Consent Workflow
This step builds the public page where clients and jobseekers will provide their consent.

Backend
Actions:

Implement the following public endpoints within the server/src/routes/consent.ts file:

GET /api/consent/view: Takes a secure token, decrypts it, and returns the necessary document and user context for the consent page.

POST /api/consent/submit: Takes a secure token and the user's input (consented_name), validates it, and securely records the consent in the database.

Acceptance Criteria:

The /view endpoint securely provides the correct data based on the token.

The /submit endpoint securely records the consent and updates the record's status to completed.

Frontend
Actions:

Create a new public page: client/src/pages/Public/ConsentPage.tsx. This page will have a clean, professional style but will not use the internal application layout (e.g., AppHeader).

Implement the page logic:

On load, extract the token from the URL.

Call the /api/consent/view endpoint to fetch data.

Display a preview of the document.

Render a checkbox and a text input for the user's full name.

On form submission, call the /api/consent/submit endpoint.

If the consent is already completed, display a confirmation message instead of the form.

Add a new public route for /consent in the main router.

Acceptance Criteria:

Visiting a unique consent link correctly displays the document and consent form.

Users can successfully submit their consent.

Visiting a link for a previously completed consent shows the confirmation view.

Step 4: System-Wide Integrations
This final step ensures the new feature is fully integrated with existing cross-cutting concerns like activity logging and internationalization.

Backend
Action:

Integrate the activityLogger middleware with the POST /api/consent/request, POST /api/consent/submit, and POST /api/consent/resend endpoints.

Acceptance Criteria:

Creating a request, submitting a consent, and resending a request are all logged as events in the recent_activities table.

Frontend
Actions:

Activity Feed: In client/src/hooks/useRecentActivities.ts and client/src/components/dashboard/RecentActivities.tsx, add logic to correctly format and display the new activity types (create_consent_request, user_consent_given, resend_consent_request).

Internationalization (i18n): Add all new user-facing text keys to en.json and fr.json and use the useLanguage().t() hook in all new frontend components.

Acceptance Criteria:

All consent-related actions correctly appear in the main dashboard's activity feed.

The entire feature is fully translatable and responds to the application's language toggle.