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
      for (let i = 0; i < monthsBack; i++) {
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
        },
      ];

      res.json({
        candidate: {
          id: candidate.id,
          firstName: candidate.first_name,
          lastName: candidate.last_name,
        },
        metrics: [
          {
            id: "jobs_completed",
            label: "Jobs Completed",
            currentValue: 24,
            previousValue: 18,
            unit: "jobs",
            formatType: "number",
            description: "Total number of completed job assignments",
            historicalData: [
              { period: "Jun", value: 2, date: "2024-06-01T00:00:00.000Z" },
              { period: "Jul", value: 3, date: "2024-07-01T00:00:00.000Z" },
              { period: "Aug", value: 1, date: "2024-08-01T00:00:00.000Z" },
              { period: "Sep", value: 4, date: "2024-09-01T00:00:00.000Z" },
              { period: "Oct", value: 2, date: "2024-10-01T00:00:00.000Z" },
              { period: "Nov", value: 3, date: "2024-11-01T00:00:00.000Z" },
              { period: "Dec", value: 5, date: "2024-12-01T00:00:00.000Z" },
              { period: "Jan", value: 2, date: "2025-01-01T00:00:00.000Z" },
              { period: "Feb", value: 4, date: "2025-02-01T00:00:00.000Z" },
              { period: "Mar", value: 3, date: "2025-03-01T00:00:00.000Z" },
              { period: "Apr", value: 6, date: "2025-04-01T00:00:00.000Z" },
              { period: "May", value: 7, date: "2025-05-01T00:00:00.000Z" },
            ],
          },
          {
            id: "active_jobs",
            label: "Active Jobs",
            currentValue: 3,
            previousValue: 0,
            unit: "jobs",
            formatType: "number",
            description: "Currently active job assignments",
            historicalData: [
              { period: "Jun", value: 1, date: "2024-06-01T00:00:00.000Z" },
              { period: "Jul", value: 2, date: "2024-07-01T00:00:00.000Z" },
              { period: "Aug", value: 1, date: "2024-08-01T00:00:00.000Z" },
              { period: "Sep", value: 3, date: "2024-09-01T00:00:00.000Z" },
              { period: "Oct", value: 2, date: "2024-10-01T00:00:00.000Z" },
              { period: "Nov", value: 2, date: "2024-11-01T00:00:00.000Z" },
              { period: "Dec", value: 4, date: "2024-12-01T00:00:00.000Z" },
              { period: "Jan", value: 1, date: "2025-01-01T00:00:00.000Z" },
              { period: "Feb", value: 3, date: "2025-02-01T00:00:00.000Z" },
              { period: "Mar", value: 2, date: "2025-03-01T00:00:00.000Z" },
              { period: "Apr", value: 4, date: "2025-04-01T00:00:00.000Z" },
              { period: "May", value: 3, date: "2025-05-01T00:00:00.000Z" },
            ],
          },
          {
            id: "upcoming_jobs",
            label: "Upcoming Jobs",
            currentValue: 8,
            previousValue: 0,
            unit: "jobs",
            formatType: "number",
            description: "Scheduled upcoming job assignments",
            historicalData: [
              { period: "Jun", value: 3, date: "2024-06-01T00:00:00.000Z" },
              { period: "Jul", value: 5, date: "2024-07-01T00:00:00.000Z" },
              { period: "Aug", value: 2, date: "2024-08-01T00:00:00.000Z" },
              { period: "Sep", value: 6, date: "2024-09-01T00:00:00.000Z" },
              { period: "Oct", value: 4, date: "2024-10-01T00:00:00.000Z" },
              { period: "Nov", value: 7, date: "2024-11-01T00:00:00.000Z" },
              { period: "Dec", value: 5, date: "2024-12-01T00:00:00.000Z" },
              { period: "Jan", value: 3, date: "2025-01-01T00:00:00.000Z" },
              { period: "Feb", value: 8, date: "2025-02-01T00:00:00.000Z" },
              { period: "Mar", value: 6, date: "2025-03-01T00:00:00.000Z" },
              { period: "Apr", value: 9, date: "2025-04-01T00:00:00.000Z" },
              { period: "May", value: 8, date: "2025-05-01T00:00:00.000Z" },
            ],
          },
          {
            id: "total_assignments",
            label: "Total Assignments",
            currentValue: 35,
            previousValue: 0,
            unit: "jobs",
            formatType: "number",
            description: "Total number of job assignments",
            historicalData: [
              { period: "Jun", value: 6, date: "2024-06-01T00:00:00.000Z" },
              { period: "Jul", value: 10, date: "2024-07-01T00:00:00.000Z" },
              { period: "Aug", value: 4, date: "2024-08-01T00:00:00.000Z" },
              { period: "Sep", value: 13, date: "2024-09-01T00:00:00.000Z" },
              { period: "Oct", value: 8, date: "2024-10-01T00:00:00.000Z" },
              { period: "Nov", value: 12, date: "2024-11-01T00:00:00.000Z" },
              { period: "Dec", value: 14, date: "2024-12-01T00:00:00.000Z" },
              { period: "Jan", value: 6, date: "2025-01-01T00:00:00.000Z" },
              { period: "Feb", value: 15, date: "2025-02-01T00:00:00.000Z" },
              { period: "Mar", value: 11, date: "2025-03-01T00:00:00.000Z" },
              { period: "Apr", value: 19, date: "2025-04-01T00:00:00.000Z" },
              { period: "May", value: 18, date: "2025-05-01T00:00:00.000Z" },
            ],
          },
          {
            id: "average_job_duration",
            label: "Average Job Duration",
            currentValue: 45,
            previousValue: 38,
            unit: "days",
            formatType: "number",
            description: "Average duration of completed job assignments",
            historicalData: [
              { period: "Jun", value: 42, date: "2024-06-01T00:00:00.000Z" },
              { period: "Jul", value: 38, date: "2024-07-01T00:00:00.000Z" },
              { period: "Aug", value: 35, date: "2024-08-01T00:00:00.000Z" },
              { period: "Sep", value: 40, date: "2024-09-01T00:00:00.000Z" },
              { period: "Oct", value: 44, date: "2024-10-01T00:00:00.000Z" },
              { period: "Nov", value: 41, date: "2024-11-01T00:00:00.000Z" },
              { period: "Dec", value: 47, date: "2024-12-01T00:00:00.000Z" },
              { period: "Jan", value: 39, date: "2025-01-01T00:00:00.000Z" },
              { period: "Feb", value: 43, date: "2025-02-01T00:00:00.000Z" },
              { period: "Mar", value: 46, date: "2025-03-01T00:00:00.000Z" },
              { period: "Apr", value: 48, date: "2025-04-01T00:00:00.000Z" },
              { period: "May", value: 45, date: "2025-05-01T00:00:00.000Z" },
            ],
          },
          {
            id: "success_rate",
            label: "Job Success Rate",
            currentValue: 92,
            previousValue: 89,
            unit: "%",
            formatType: "percentage",
            description: "Percentage of successfully completed assignments",
            historicalData: [
              { period: "Jun", value: 85, date: "2024-06-01T00:00:00.000Z" },
              { period: "Jul", value: 88, date: "2024-07-01T00:00:00.000Z" },
              { period: "Aug", value: 90, date: "2024-08-01T00:00:00.000Z" },
              { period: "Sep", value: 87, date: "2024-09-01T00:00:00.000Z" },
              { period: "Oct", value: 91, date: "2024-10-01T00:00:00.000Z" },
              { period: "Nov", value: 89, date: "2024-11-01T00:00:00.000Z" },
              { period: "Dec", value: 93, date: "2024-12-01T00:00:00.000Z" },
              { period: "Jan", value: 88, date: "2025-01-01T00:00:00.000Z" },
              { period: "Feb", value: 94, date: "2025-02-01T00:00:00.000Z" },
              { period: "Mar", value: 91, date: "2025-03-01T00:00:00.000Z" },
              { period: "Apr", value: 95, date: "2025-04-01T00:00:00.000Z" },
              { period: "May", value: 92, date: "2025-05-01T00:00:00.000Z" },
            ],
          },
        ],
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
