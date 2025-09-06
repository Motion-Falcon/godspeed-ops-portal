import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Type definitions
interface Assignment {
  id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

interface MonthlyStats {
  month: string;
  completed: number;
  active: number;
  upcoming: number;
  started: number;
  totalDuration: number;
  completedJobs: Assignment[];
}

/**
 * Get expiry status counts for SIN and Work Permit documents
 * GET /api/metrics/jobseekers/expiry-status-counts
 * @access Private (Admin, Recruiter only)
 */
router.get(
  "/expiry-status-counts",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      console.log("Fetching expiry status counts...");

      // Get current date for calculations
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Calculate date thresholds
      const in30Days = new Date(today);
      in30Days.setDate(in30Days.getDate() + 30);
      
      const in60Days = new Date(today);
      in60Days.setDate(in60Days.getDate() + 60);
      
      const in90Days = new Date(today);
      in90Days.setDate(in90Days.getDate() + 90);

      // Get all jobseeker profiles with SIN and Work Permit data
      const { data: profiles, error: profilesError } = await supabase
        .from("jobseeker_profiles")
        .select("sin_expiry, work_permit_expiry")

      if (profilesError) {
        console.error("Error fetching profiles for expiry counts:", profilesError);
        return res.status(500).json({ error: "Failed to fetch expiry data" });
      }

      // Initialize counters
      const sinCounts = {
        expired: 0,
        expiringUnder30: 0,
        expiringUnder60: 0,
        expiringUnder90: 0,
        expiringAfter90: 0,
        noData: 0
      };

      const workPermitCounts = {
        expired: 0,
        expiringUnder30: 0,
        expiringUnder60: 0,
        expiringUnder90: 0,
        expiringAfter90: 0,
        noData: 0
      };

      // Helper function to categorize expiry date
      const categorizeExpiryDate = (expiryDate: string | null) => {
        if (!expiryDate) return 'noData';
        
        const expiry = new Date(expiryDate);
        expiry.setHours(0, 0, 0, 0);
        
        if (expiry < today) return 'expired';
        if (expiry <= in30Days) return 'expiringUnder30';
        if (expiry <= in60Days) return 'expiringUnder60';
        if (expiry <= in90Days) return 'expiringUnder90';
        return 'expiringAfter90';
      };

      // Process each profile and categorize
      profiles?.forEach((profile) => {
        // Categorize SIN expiry
        const sinCategory = categorizeExpiryDate(profile.sin_expiry);
        sinCounts[sinCategory as keyof typeof sinCounts]++;

        // Categorize Work Permit expiry
        const workPermitCategory = categorizeExpiryDate(profile.work_permit_expiry);
        workPermitCounts[workPermitCategory as keyof typeof workPermitCounts]++;
      });

      // Calculate totals
      const totalProfiles = profiles?.length || 0;
      const sinTotal = sinCounts.expired + sinCounts.expiringUnder30 + sinCounts.expiringUnder60 + 
                      sinCounts.expiringUnder90 + sinCounts.expiringAfter90;
      const workPermitTotal = workPermitCounts.expired + workPermitCounts.expiringUnder30 + 
                             workPermitCounts.expiringUnder60 + workPermitCounts.expiringUnder90 + 
                             workPermitCounts.expiringAfter90;

      console.log("Expiry status counts calculated successfully");

      res.json({
        totalProfiles,
        sin: {
          ...sinCounts,
          totalWithData: sinTotal
        },
        workPermit: {
          ...workPermitCounts,
          totalWithData: workPermitTotal
        },
        summary: {
          criticalCount: sinCounts.expired + workPermitCounts.expired,
          urgentCount: sinCounts.expiringUnder30 + workPermitCounts.expiringUnder30,
          warningCount: sinCounts.expiringUnder60 + workPermitCounts.expiringUnder60,
          cautionCount: sinCounts.expiringUnder90 + workPermitCounts.expiringUnder90
        },
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error("Unexpected error fetching expiry status counts:", error);
      res.status(500).json({
        error: "An unexpected error occurred while fetching expiry status counts"
      });
    }
  }
);

/**
 * Get dashboard metrics for a specific jobseeker
 * GET /api/jobseeker-metrics/:candidateId
 * @access Private (Admin, Recruiter, JobSeeker - limited access for jobseekers)
 */
router.get(
  "/:candidateId",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  async (req: Request, res: Response) => {
    try {
      const { candidateId } = req.params;
      const { timeRange = "12" } = req.query as { timeRange?: string };

      const monthsBack = parseInt(timeRange) || 12;

      // Verify candidate exists
      const { data: candidate, error: candidateError } = await supabase
        .from("jobseeker_profiles")
        .select("id, first_name, last_name")
        .eq("user_id", candidateId)
        .single();

      if (candidateError || !candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      // Get all assignments for the candidate within the time range
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);

      const { data: assignments, error: assignmentsError } = await supabase
        .from("position_candidate_assignments")
        .select(
          `
          id,
          status,
          start_date,
          end_date,
          created_at,
          updated_at
        `
        )
        .eq("candidate_id", candidateId)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      if (assignmentsError) {
        console.error("Error fetching assignments:", assignmentsError);
        return res.status(500).json({ error: "Failed to fetch assignments" });
      }

      // Helper function to get month key (YYYY-MM format)
      const getMonthKey = (date: string | null): string => {
        if (!date) return "";
        return new Date(date).toISOString().slice(0, 7);
      };

      // Helper function to calculate days between dates
      const calculateDuration = (
        startDate: string | null,
        endDate: string | null
      ): number => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      };

      // Generate monthly statistics
      const monthlyStats: { [key: string]: MonthlyStats } = {};
      const currentDate = new Date();

      // Initialize last 12 months with zero values
      for (let i = 0; i <= monthsBack; i++) {
        const date = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - i,
          1
        );
        const monthKey = date.toISOString().slice(0, 7);
        monthlyStats[monthKey] = {
          month: monthKey,
          completed: 0,
          active: 0,
          upcoming: 0,
          started: 0,
          totalDuration: 0,
          completedJobs: [],
        };
      }

      // Also ensure current month is included (in case monthsBack doesn't include it)
      const currentMonthKey = getMonthKey(new Date().toISOString());
      if (!monthlyStats[currentMonthKey]) {
        monthlyStats[currentMonthKey] = {
          month: currentMonthKey,
          completed: 0,
          active: 0,
          upcoming: 0,
          started: 0,
          totalDuration: 0,
          completedJobs: [],
        };
      }

      // Process assignments and populate monthly stats
      assignments?.forEach((assignment: Assignment) => {
        const createdMonth = getMonthKey(assignment.created_at);
        const endMonth = getMonthKey(assignment.end_date);

        // Count jobs started this month
        if (monthlyStats[createdMonth]) {
          monthlyStats[createdMonth].started++;
        }

        // Count completed jobs by end date month
        if (
          assignment.status === "completed" &&
          endMonth &&
          monthlyStats[endMonth]
        ) {
          monthlyStats[endMonth].completed++;
          monthlyStats[endMonth].completedJobs.push(assignment);

          // Add duration for average calculation
          const duration = calculateDuration(
            assignment.start_date,
            assignment.end_date
          );
          monthlyStats[endMonth].totalDuration += duration;
        }

        // For current status counts, use the most recent month
        if (assignment.status === "active" && monthlyStats[createdMonth]) {
          monthlyStats[createdMonth].active++;
        }
        if (assignment.status === "upcoming" && monthlyStats[createdMonth]) {
          monthlyStats[createdMonth].upcoming++;
        }
      });

      // Convert to array and sort by month (most recent first)
      const monthlyArray = Object.values(monthlyStats).sort(
        (a: MonthlyStats, b: MonthlyStats) => b.month.localeCompare(a.month)
      );

      // Calculate current totals (across all assignments, not just monthly)
      const currentTotals = {
        completed:
          assignments?.filter((a: Assignment) => a.status === "completed")
            .length || 0,
        active:
          assignments?.filter((a: Assignment) => a.status === "active")
            .length || 0,
        upcoming:
          assignments?.filter((a: Assignment) => a.status === "upcoming")
            .length || 0,
        total: assignments?.length || 0,
      };

      // Format historical data for charts
      const formatHistoricalData = (
        monthlyArray: MonthlyStats[],
        field: keyof MonthlyStats
      ) => {
        return monthlyArray
          .reverse() // Oldest to newest for charts
          .map((month: MonthlyStats) => {
            const date = new Date(month.month + "-01");
            const monthName = date.toLocaleDateString("en-US", {
              month: "short",
            });
            return {
              period: monthName,
              value: (month[field] as number) || 0,
              date: date,
            };
          });
      };

      // Build metrics response
      const metrics = [
        {
          id: "jobs_completed",
          label: "Jobs Completed",
          currentValue: currentTotals.completed,
          previousValue: monthlyArray[1]?.completed || 0,
          unit: "jobs",
          formatType: "number",
          description: "Total number of completed job assignments",
          historicalData: formatHistoricalData(monthlyArray, "completed"),
          redirectTo: "/my-positions?status=past"
        },
        {
          id: "active_jobs",
          label: "Active Jobs",
          currentValue: currentTotals.active,
          previousValue: 0, // Active jobs are current state, no historical comparison
          unit: "jobs",
          formatType: "number",
          description: "Currently active job assignments",
          historicalData: [],
          redirectTo: "/my-positions?status=current"
        },
        {
          id: "upcoming_jobs",
          label: "Upcoming Jobs",
          currentValue: currentTotals.upcoming,
          previousValue: 0, // Upcoming jobs are current state
          unit: "jobs",
          formatType: "number",
          description: "Scheduled upcoming job assignments",
          historicalData: [],
          redirectTo: "/my-positions?status=future"
        },
        {
          id: "total_assignments",
          label: "Total Assignments",
          currentValue: currentTotals.total,
          previousValue: 0, // Total is cumulative
          unit: "jobs",
          formatType: "number",
          description: "Total number of job assignments",
          historicalData: [],
          redirectTo: "/my-positions"
        },
      ];

      res.json({
        candidate: {
          id: candidate.id,
          firstName: candidate.first_name,
          lastName: candidate.last_name,
        },
        metrics,
      });
    } catch (error) {
      console.error("Unexpected error fetching jobseeker metrics:", error);
      res.status(500).json({
        error: "An unexpected error occurred while fetching metrics",
      });
    }
  }
);

export default router;
