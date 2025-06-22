import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Metric type definition
interface Metric {
  id: string;
  label: string;
  currentValue: number;
  previousValue: number;
  unit: string;
  formatType: string;
  description: string;
  historicalData: Array<{
    period: string;
    value: number;
    date: Date | string;
  }>;
}

/**
 * Get aggregate timesheet metrics for admin/recruiter dashboard
 * GET /api/timesheet-metrics
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      // Get all timesheets (optionally, add time range filtering)
      const { data: timesheets, error } = await supabase
        .from("timesheets")
        .select(
          "id, total_jobseeker_pay, bonus_amount, deduction_amount, total_regular_hours, total_overtime_hours, created_at"
        );

      if (error) {
        console.error("Error fetching timesheets for metrics:", error);
        return res.status(500).json({ error: "Failed to fetch timesheets" });
      }

      // Aggregate metrics
      let totalTimesheets = 0;
      let totalJobseekerPay = 0;
      let totalBonusPaid = 0;
      let totalDeduction = 0;
      let totalRegularHours = 0;
      let totalOvertimeHours = 0;

      // For historical data (by month)
      const monthlyStats: { [key: string]: any } = {};
      const monthsBack = 12;
      const currentDate = new Date();
      // Pre-populate last 12 months with zero values
      for (let i = 0; i <= monthsBack; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthKey = date.toISOString().slice(0, 7);
        monthlyStats[monthKey] = {
          totalTimesheets: 0,
          totalJobseekerPay: 0,
          totalBonusPaid: 0,
          totalDeduction: 0,
          totalRegularHours: 0,
          totalOvertimeHours: 0,
          month: monthKey,
        };
      }

      // Also ensure current month is included (in case monthsBack doesn't include it)
      const getMonthKey = (date: string | null): string => {
        if (!date) return "";
        return new Date(date).toISOString().slice(0, 7);
      };
      const currentMonthKey = getMonthKey(new Date().toISOString());
      if (!monthlyStats[currentMonthKey]) {
        monthlyStats[currentMonthKey] = {
          totalTimesheets: 0,
          totalJobseekerPay: 0,
          totalBonusPaid: 0,
          totalDeduction: 0,
          totalRegularHours: 0,
          totalOvertimeHours: 0,
          month: currentMonthKey,
        };
      }

      // Process assignments and populate monthly stats
      timesheets?.forEach((ts: any) => {
        totalTimesheets++;
        totalJobseekerPay += Number(ts.total_jobseeker_pay) || 0;
        totalBonusPaid += Number(ts.bonus_amount) || 0;
        totalDeduction += Number(ts.deduction_amount) || 0;
        totalRegularHours += Number(ts.total_regular_hours) || 0;
        totalOvertimeHours += Number(ts.total_overtime_hours) || 0;

        // Historical by month
        const monthKey = ts.created_at ? new Date(ts.created_at).toISOString().slice(0, 7) : "unknown";
        if (monthlyStats[monthKey]) {
          monthlyStats[monthKey].totalTimesheets++;
          monthlyStats[monthKey].totalJobseekerPay += Number(ts.total_jobseeker_pay) || 0;
          monthlyStats[monthKey].totalBonusPaid += Number(ts.bonus_amount) || 0;
          monthlyStats[monthKey].totalDeduction += Number(ts.deduction_amount) || 0;
          monthlyStats[monthKey].totalRegularHours += Number(ts.total_regular_hours) || 0;
          monthlyStats[monthKey].totalOvertimeHours += Number(ts.total_overtime_hours) || 0;
        }
      });

      // Sort months for historical data (oldest to newest)
      const monthlyArray = Object.values(monthlyStats).sort((a: any, b: any) => a.month.localeCompare(b.month));

      // Helper to format historical data
      const formatHistoricalData = (field: keyof typeof monthlyArray[0]) => {
        return monthlyArray.map((month: any) => {
          const date = new Date(month.month + "-01");
          const monthName = date.toLocaleDateString("en-US", { month: "short" });
          return {
            period: monthName,
            value: month[field] || 0,
            date: date,
          };
        });
      };

      // Build metrics array
      const metrics: Metric[] = [
        {
          id: "total_timesheets",
          label: "Total Timesheets Submitted",
          currentValue: totalTimesheets,
          previousValue: monthlyArray.length > 1 ? monthlyArray[monthlyArray.length - 2].totalTimesheets : 0,
          unit: "timesheets",
          formatType: "number",
          description: "Total number of timesheets submitted",
          historicalData: formatHistoricalData("totalTimesheets"),
        },
        {
          id: "total_jobseeker_pay",
          label: "Total Jobseeker Pay",
          currentValue: totalJobseekerPay,
          previousValue: monthlyArray.length > 1 ? monthlyArray[monthlyArray.length - 2].totalJobseekerPay : 0,
          unit: "currency",
          formatType: "currency",
          description: "Sum of all jobseeker pay from timesheets",
          historicalData: formatHistoricalData("totalJobseekerPay"),
        },
        {
          id: "total_bonus_paid",
          label: "Total Bonus Paid",
          currentValue: totalBonusPaid,
          previousValue: monthlyArray.length > 1 ? monthlyArray[monthlyArray.length - 2].totalBonusPaid : 0,
          unit: "currency",
          formatType: "currency",
          description: "Sum of all bonuses paid from timesheets",
          historicalData: formatHistoricalData("totalBonusPaid"),
        },
        {
          id: "total_deduction",
          label: "Total Deduction",
          currentValue: totalDeduction,
          previousValue: monthlyArray.length > 1 ? monthlyArray[monthlyArray.length - 2].totalDeduction : 0,
          unit: "currency",
          formatType: "currency",
          description: "Sum of all deductions from timesheets",
          historicalData: formatHistoricalData("totalDeduction"),
        },
        {
          id: "total_regular_hours",
          label: "Total Regular Hours",
          currentValue: totalRegularHours,
          previousValue: monthlyArray.length > 1 ? monthlyArray[monthlyArray.length - 2].totalRegularHours : 0,
          unit: "hours",
          formatType: "number",
          description: "Sum of all regular hours from timesheets",
          historicalData: formatHistoricalData("totalRegularHours"),
        },
        {
          id: "total_overtime_hours",
          label: "Total Overtime Hours",
          currentValue: totalOvertimeHours,
          previousValue: monthlyArray.length > 1 ? monthlyArray[monthlyArray.length - 2].totalOvertimeHours : 0,
          unit: "hours",
          formatType: "number",
          description: "Sum of all overtime hours from timesheets",
          historicalData: formatHistoricalData("totalOvertimeHours"),
        },
      ];

      res.json({ metrics });
    } catch (error) {
      console.error("Unexpected error fetching timesheet metrics:", error);
      res.status(500).json({ error: "An unexpected error occurred while fetching timesheet metrics" });
    }
  }
);

export default router; 