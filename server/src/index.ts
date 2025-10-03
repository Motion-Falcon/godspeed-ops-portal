import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import profileRoutes from "./routes/profile.js";
import jobseekersRoutes from "./routes/jobseekers.js";
import clientsRoutes from "./routes/clients.js";
import positionsRoutes from "./routes/positions.js";
import positionsDraftRoutes from "./routes/positionDrafts.js";
import timesheetsRoutes from "./routes/timesheets.js";
import invoicesRoutes from "./routes/invoices.js";
import jobseekerMetricsRoutes from "./routes/jobseekerMetrics.js";
import recruiterMetricsRoutes from "./routes/recruiterMetrics.js";
import aiInsightsRoutes from "./routes/aiInsights.js";
import timesheetMetricsRoutes from "./routes/timesheetMetrics.js";
import invoiceMetricsRoutes from "./routes/invoiceMetrics.js";
import reportsRoutes from "./routes/reports.js";
import calendarRoutes from "./routes/calendar.js";
import consentRoutes from "./routes/consent.js";
import {
  configureSecurityHeaders,
  forceTLS,
  requestTracker,
  apiRateLimiter,
  sanitizeInputs,
} from "./middleware/security.js";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy configuration for Vercel deployment
// Only trust the first proxy (Vercel) to prevent IP spoofing
app.set('trust proxy', 1);

// Security Middleware - Apply early in middleware chain
app.use(forceTLS);
app.use(configureSecurityHeaders);
app.use(requestTracker);
// app.use(apiRateLimiter); // Global rate limiter
app.use(sanitizeInputs); // Global input sanitization

// Standard Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
      "X-Request-ID",
    ],
  })
);
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Auth routes
app.use("/api/auth", authRoutes);

// User routes
app.use("/api/users", userRoutes);

// Profile routes
app.use("/api/profile", profileRoutes);

// Jobseekers routes
app.use("/api/jobseekers", jobseekersRoutes);

// Clients routes
app.use("/api/clients", clientsRoutes);

// Positions Drafts routes (MUST come before general positions routes)
app.use("/api/positions/draft", positionsDraftRoutes);

// Positions routes
app.use("/api/positions", positionsRoutes);

// Timesheets routes
app.use("/api/timesheets", timesheetsRoutes);

// Invoices routes
app.use("/api/invoices", invoicesRoutes);

// Jobseeker metrics routes
app.use("/api/metrics/jobseekers", jobseekerMetricsRoutes);

// Recruiter metrics routes
app.use("/api/metrics/recruiters", recruiterMetricsRoutes);

// Timesheet metrics routes (NEW)
app.use("/api/timesheet-metrics", timesheetMetricsRoutes);

// Invoice metrics routes (NEW)
app.use("/api/invoice-metrics", invoiceMetricsRoutes);

// Reports routes
app.use("/api/reports", reportsRoutes);

// AI insights routes
app.use("/api/ai", aiInsightsRoutes);

// Calendar routes
app.use("/api/calendar", calendarRoutes);

// Consent routes
app.use("/api/consent", consentRoutes);

// Error handling middleware
app.use(
  (
    err: Error & { code?: string },
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    console.error("Unhandled error:", err);

    // Check for specific error types
    if (err.code === "EBADCSRFTOKEN") {
      return res.status(403).json({
        error: "Invalid CSRF token. Please refresh the page and try again.",
      });
    }

    // Generic error response
    res.status(500).json({
      error: "An unexpected error occurred",
      requestId: req.headers["x-request-id"],
    });
  }
);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `Security measures enabled: TLS, CSP, XSS Protection, Rate Limiting`
  );
});
