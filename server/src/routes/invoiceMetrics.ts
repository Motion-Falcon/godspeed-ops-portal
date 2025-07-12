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
  redirectTo?: string;
}

/**
 * Get aggregate invoice metrics for admin/recruiter dashboard
 * GET /api/invoice-metrics
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      // Get all invoices
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select(
          "id, grand_total, total_hours, email_sent, created_at"
        );

      if (error) {
        console.error("Error fetching invoices for metrics:", error);
        return res.status(500).json({ error: "Failed to fetch invoices" });
      }

      // Aggregate metrics
      let totalInvoices = 0;
      let totalBilled = 0;
      let totalHoursBilled = 0;
      let invoicesWithEmail = 0;
      let invoicesWithoutEmail = 0;

      // For historical data (by month)
      const monthlyStats: { [key: string]: any } = {};
      const monthsBack = 12;
      const currentDate = new Date();
      // Pre-populate last 12 months with zero values
      for (let i = 0; i <= monthsBack; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthKey = date.toISOString().slice(0, 7);
        monthlyStats[monthKey] = {
          totalInvoices: 0,
          totalBilled: 0,
          totalHoursBilled: 0,
          invoicesWithEmail: 0,
          invoicesWithoutEmail: 0,
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
          totalInvoices: 0,
          totalBilled: 0,
          totalHoursBilled: 0,
          invoicesWithEmail: 0,
          invoicesWithoutEmail: 0,
          month: currentMonthKey,
        };
      }

      // Process invoices and populate monthly stats
      invoices?.forEach((inv: any) => {
        totalInvoices++;
        totalBilled += Number(inv.grand_total) || 0;
        totalHoursBilled += Number(inv.total_hours) || 0;
        if (inv.email_sent) invoicesWithEmail++;
        if (!inv.email_sent) invoicesWithoutEmail++;

        // Historical by month
        const monthKey = inv.created_at ? new Date(inv.created_at).toISOString().slice(0, 7) : "unknown";
        if (monthlyStats[monthKey]) {
          monthlyStats[monthKey].totalInvoices++;
          monthlyStats[monthKey].totalBilled += Number(inv.grand_total) || 0;
          monthlyStats[monthKey].totalHoursBilled += Number(inv.total_hours) || 0;
          if (inv.email_sent) monthlyStats[monthKey].invoicesWithEmail++;
          if (!inv.email_sent) {
            if (!monthlyStats[monthKey].invoicesWithoutEmail) monthlyStats[monthKey].invoicesWithoutEmail = 0;
            monthlyStats[monthKey].invoicesWithoutEmail++;
          }
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
          id: "total_invoices",
          label: "Total Invoices Created",
          currentValue: totalInvoices,
          previousValue: monthlyArray.length > 1 ? monthlyArray[monthlyArray.length - 2].totalInvoices : 0,
          unit: "invoices",
          formatType: "number",
          description: "Total number of invoices created",
          historicalData: formatHistoricalData("totalInvoices"),
          redirectTo: "/invoice-management/list",
        },
        {
          id: "total_billed",
          label: "Total Billed (Grand Total)",
          currentValue: totalBilled,
          previousValue: monthlyArray.length > 1 ? monthlyArray[monthlyArray.length - 2].totalBilled : 0,
          unit: "currency",
          formatType: "currency",
          description: "Sum of all grand totals from invoices",
          historicalData: formatHistoricalData("totalBilled"),
          redirectTo: "/invoice-management/list",
        },
        {
          id: "total_hours_billed",
          label: "Total Hours Billed",
          currentValue: totalHoursBilled,
          previousValue: monthlyArray.length > 1 ? monthlyArray[monthlyArray.length - 2].totalHoursBilled : 0,
          unit: "hours",
          formatType: "number",
          description: "Sum of all hours billed from invoices",
          historicalData: formatHistoricalData("totalHoursBilled"),
          redirectTo: "/invoice-management/list",
        },
        {
          id: "invoices_with_email",
          label: "Invoices with Email Sent",
          currentValue: invoicesWithEmail,
          previousValue: monthlyArray.length > 1 ? monthlyArray[monthlyArray.length - 2].invoicesWithEmail : 0,
          unit: "invoices",
          formatType: "number",
          description: "Total invoices sent to client via email",
          historicalData: formatHistoricalData("invoicesWithEmail"),
          redirectTo: "/invoice-management/list?emailSent=true",
        },
        {
          id: "invoices_without_email",
          label: "Invoices with No Email Sent",
          currentValue: invoicesWithoutEmail,
          previousValue: monthlyArray.length > 1 ? (monthlyArray[monthlyArray.length - 2].invoicesWithoutEmail || 0) : 0,
          unit: "invoices",
          formatType: "number",
          description: "Total Invoices not sent to client via email",
          historicalData: formatHistoricalData("invoicesWithoutEmail"),
          redirectTo: "/invoice-management/list?emailSent=false",
        },
      ];

      res.json({ metrics });
    } catch (error) {
      console.error("Unexpected error fetching invoice metrics:", error);
      res.status(500).json({ error: "An unexpected error occurred while fetching invoice metrics" });
    }
  }
);

export default router; 