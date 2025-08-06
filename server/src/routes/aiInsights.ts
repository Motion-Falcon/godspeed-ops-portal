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

// Type definitions for AI insights
interface AIInsightsResponse {
  totalDocumentsScanned: number;
  totalJobseekersMatched: number;
  lastUpdated: string;
  summary: {
    documentsScanned: {
      description: string;
      source: string;
    };
    jobseekersMatched: {
      description: string;
      source: string;
    };
  };
}

interface HistoricalDataPoint {
  period: string;
  value: number;
  date: Date | string;
}

interface Metric {
  id: string;
  label: string;
  currentValue: number;
  previousValue: number;
  unit: string;
  formatType: string;
  description: string;
  historicalData: HistoricalDataPoint[];
}

interface TimeRange {
  months: number;
  startDate: string;
  endDate: string;
}

interface AIInsightsMetricsResponse {
  metrics: Metric[];
  timeRange: TimeRange;
  scope: string;
}

interface MonthlyAIStats {
  month: string;
  documentsScanned: number;
  jobseekersMatched: number;
}

/**
 * Get AI activity insights
 * GET /api/ai/insights
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/insights",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      // Get total documents scanned by AI from ai_validation table
      const { count: documentsScanned, error: documentsError } = await supabase
        .from("ai_validation")
        .select("*", { count: "exact", head: true });

      if (documentsError) {
        console.error("Error fetching AI validation data:", documentsError);
        return res.status(500).json({ 
          error: "Failed to fetch documents scanned data" 
        });
      }

      // Get total position slots (jobseekers matched) from positions table
      const { data: positions, error: positionsError } = await supabase
        .from("positions")
        .select("number_of_positions");

      if (positionsError) {
        console.error("Error fetching positions data:", positionsError);
        return res.status(500).json({ 
          error: "Failed to fetch positions data" 
        });
      }

      // Calculate total position slots (jobseekers matched)
      const totalJobseekersMatched = positions?.reduce(
        (sum, position) => sum + (position.number_of_positions || 0), 
        0
      ) || 0;

      const response: AIInsightsResponse = {
        totalDocumentsScanned: documentsScanned || 0,
        totalJobseekersMatched: totalJobseekersMatched,
        lastUpdated: new Date().toISOString(),
        summary: {
          documentsScanned: {
            description: "Total number of documents processed and validated by AI systems",
            source: "ai_validation table - total row count"
          },
          jobseekersMatched: {
            description: "Total number of jobseekers matched by our AI position matching system",
            source: "positions table - sum of number_of_positions field"
          }
        }
      };

      res.json(response);
    } catch (error) {
      console.error("Unexpected error fetching AI insights:", error);
      res.status(500).json({
        error: "An unexpected error occurred while fetching AI insights"
      });
    }
  }
);

/**
 * Get AI activity insights with time-based filtering
 * GET /api/ai/insights/timerange?months=6
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/insights/timerange",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { months = "12" } = req.query as { months?: string };
      const monthsBack = parseInt(months) || 12;

      // Calculate start date
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);

      // Get total documents scanned by AI from ai_validation table (for current value)
      const { count: totalDocumentsScanned, error: documentsError } = await supabase
        .from("ai_validation")
        .select("*", { count: "exact", head: true });

      if (documentsError) {
        console.error("Error fetching AI validation data:", documentsError);
        return res.status(500).json({ 
          error: "Failed to fetch documents scanned data" 
        });
      }

      // TODO: Fix this when created_at field is available in ai_validation table
      // Get documents scanned by AI within time range
      // const { data: aiValidations, error: documentsError } = await supabase
      //   .from("ai_validation")
      //   .select("created_at")
      //   .gte("created_at", startDate.toISOString())
      //   .order("created_at", { ascending: false });

      // if (documentsError) {
      //   console.error("Error fetching AI validation data:", documentsError);
      //   return res.status(500).json({ 
      //     error: "Failed to fetch documents scanned data" 
      //   });
      // }

      // Get positions created within time range
      const { data: positions, error: positionsError } = await supabase
        .from("positions")
        .select("number_of_positions, created_at")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      if (positionsError) {
        console.error("Error fetching positions data:", positionsError);
        return res.status(500).json({ 
          error: "Failed to fetch positions data" 
        });
      }

      // Helper function to get month key (YYYY-MM format)
      const getMonthKey = (date: string): string => {
        return new Date(date).toISOString().slice(0, 7);
      };

      // Generate monthly statistics
      const monthlyStats: { [key: string]: MonthlyAIStats } = {};
      const currentDate = new Date();

      // Initialize last N months with zero values, including current month
      for (let i = 0; i <= monthsBack; i++) {
        const date = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - i,
          1
        );
        const monthKey = date.toISOString().slice(0, 7);
        monthlyStats[monthKey] = {
          month: monthKey,
          documentsScanned: 0,
          jobseekersMatched: 0,
        };
      }

      // Also ensure current month is included
      const currentMonthKey = getMonthKey(new Date().toISOString());
      if (!monthlyStats[currentMonthKey]) {
        monthlyStats[currentMonthKey] = {
          month: currentMonthKey,
          documentsScanned: 0,
          jobseekersMatched: 0,
        };
      }

      // TODO: Uncomment when ai_validation.created_at is available
      // Process AI validations and populate monthly stats
      // aiValidations?.forEach((validation) => {
      //   const createdMonth = getMonthKey(validation.created_at);
      //   if (monthlyStats[createdMonth]) {
      //     monthlyStats[createdMonth].documentsScanned++;
      //   }
      // });

      // Process positions and populate monthly stats
      positions?.forEach((position) => {
        const createdMonth = getMonthKey(position.created_at);
        if (monthlyStats[createdMonth]) {
          monthlyStats[createdMonth].jobseekersMatched += position.number_of_positions || 0;
        }
      });

      // Convert to array and sort by month (most recent first)
      const monthlyArray = Object.values(monthlyStats).sort(
        (a: MonthlyAIStats, b: MonthlyAIStats) => b.month.localeCompare(a.month)
      );

      // Calculate current totals
      const totalJobseekersMatched = positions?.reduce(
        (sum, position) => sum + (position.number_of_positions || 0), 
        0
      ) || 0;

      // Format historical data for charts
      const formatHistoricalData = (
        monthlyArray: MonthlyAIStats[],
        field: keyof MonthlyAIStats
      ) => {
        return monthlyArray
          .reverse() // Oldest to newest for charts
          .map((month: MonthlyAIStats) => {
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

      // Build metrics response following the metric card structure
      const metrics = [
        {
          id: "documents_scanned",
          label: "Total Documents Scanned",
          currentValue: totalDocumentsScanned || 0,
          previousValue: monthlyArray[1]?.documentsScanned || 0,
          unit: "documents",
          formatType: "number",
          description: `Total documents processed by AI in the last ${monthsBack} months`,
          historicalData: formatHistoricalData(monthlyArray, "documentsScanned"),
        },
        {
          id: "jobseekers_matched",
          label: "Total Jobseekers Matched",
          currentValue: totalJobseekersMatched,
          previousValue: monthlyArray[1]?.jobseekersMatched || 0,
          unit: "positions",
          formatType: "number",
          description: `Total jobseekers matched in the last ${monthsBack} months, by our AI position matching system`,
          historicalData: formatHistoricalData(monthlyArray, "jobseekersMatched"),
        },
      ];

      const response: AIInsightsMetricsResponse = {
        metrics,
        timeRange: {
          months: monthsBack,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString()
        },
        scope: "ai-insights"
      };

      res.json(response);
    } catch (error) {
      console.error("Unexpected error fetching AI insights with time range:", error);
      res.status(500).json({
        error: "An unexpected error occurred while fetching AI insights"
      });
    }
  }
);

export default router; 