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
interface JobseekerProfile {
  id: string;
  verification_status: string;
  created_at: string;
  created_by_user_id: string | null;
}

interface Client {
  id: string;
  company_name: string;
  created_at: string;
  created_by_user_id: string | null;
}

interface MonthlyStats {
  month: string;
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  profilesCreated: JobseekerProfile[];
}

interface ClientMonthlyStats {
  month: string;
  total: number;
  clientsCreated: Client[];
}

interface Position {
  id: string;
  title: string;
  number_of_positions: number;
  created_at: string;
  created_by_user_id: string;
}

interface PositionMonthlyStats {
  month: string;
  totalPositionsAdded: number;
  totalPositionSlots: number;
  totalPositionsFilled: number;
  positionsCreated: Position[];
  assignmentsCreated: Assignment[];
}

interface Assignment {
  id: string;
  position_id: string;
  candidate_id: string;
  status: string;
  created_at: string;
  created_by_user_id: string;
}

/**
 * Get client metrics for all recruiters (total data)
 * GET /api/metrics/recruiters/clients (shows total data for all recruiters)
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/clients",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { timeRange = "12" } = req.query as { timeRange?: string };

      const monthsBack = parseInt(timeRange) || 12;

      // Get all clients within the time range (no recruiter filter)
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);

      let clientsQuery = supabase
        .from("clients")
        .select(
          `
          id,
          company_name,
          created_at,
          created_by_user_id
        `
        )
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      const { data: clients, error: clientsError } = await clientsQuery;

      if (clientsError) {
        console.error("Error fetching clients:", clientsError);
        return res.status(500).json({ error: "Failed to fetch clients" });
      }

      // Helper function to get month key (YYYY-MM format)
      const getMonthKey = (date: string): string => {
        return new Date(date).toISOString().slice(0, 7);
      };

      // Generate monthly statistics
      const monthlyStats: { [key: string]: ClientMonthlyStats } = {};
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
          total: 0,
          clientsCreated: [],
        };
      }

      // Also ensure current month is included (in case monthsBack doesn't include it)
      const currentMonthKey = getMonthKey(new Date().toISOString());
      if (!monthlyStats[currentMonthKey]) {
        monthlyStats[currentMonthKey] = {
          month: currentMonthKey,
          total: 0,
          clientsCreated: [],
        };
      }

      // Process clients and populate monthly stats
      clients?.forEach((client: Client) => {
        const createdMonth = getMonthKey(client.created_at);

        if (monthlyStats[createdMonth]) {
          monthlyStats[createdMonth].total++;
          monthlyStats[createdMonth].clientsCreated.push(client);
        }
      });

      // Convert to array and sort by month (most recent first)
      const monthlyArray = Object.values(monthlyStats).sort(
        (a: ClientMonthlyStats, b: ClientMonthlyStats) =>
          b.month.localeCompare(a.month)
      );

      // Calculate current totals (across all clients, not just monthly)
      const currentTotals = {
        total: clients?.length || 0,
      };

      // Format historical data for charts
      const formatHistoricalData = (
        monthlyArray: ClientMonthlyStats[],
        field: keyof ClientMonthlyStats
      ) => {
        return monthlyArray
          .reverse() // Oldest to newest for charts
          .map((month: ClientMonthlyStats) => {
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
          id: "total_clients",
          label: "Total Clients Created",
          currentValue: currentTotals.total,
          previousValue: monthlyArray[1]?.total || 0,
          unit: "clients",
          formatType: "number",
          description: "Total clients created by all recruiters",
          historicalData: formatHistoricalData(monthlyArray, "total"),
        },
      ];

      const response: any = {
        metrics,
        timeRange: {
          months: monthsBack,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
        scope: "all-recruiters",
      };

      res.json(response);
    } catch (error) {
      console.error("Unexpected error fetching client metrics:", error);
      res.status(500).json({
        error: "An unexpected error occurred while fetching client metrics",
      });
    }
  }
);

/**
 * Get client metrics for recruiter activities
 * GET /api/metrics/recruiters/clients/:recruiterId (shows data for specific recruiter)
 * @access Private (Admin, Recruiter - limited access for recruiters to their own data)
 */
router.get(
  "/clients/:recruiterId",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { recruiterId } = req.params;
      const { timeRange = "12" } = req.query as { timeRange?: string };

      const monthsBack = parseInt(timeRange) || 12;

      // Get recruiter info
      const { data: recruiterData, error: recruiterError } =
        await supabase.auth.admin.getUserById(recruiterId);

      if (recruiterError || !recruiterData?.user) {
        return res.status(404).json({ error: "Recruiter not found" });
      }

      const recruiter = recruiterData.user;

      const recruiterInfo = {
        id: recruiter.id,
        email: recruiter.email || "",
        name:
          recruiter.user_metadata?.name ||
          `${recruiter.user_metadata?.firstName || ""} ${
            recruiter.user_metadata?.lastName || ""
          }`.trim() ||
          "Unknown",
      };

      // Get all clients within the time range for specific recruiter
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);

      let clientsQuery = supabase
        .from("clients")
        .select(
          `
          id,
          company_name,
          created_at,
          created_by_user_id
        `
        )
        .gte("created_at", startDate.toISOString())
        .eq("created_by_user_id", recruiterId)
        .order("created_at", { ascending: false });

      const { data: clients, error: clientsError } = await clientsQuery;

      if (clientsError) {
        console.error("Error fetching clients:", clientsError);
        return res.status(500).json({ error: "Failed to fetch clients" });
      }

      // Helper function to get month key (YYYY-MM format)
      const getMonthKey = (date: string): string => {
        return new Date(date).toISOString().slice(0, 7);
      };

      // Generate monthly statistics
      const monthlyStats: { [key: string]: ClientMonthlyStats } = {};
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
          total: 0,
          clientsCreated: [],
        };
      }

      // Also ensure current month is included (in case monthsBack doesn't include it)
      const currentMonthKey = getMonthKey(new Date().toISOString());
      if (!monthlyStats[currentMonthKey]) {
        monthlyStats[currentMonthKey] = {
          month: currentMonthKey,
          total: 0,
          clientsCreated: [],
        };
      }

      // Process clients and populate monthly stats
      clients?.forEach((client: Client) => {
        const createdMonth = getMonthKey(client.created_at);

        if (monthlyStats[createdMonth]) {
          monthlyStats[createdMonth].total++;
          monthlyStats[createdMonth].clientsCreated.push(client);
        }
      });

      // Convert to array and sort by month (most recent first)
      const monthlyArray = Object.values(monthlyStats).sort(
        (a: ClientMonthlyStats, b: ClientMonthlyStats) =>
          b.month.localeCompare(a.month)
      );

      // Calculate current totals (across all clients, not just monthly)
      const currentTotals = {
        total: clients?.length || 0,
      };

      // Format historical data for charts
      const formatHistoricalData = (
        monthlyArray: ClientMonthlyStats[],
        field: keyof ClientMonthlyStats
      ) => {
        return monthlyArray
          .reverse() // Oldest to newest for charts
          .map((month: ClientMonthlyStats) => {
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
          id: "total_clients",
          label: "Total Clients Created",
          currentValue: currentTotals.total,
          previousValue: monthlyArray[1]?.total || 0,
          unit: "clients",
          formatType: "number",
          description: "Total clients created by you",
          historicalData: formatHistoricalData(monthlyArray, "total"),
        },
      ];

      const response: any = {
        metrics,
        timeRange: {
          months: monthsBack,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
        scope: "recruiter-specific",
        recruiter: recruiterInfo,
      };

      res.json(response);
    } catch (error) {
      console.error("Unexpected error fetching client metrics:", error);
      res.status(500).json({
        error: "An unexpected error occurred while fetching client metrics",
      });
    }
  }
);
/**
 * Get position metrics for all recruiters (total data)
 * GET /api/metrics/recruiters/positions (shows total data for all recruiters)
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/positions",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { timeRange = "12" } = req.query as { timeRange?: string };

      const monthsBack = parseInt(timeRange) || 12;

      // Get all positions within the time range (no recruiter filter)
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);

      let positionsQuery = supabase
        .from("positions")
        .select(
          `
          id,
          title,
          number_of_positions,
          created_at,
          created_by_user_id
        `
        )
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      const { data: positions, error: positionsError } = await positionsQuery;

      if (positionsError) {
        console.error("Error fetching positions:", positionsError);
        return res.status(500).json({ error: "Failed to fetch positions" });
      }

      // Get all position assignments within the time range
      let assignmentsQuery = supabase
        .from("position_candidate_assignments")
        .select(
          `
          id,
          position_id,
          candidate_id,
          status,
          created_at,
          created_by_user_id
        `
        )
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      const { data: assignments, error: assignmentsError } =
        await assignmentsQuery;

      if (assignmentsError) {
        console.error("Error fetching assignments:", assignmentsError);
        return res.status(500).json({ error: "Failed to fetch assignments" });
      }

      // Helper function to get month key (YYYY-MM format)
      const getMonthKey = (date: string): string => {
        return new Date(date).toISOString().slice(0, 7);
      };

      // Generate monthly statistics for positions
      const monthlyStats: { [key: string]: PositionMonthlyStats } = {};
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
          totalPositionsAdded: 0,
          totalPositionSlots: 0,
          totalPositionsFilled: 0,
          positionsCreated: [],
          assignmentsCreated: [],
        };
      }

      // Also ensure current month is included
      const currentMonthKey = getMonthKey(new Date().toISOString());
      if (!monthlyStats[currentMonthKey]) {
        monthlyStats[currentMonthKey] = {
          month: currentMonthKey,
          totalPositionsAdded: 0,
          totalPositionSlots: 0,
          totalPositionsFilled: 0,
          positionsCreated: [],
          assignmentsCreated: [],
        };
      }

      // Process positions and populate monthly stats
      positions?.forEach((position: Position) => {
        const createdMonth = getMonthKey(position.created_at);

        if (monthlyStats[createdMonth]) {
          monthlyStats[createdMonth].totalPositionsAdded++;
          monthlyStats[createdMonth].totalPositionSlots +=
            position.number_of_positions || 1;
          monthlyStats[createdMonth].positionsCreated.push(position);
        }
      });

      // Process assignments and populate monthly stats
      assignments?.forEach((assignment: Assignment) => {
        const createdMonth = getMonthKey(assignment.created_at);

        if (monthlyStats[createdMonth]) {
          monthlyStats[createdMonth].totalPositionsFilled++;
          monthlyStats[createdMonth].assignmentsCreated.push(assignment);
        }
      });

      // Convert to array and sort by month (most recent first)
      const monthlyArray = Object.values(monthlyStats).sort(
        (a: PositionMonthlyStats, b: PositionMonthlyStats) =>
          b.month.localeCompare(a.month)
      );

      // Calculate current totals
      const totalPositionsAdded = positions?.length || 0;
      const totalPositionSlots =
        positions?.reduce(
          (sum: number, pos: Position) => sum + (pos.number_of_positions || 1),
          0
        ) || 0;
      const totalPositionsFilled = assignments?.length || 0;

      // Format historical data for charts
      const formatHistoricalData = (
        monthlyArray: PositionMonthlyStats[],
        field: keyof PositionMonthlyStats
      ) => {
        return monthlyArray
          .reverse() // Oldest to newest for charts
          .map((month: PositionMonthlyStats) => {
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
          id: "total_positions_added",
          label: "Total Positions Added",
          currentValue: totalPositionsAdded,
          previousValue: monthlyArray[1]?.totalPositionsAdded || 0,
          unit: "positions",
          formatType: "number",
          description: "Total positions created by all recruiters",
          historicalData: formatHistoricalData(
            monthlyArray,
            "totalPositionsAdded"
          ),
        },
        {
          id: "total_position_slots",
          label: "Total Position Slots",
          currentValue: totalPositionSlots,
          previousValue: monthlyArray[1]?.totalPositionSlots || 0,
          unit: "slots",
          formatType: "number",
          description:
            "Total available position slots created by all recruiters",
          historicalData: formatHistoricalData(
            monthlyArray,
            "totalPositionSlots"
          ),
        },
        {
          id: "total_positions_filled",
          label: "Total Positions Filled",
          currentValue: totalPositionsFilled,
          previousValue: monthlyArray[1]?.totalPositionsFilled || 0,
          unit: "filled",
          formatType: "number",
          description: "Total positions filled by all recruiters",
          historicalData: formatHistoricalData(
            monthlyArray,
            "totalPositionsFilled"
          ),
        },
      ];

      const response: any = {
        metrics,
        timeRange: {
          months: monthsBack,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
        scope: "all-recruiters",
      };

      res.json(response);
    } catch (error) {
      console.error("Unexpected error fetching position metrics:", error);
      res.status(500).json({
        error: "An unexpected error occurred while fetching position metrics",
      });
    }
  }
);

/**
 * Get position metrics for specific recruiter
 * GET /api/metrics/recruiters/positions/:recruiterId (shows data for specific recruiter)
 * @access Private (Admin, Recruiter - limited access for recruiters to their own data)
 */
router.get(
  "/positions/:recruiterId",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { recruiterId } = req.params;
      const { timeRange = "12" } = req.query as { timeRange?: string };

      const monthsBack = parseInt(timeRange) || 12;

      // Get recruiter info
      const { data: recruiterData, error: recruiterError } =
        await supabase.auth.admin.getUserById(recruiterId);

      if (recruiterError || !recruiterData?.user) {
        return res.status(404).json({ error: "Recruiter not found" });
      }

      const recruiter = recruiterData.user;
      const recruiterInfo = {
        id: recruiter.id,
        email: recruiter.email || "",
        name:
          recruiter.user_metadata?.name ||
          `${recruiter.user_metadata?.firstName || ""} ${
            recruiter.user_metadata?.lastName || ""
          }`.trim() ||
          "Unknown",
      };

      // Get positions created by this recruiter within the time range
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);

      let positionsQuery = supabase
        .from("positions")
        .select(
          `
          id,
          title,
          number_of_positions,
          created_at,
          created_by_user_id
        `
        )
        .eq("created_by_user_id", recruiterId)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      const { data: positions, error: positionsError } = await positionsQuery;

      if (positionsError) {
        console.error("Error fetching positions:", positionsError);
        return res.status(500).json({ error: "Failed to fetch positions" });
      }

      // Get assignments created by this recruiter within the time range
      let assignmentsQuery = supabase
        .from("position_candidate_assignments")
        .select(
          `
          id,
          position_id,
          candidate_id,
          status,
          created_at,
          created_by_user_id
        `
        )
        .eq("created_by_user_id", recruiterId)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      const { data: assignments, error: assignmentsError } =
        await assignmentsQuery;

      if (assignmentsError) {
        console.error("Error fetching assignments:", assignmentsError);
        return res.status(500).json({ error: "Failed to fetch assignments" });
      }

      // Helper function to get month key (YYYY-MM format)
      const getMonthKey = (date: string): string => {
        return new Date(date).toISOString().slice(0, 7);
      };

      // Generate monthly statistics for positions
      const monthlyStats: { [key: string]: PositionMonthlyStats } = {};
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
          totalPositionsAdded: 0,
          totalPositionSlots: 0,
          totalPositionsFilled: 0,
          positionsCreated: [],
          assignmentsCreated: [],
        };
      }

      // Also ensure current month is included
      const currentMonthKey = getMonthKey(new Date().toISOString());
      if (!monthlyStats[currentMonthKey]) {
        monthlyStats[currentMonthKey] = {
          month: currentMonthKey,
          totalPositionsAdded: 0,
          totalPositionSlots: 0,
          totalPositionsFilled: 0,
          positionsCreated: [],
          assignmentsCreated: [],
        };
      }

      // Process positions and populate monthly stats
      positions?.forEach((position: Position) => {
        const createdMonth = getMonthKey(position.created_at);

        if (monthlyStats[createdMonth]) {
          monthlyStats[createdMonth].totalPositionsAdded++;
          monthlyStats[createdMonth].totalPositionSlots +=
            position.number_of_positions || 1;
          monthlyStats[createdMonth].positionsCreated.push(position);
        }
      });

      // Process assignments and populate monthly stats
      assignments?.forEach((assignment: Assignment) => {
        const createdMonth = getMonthKey(assignment.created_at);

        if (monthlyStats[createdMonth]) {
          monthlyStats[createdMonth].totalPositionsFilled++;
          monthlyStats[createdMonth].assignmentsCreated.push(assignment);
        }
      });

      // Convert to array and sort by month (most recent first)
      const monthlyArray = Object.values(monthlyStats).sort(
        (a: PositionMonthlyStats, b: PositionMonthlyStats) =>
          b.month.localeCompare(a.month)
      );

      // Calculate current totals
      const totalPositionsAdded = positions?.length || 0;
      const totalPositionSlots =
        positions?.reduce(
          (sum: number, pos: Position) => sum + (pos.number_of_positions || 1),
          0
        ) || 0;
      const totalPositionsFilled = assignments?.length || 0;

      // Format historical data for charts
      const formatHistoricalData = (
        monthlyArray: PositionMonthlyStats[],
        field: keyof PositionMonthlyStats
      ) => {
        return monthlyArray
          .reverse() // Oldest to newest for charts
          .map((month: PositionMonthlyStats) => {
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
          id: "total_positions_added",
          label: "Total Positions Added",
          currentValue: totalPositionsAdded,
          previousValue: monthlyArray[1]?.totalPositionsAdded || 0,
          unit: "positions",
          formatType: "number",
          description: "Total positions created by you",
          historicalData: formatHistoricalData(
            monthlyArray,
            "totalPositionsAdded"
          ),
        },
        {
          id: "total_position_slots",
          label: "Total Position Slots",
          currentValue: totalPositionSlots,
          previousValue: monthlyArray[1]?.totalPositionSlots || 0,
          unit: "slots",
          formatType: "number",
          description: "Total available position slots created by you",
          historicalData: formatHistoricalData(
            monthlyArray,
            "totalPositionSlots"
          ),
        },
        {
          id: "total_positions_filled",
          label: "Total Positions Filled",
          currentValue: totalPositionsFilled,
          previousValue: monthlyArray[1]?.totalPositionsFilled || 0,
          unit: "filled",
          formatType: "number",
          description: "Total positions filled by you",
          historicalData: formatHistoricalData(
            monthlyArray,
            "totalPositionsFilled"
          ),
        },
      ];

      const response: any = {
        metrics,
        timeRange: {
          months: monthsBack,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
        scope: "recruiter-specific",
        recruiter: recruiterInfo,
      };

      res.json(response);
    } catch (error) {
      console.error("Unexpected error fetching position metrics:", error);
      res.status(500).json({
        error: "An unexpected error occurred while fetching position metrics",
      });
    }
  }
);

/**
 * Get dashboard metrics for recruiter activities
 * GET /api/metrics/recruiters (shows total data for all recruiters)
 * GET /api/metrics/recruiters/:recruiterId (shows data for specific recruiter)
 * @access Private (Admin, Recruiter - limited access for recruiters to their own data)
 */
router.get(
  "/:recruiterId?",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { recruiterId } = req.params;
      const { timeRange = "12" } = req.query as { timeRange?: string };

      const monthsBack = parseInt(timeRange) || 12;

      // Simple logic: if recruiterId is provided, show that recruiter's data
      // If no recruiterId, show total data for all recruiters
      const targetRecruiterId: string | undefined = recruiterId;

      // Get recruiter info if specific recruiter is requested
      let recruiterInfo = null;
      if (targetRecruiterId) {
        const { data: recruiterData, error: recruiterError } =
          await supabase.auth.admin.getUserById(targetRecruiterId);

        if (recruiterError || !recruiterData?.user) {
          return res.status(404).json({ error: "Recruiter not found" });
        }

        const recruiter = recruiterData.user;

        recruiterInfo = {
          id: recruiter.id,
          email: recruiter.email || "",
          name:
            recruiter.user_metadata?.name ||
            `${recruiter.user_metadata?.firstName || ""} ${
              recruiter.user_metadata?.lastName || ""
            }`.trim() ||
            "Unknown",
        };
      }

      // Get all jobseeker profiles within the time range
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);

      let profilesQuery = supabase
        .from("jobseeker_profiles")
        .select(
          `
          id,
          verification_status,
          created_at,
          created_by_user_id
        `
        )
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      // Filter by recruiter if specified (only when targetRecruiterId is set)
      if (targetRecruiterId) {
        profilesQuery = profilesQuery.eq(
          "created_by_user_id",
          targetRecruiterId
        );
      }

      const { data: profiles, error: profilesError } = await profilesQuery;

      if (profilesError) {
        console.error("Error fetching jobseeker profiles:", profilesError);
        return res
          .status(500)
          .json({ error: "Failed to fetch jobseeker profiles" });
      }

      // Helper function to get month key (YYYY-MM format)
      const getMonthKey = (date: string): string => {
        return new Date(date).toISOString().slice(0, 7);
      };

      // Generate monthly statistics
      const monthlyStats: { [key: string]: MonthlyStats } = {};
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
          total: 0,
          pending: 0,
          verified: 0,
          rejected: 0,
          profilesCreated: [],
        };
      }

      // Also ensure current month is included (in case monthsBack doesn't include it)
      const currentMonthKey = getMonthKey(new Date().toISOString());
      if (!monthlyStats[currentMonthKey]) {
        monthlyStats[currentMonthKey] = {
          month: currentMonthKey,
          total: 0,
          pending: 0,
          verified: 0,
          rejected: 0,
          profilesCreated: [],
        };
      }

      // Process profiles and populate monthly stats
      profiles?.forEach((profile: JobseekerProfile) => {
        const createdMonth = getMonthKey(profile.created_at);

        if (monthlyStats[createdMonth]) {
          monthlyStats[createdMonth].total++;
          monthlyStats[createdMonth].profilesCreated.push(profile);

          // Count by verification status
          switch (profile.verification_status) {
            case "pending":
              monthlyStats[createdMonth].pending++;
              break;
            case "verified":
              monthlyStats[createdMonth].verified++;
              break;
            case "rejected":
              monthlyStats[createdMonth].rejected++;
              break;
          }
        }
      });

      // Convert to array and sort by month (most recent first)
      const monthlyArray = Object.values(monthlyStats).sort(
        (a: MonthlyStats, b: MonthlyStats) => b.month.localeCompare(a.month)
      );

      // Calculate current totals (across all profiles, not just monthly)
      const currentTotals = {
        total: profiles?.length || 0,
        pending:
          profiles?.filter(
            (p: JobseekerProfile) => p.verification_status === "pending"
          ).length || 0,
        verified:
          profiles?.filter(
            (p: JobseekerProfile) => p.verification_status === "verified"
          ).length || 0,
        rejected:
          profiles?.filter(
            (p: JobseekerProfile) => p.verification_status === "rejected"
          ).length || 0,
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
          id: "total_profiles",
          label: "Total Profiles Created",
          currentValue: currentTotals.total,
          previousValue: monthlyArray[1]?.total || 0,
          unit: "profiles",
          formatType: "number",
          description: targetRecruiterId
            ? "Overall total number of jobseeker profiles created by you"
            : "Overall total number of jobseeker profiles created by all recruiters",
          historicalData: formatHistoricalData(monthlyArray, "total"),
        },
        {
          id: "pending_profiles",
          label: "Total Pending Verification",
          currentValue: currentTotals.pending,
          previousValue: monthlyArray[1]?.pending || 0,
          unit: "profiles",
          formatType: "number",
          description: targetRecruiterId
            ? "Total jobseeker profiles created by you awaiting verification"
            : "Total jobseeker profiles awaiting verification",
          historicalData: formatHistoricalData(monthlyArray, "pending"),
        },
        {
          id: "verified_profiles",
          label: "Total Verified Profiles",
          currentValue: currentTotals.verified,
          previousValue: monthlyArray[1]?.verified || 0,
          unit: "profiles",
          formatType: "number",
          description: targetRecruiterId
            ? "Total jobseeker profiles created by you that have been verified"
            : "Total jobseeker profiles that have been verified",
          historicalData: formatHistoricalData(monthlyArray, "verified"),
        },
        {
          id: "rejected_profiles",
          label: "Total Rejected Profiles",
          currentValue: currentTotals.rejected,
          previousValue: monthlyArray[1]?.rejected || 0,
          unit: "profiles",
          formatType: "number",
          description: targetRecruiterId
            ? "Total jobseeker profiles created by you that have been rejected"
            : "Total jobseeker profiles that have been rejected",
          historicalData: formatHistoricalData(monthlyArray, "rejected"),
        },
      ];

      const response: any = {
        metrics,
        timeRange: {
          months: monthsBack,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
        scope: targetRecruiterId ? "recruiter-specific" : "all-recruiters",
      };

      // Add recruiter info if specific recruiter was requested
      if (recruiterInfo) {
        response.recruiter = recruiterInfo;
      }

      res.json(response);
    } catch (error) {
      console.error("Unexpected error fetching recruiter metrics:", error);
      res.status(500).json({
        error: "An unexpected error occurred while fetching metrics",
      });
    }
  }
);

export default router;
