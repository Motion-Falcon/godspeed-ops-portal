AI Agent Integration Guide: Calendar Position Management Feature
1. Feature Overview
Objective: Implement a read-only calendar dashboard for 'Admin' and 'Recruiter' roles to visualize jobseeker start and end dates for various client positions.

Core Principles:

Read-Only: This feature involves no POST, PUT, PATCH, or DELETE operations. No data will be created or modified.

Performance: The implementation must be highly performant, especially for data queries involving large date ranges.

Integration: The feature must seamlessly integrate with the existing authentication, authorization, routing, and internationalization (i18n) systems.

Premium UI/UX: The interface should be modern, intuitive, and visually appealing, with smooth animations and a professional finish.

2. Backend Implementation (Server)
Step 1: Backend Preparation
This feature is read-only and will query existing tables. No database schema changes or new views are required. The data-joining logic will be handled at the application level in the new controller.

Acceptance Criteria:

No migration files are created.

The existing database schema remains unchanged.

Step 2: Create New Read-Only API Endpoints
Create a new router and controller to expose the calendar data. This endpoint will be protected and only accessible to authorized users.

Actions:

Create Controller: Create server/src/controllers/calendarController.ts. This controller will handle the data fetching logic.

It must accept startDate and endDate query parameters.

It should optionally accept clientId and jobseekerId for filtering.

Crucially, it must perform a join across the position_assignments, positions, clients, and jobseeker_profiles tables to construct the response. The agent should use the appropriate database client (e.g., Supabase client, Knex, etc.) available in the project to build this query.

Create Router: Create server/src/routes/calendar.ts.

Define a GET / endpoint.

Apply the existing authenticateToken and authorizeRoles(['admin', 'recruiter']) middleware.

Connect the route to the new controller logic.

Register Router: In server/src/index.ts, import and register the new calendar router under the /api/calendar path.

Acceptance Criteria:

A new GET /api/calendar endpoint exists.

The endpoint is protected and only accessible by users with 'admin' or 'recruiter' roles.

The endpoint successfully returns data constructed from joining the required tables.

The endpoint can be filtered by a date range (e.g., /api/calendar?startDate=2023-01-01&endDate=2023-01-31).

3. Frontend Implementation (Client)
Step 3: Add a New API Service
Create a dedicated service file for interacting with the new calendar API.

Action: Create client/src/services/api/calendar.ts.

Content Guidance:

Define a function like getCalendarEvents(params: { startDate: string; endDate: string; clientId?: string; }).

Use the existing Axios instance to make a GET request to /api/calendar.

Define TypeScript interfaces for the event data returned from the API.

Acceptance Criteria:

A new calendar.ts API service file exists.

It can successfully fetch and return typed data from the backend.

Step 4: Create Calendar Page and Components
Scaffold the new page and its child components, following the project's convention of separate CSS files.

Actions:

Create Page: Create a new directory client/src/pages/Calendar/ and add CalendarPage.tsx and CalendarPage.css. This component will manage state and data fetching.

Create Components: Inside client/src/components/, create a new calendar/ directory. For each component, create both a .tsx and a corresponding .css file:

CalendarView.tsx and CalendarView.css

DayViewPanel.tsx and DayViewPanel.css

CalendarFilters.tsx and CalendarFilters.css

SummaryWidgets.tsx and SummaryWidgets.css

Acceptance Criteria:

The new page and component files are created in the correct directory structure.

Each new .tsx component/page has an associated .css file.

Step 5: Integrate Routing
Add the new calendar page to the application's navigation flow.

Action: In client/src/App.tsx (or your main routing file):

Import the new CalendarPage.

Add a new route for the path /calendar.

Wrap this route with the existing ProtectedRoute component, restricting access to admin and recruiter roles.

Add a link to the calendar page in the main navigation component (e.g., sidebar or header).

Acceptance Criteria:

Navigating to /calendar renders the CalendarPage.

The route is protected and inaccessible to unauthenticated users or users without the correct role.

A navigation link to the calendar is visible to authorized users.

Step 6: Implement a High-Fidelity UI/UX
Bring the calendar to life with a polished, professional, and interactive user experience.

Actions:

Install Library: Add a calendar library. react-big-calendar is a strong choice.

pnpm install react-big-calendar
pnpm install -D @types/react-big-calendar

Layout & Responsiveness:

The CalendarPage must incorporate the project's existing AppHeader component at the top.

The main content area should have appropriate top margin to correctly position it below the header.

The main CalendarPage should have a two-column layout: the CalendarView on the left (taking ~70% width) and the DayViewPanel on the right (~30% width).

The SummaryWidgets and CalendarFilters should be positioned above the main calendar view.

The layout must be fully responsive. On smaller screens (e.g., mobile), the DayViewPanel should perhaps appear as a modal or slide-in panel when a day is selected, rather than being a persistent sidebar.

Styling & Theming:

Crucially, locate the project's central theme or CSS variables file (likely in client/src/styles/). All colors, fonts, spacing, and border-radius values for the new components must be derived from these existing variables to ensure visual consistency.

Style the react-big-calendar component to match the application's theme. Override its default styles as needed in its dedicated CSS file.

The DayViewPanel should be styled elegantly in its own CSS file, with clear typography and good information hierarchy.

Animations & Micro-interactions:

Add subtle transitions. For example, when the DayViewPanel updates with new data, the content should fade in smoothly.

Interactive elements like filter dropdowns and calendar navigation buttons should have hover and focus states.

When fetching data, display a skeleton loader or a subtle loading spinner to indicate activity.

State Management & Data Flow:

In CalendarPage.tsx, use useState and useEffect to manage filter state and fetch data from the getCalendarEvents service.

Implement an onSelectSlot handler on the calendar to update the state with the selected day's details, which will be passed as props to DayViewPanel.tsx.

When filters in CalendarFilters.tsx are changed, a callback function should update the state in CalendarPage.tsx to trigger a new API fetch.

Acceptance Criteria:

The calendar displays events fetched from the API in a visually appealing way that matches the app's theme.

The page correctly uses the existing AppHeader and has appropriate layout margins.

The UI is fully responsive and usable on all screen sizes.

All styling is derived from the project's central theme/variable files and is organized into separate CSS files per component.

The interface includes subtle animations for state changes and user interactions.

Applying a filter refetches the data and smoothly updates the calendar and summary views.

Step 7: Implement Internationalization (i18n)
Ensure all user-facing text is translatable.

Actions:

Identify all static text in your new components (e.g., "Daily Summary", "Filter by Client", button labels).

Add corresponding keys for each string to client/src/contexts/language/en.json and fr.json.

In your components, use the useLanguage().t() hook to render all text.

Acceptance Criteria:

No hardcoded English or French strings exist in the new components.

The calendar feature is fully translated when the user switches the application's language.

4. Agent Flexibility and Decision-Making
As an AI agent, you have the flexibility to make intelligent decisions based on the existing codebase.

Top-Level Comments: Pay close attention to any comments at the top of existing files. These often contain important architectural notes or conventions that must be followed.

Naming Conventions: Adhere to the existing naming conventions for files, variables, and functions.

Component Structure: If the existing components follow a specific pattern (e.g., styled-components), adopt that pattern for the new components. The use of separate .css files for each component is a mandatory pattern for this feature.

Code Style: Match the existing code style and linting rules.

Adaptation: The file paths and component breakdowns provided here are a guide. If you discover a more logical or consistent structure within the existing project, you are empowered to adapt this guide to fit it.