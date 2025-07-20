import { Router, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import { apiRateLimiter, sanitizeInputs } from "../middleware/security.js";
import { activityLogger } from "../middleware/activityLogger.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Types for bulk timesheet data
interface BulkTimesheetData {
  clientId: string;
  positionId: string;
  invoiceNumber: string;
  weekStartDate: string;
  weekEndDate: string;
  weekPeriod: string;
  emailSent?: boolean;
  totalHours: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalOvertimePay: number;
  totalJobseekerPay: number;
  totalClientBill: number;
  totalBonus: number;
  totalDeductions: number;
  netPay: number;
  numberOfJobseekers: number;
  averageHoursPerJobseeker: number;
  averagePayPerJobseeker: number;
  jobseekerTimesheets: any[]; // JSONB array
}

interface DbBulkTimesheetData {
  id?: string;
  client_id: string;
  position_id: string;
  invoice_number: string;
  week_start_date: string;
  week_end_date: string;
  week_period: string;
  email_sent: boolean;
  total_hours: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_overtime_pay: number;
  total_jobseeker_pay: number;
  total_client_bill: number;
  total_bonus: number;
  total_deductions: number;
  net_pay: number;
  number_of_jobseekers: number;
  average_hours_per_jobseeker: number;
  average_pay_per_jobseeker: number;
  jobseeker_timesheets: any; // JSONB
  created_at?: string;
  created_by_user_id?: string;
  updated_at?: string;
  updated_by_user_id?: string;
  version?: number;
}

/**
 * Convert snake_case to camelCase
 */
function snakeToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Transform bulk timesheet data from camelCase to snake_case for database
 */
function transformToDbFormat(bulkTimesheetData: BulkTimesheetData): DbBulkTimesheetData {
  return {
    client_id: bulkTimesheetData.clientId,
    position_id: bulkTimesheetData.positionId,
    invoice_number: bulkTimesheetData.invoiceNumber,
    week_start_date: bulkTimesheetData.weekStartDate,
    week_end_date: bulkTimesheetData.weekEndDate,
    week_period: bulkTimesheetData.weekPeriod,
    email_sent: bulkTimesheetData.emailSent || false,
    total_hours: bulkTimesheetData.totalHours,
    total_regular_hours: bulkTimesheetData.totalRegularHours,
    total_overtime_hours: bulkTimesheetData.totalOvertimeHours,
    total_overtime_pay: bulkTimesheetData.totalOvertimePay,
    total_jobseeker_pay: bulkTimesheetData.totalJobseekerPay,
    total_client_bill: bulkTimesheetData.totalClientBill,
    total_bonus: bulkTimesheetData.totalBonus,
    total_deductions: bulkTimesheetData.totalDeductions,
    net_pay: bulkTimesheetData.netPay,
    number_of_jobseekers: bulkTimesheetData.numberOfJobseekers,
    average_hours_per_jobseeker: bulkTimesheetData.averageHoursPerJobseeker,
    average_pay_per_jobseeker: bulkTimesheetData.averagePayPerJobseeker,
    jobseeker_timesheets: bulkTimesheetData.jobseekerTimesheets,
  };
}

/**
 * Transform bulk timesheet data from snake_case to camelCase for frontend
 */
function transformToFrontendFormat(data: DbBulkTimesheetData): any {
  const result: any = {};
  
  Object.entries(data).forEach(([key, value]) => {
    const camelKey = snakeToCamelCase(key);
    result[camelKey] = value;
  });
  
  return result;
}

/**
 * Generate next available invoice number for bulk timesheets
 * GET /api/bulk-timesheets/generate-invoice-number
 */
router.get(
  "/generate-invoice-number",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      // Get all existing invoice numbers from both timesheets and bulk_timesheets tables
      const { data: bulkTimesheetInvoices } = await supabase.from("bulk_timesheets").select("invoice_number").not("invoice_number", "is", null);

      // Combine all existing invoice numbers
      const existingNumbers: number[] = [];
      
      [...(bulkTimesheetInvoices || [])].forEach(item => {
        const invoiceNumber = item.invoice_number;
        if (invoiceNumber) {
          let numericPart: string;
          
          // Handle both formats: "INV-000001" and "000001"
          if (invoiceNumber.startsWith('INV-')) {
            numericPart = invoiceNumber.replace('INV-', '');
          } else {
            numericPart = invoiceNumber;
          }
          
          const number = parseInt(numericPart, 10);
          if (!isNaN(number)) {
            existingNumbers.push(number);
          }
        }
      });

      // Sort numbers to find gaps
      existingNumbers.sort((a, b) => a - b);

      // Find the lowest available number starting from 1
      let lowestAvailable = 1;
      
      for (const num of existingNumbers) {
        if (num === lowestAvailable) {
          lowestAvailable++;
        } else if (num > lowestAvailable) {
          break;
        }
      }

      // Format as padded string without INV prefix
      const nextInvoiceNumber = lowestAvailable.toString().padStart(6, "0");

      return res.status(200).json({
        success: true,
        invoiceNumber: nextInvoiceNumber,
      });
    } catch (error) {
      console.error("Error generating bulk timesheet invoice number:", error);
      res.status(500).json({
        error: "Failed to generate invoice number",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Helper function to apply filters to a Supabase query
 */
function applyBulkTimesheetFilters(query: any, filters: {
  searchTerm?: string;
  clientFilter?: string;
  positionFilter?: string;
  invoiceNumberFilter?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  emailSentFilter?: string;
}) {
  const {
    searchTerm,
    clientFilter,
    positionFilter,
    invoiceNumberFilter,
    dateRangeStart,
    dateRangeEnd,
    emailSentFilter
  } = filters;

  // Global search across multiple fields
  if (searchTerm && searchTerm.trim().length > 0) {
    const searchTermTrimmed = searchTerm.trim();
    query = query.or(`invoice_number.ilike.%${searchTermTrimmed}%,clients.company_name.ilike.%${searchTermTrimmed}%,positions.title.ilike.%${searchTermTrimmed}%`);
  }

  // Individual column filters
  if (clientFilter && clientFilter.trim().length > 0) {
    query = query.or(`clients.company_name.ilike.%${clientFilter.trim()}%,clients.short_code.ilike.%${clientFilter.trim()}%`);
  }
  if (positionFilter && positionFilter.trim().length > 0) {
    query = query.ilike('positions.title', `%${positionFilter.trim()}%`);
  }
  if (invoiceNumberFilter && invoiceNumberFilter.trim().length > 0) {
    query = query.ilike('invoice_number', `%${invoiceNumberFilter.trim()}%`);
  }
  if (dateRangeStart && dateRangeStart.trim().length > 0) {
    query = query.gte('week_start_date', dateRangeStart.trim());
  }
  if (dateRangeEnd && dateRangeEnd.trim().length > 0) {
    query = query.lte('week_end_date', dateRangeEnd.trim());
  }
  if (emailSentFilter && emailSentFilter.trim().length > 0) {
    const emailSentBool = emailSentFilter.toLowerCase() === 'true';
    query = query.eq('email_sent', emailSentBool);
  }

  return query;
}

/**
 * Get all bulk timesheets with pagination and filtering
 * GET /api/bulk-timesheets
 * @access Private (Admin, Recruiter, Jobseeker - own timesheets only)
 */
router.get(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.id;
      const userType = req.user.user_metadata?.user_type;

      // Extract pagination and filter parameters from query
      const {
        page = "1",
        limit = "10",
        searchTerm = "",
        clientFilter = "",
        positionFilter = "",
        invoiceNumberFilter = "",
        dateRangeStart = "",
        dateRangeEnd = "",
        emailSentFilter = "",
      } = req.query as {
        page?: string;
        limit?: string;
        searchTerm?: string;
        clientFilter?: string;
        positionFilter?: string;
        invoiceNumberFilter?: string;
        dateRangeStart?: string;
        dateRangeEnd?: string;
        emailSentFilter?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build the base query with joins for related data
      let baseQuery = supabase
        .from("bulk_timesheets")
        .select(`
          *,
          clients!inner(id, company_name, short_code, email_address1),
          positions!inner(id, title, position_code)
        `);

      // Apply role-based filtering
      if (userType === "jobseeker") {
        baseQuery = baseQuery.eq("created_by_user_id", userId);
      }

      // Apply all filters at database level
      baseQuery = applyBulkTimesheetFilters(baseQuery, {
        searchTerm,
        clientFilter,
        positionFilter,
        invoiceNumberFilter,
        dateRangeStart,
        dateRangeEnd,
        emailSentFilter,
      });

      // Get total count
      let totalCountQuery = supabase
        .from("bulk_timesheets")
        .select("*", { count: "exact", head: true });

      if (userType === "jobseeker") {
        totalCountQuery = totalCountQuery.eq("created_by_user_id", userId);
      }

      const { count: totalCount, error: countError } = await totalCountQuery;

      if (countError) {
        console.error("Error getting total count:", countError);
        return res.status(500).json({ error: "Failed to get total count of bulk timesheets" });
      }

      // Get filtered count
      let filteredCountQuery = supabase
        .from("bulk_timesheets")
        .select(`
          *,
          clients!inner(id, company_name, short_code, email_address1),
          positions!inner(id, title, position_code)
        `, { count: "exact", head: true });

      if (userType === "jobseeker") {
        filteredCountQuery = filteredCountQuery.eq("created_by_user_id", userId);
      }

      filteredCountQuery = applyBulkTimesheetFilters(filteredCountQuery, {
        searchTerm,
        clientFilter,
        positionFilter,
        invoiceNumberFilter,
        dateRangeStart,
        dateRangeEnd,
        emailSentFilter,
      });

      const { count: filteredCount, error: filteredCountError } = await filteredCountQuery;

      if (filteredCountError) {
        console.error("Error getting filtered count:", filteredCountError);
        return res.status(500).json({ error: "Failed to get filtered count of bulk timesheets" });
      }

      // Apply pagination and execute main query
      const { data: bulkTimesheets, error } = await baseQuery
        .range(offset, offset + limitNum - 1)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching bulk timesheets:", error);
        return res.status(500).json({ error: "Failed to fetch bulk timesheets" });
      }

      if (!bulkTimesheets || bulkTimesheets.length === 0) {
        return res.json({
          bulkTimesheets: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount || 0,
            totalFiltered: filteredCount || 0,
            totalPages: Math.ceil((filteredCount || 0) / limitNum),
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }

      // Transform bulk timesheets to frontend format
      const formattedBulkTimesheets = bulkTimesheets.map((bulkTimesheet) => {
        const formatted = transformToFrontendFormat(bulkTimesheet);

        // Add related data
        formatted.client = bulkTimesheet.clients;
        formatted.position = bulkTimesheet.positions;

        // Clean up the joined data from the main object
        delete formatted.clients;
        delete formatted.positions;

        return formatted;
      });

      // Calculate pagination metadata
      const totalFiltered = filteredCount || 0;
      const totalPages = Math.ceil(totalFiltered / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      return res.status(200).json({
        bulkTimesheets: formattedBulkTimesheets,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount || 0,
          totalFiltered,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      });
    } catch (error) {
      console.error("Unexpected error fetching bulk timesheets:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

/**
 * Get a specific bulk timesheet by ID
 * GET /api/bulk-timesheets/:id
 * @access Private (Admin, Recruiter, Jobseeker - own timesheets only)
 */
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.id;
      const userType = req.user.user_metadata?.user_type;
      const { id } = req.params;

      // Build query with role-based filtering
      let query = supabase
        .from("bulk_timesheets")
        .select(`
          *,
          clients!inner(id, company_name, short_code, email_address1, city1, province1, postal_code1),
          positions!inner(id, title, position_code)
        `)
        .eq("id", id);

      if (userType === "jobseeker") {
        query = query.eq("created_by_user_id", userId);
      }

      const { data: bulkTimesheet, error } = await query.maybeSingle();

      if (error) {
        console.error("Error fetching bulk timesheet:", error);
        return res.status(500).json({ error: "Failed to fetch bulk timesheet" });
      }

      if (!bulkTimesheet) {
        return res.status(404).json({ error: "Bulk timesheet not found or access denied" });
      }

      // Transform to frontend format
      const formatted = transformToFrontendFormat(bulkTimesheet);
      formatted.client = bulkTimesheet.clients;
      formatted.position = bulkTimesheet.positions;

      // Clean up joined data
      delete formatted.clients;
      delete formatted.positions;

      return res.status(200).json(formatted);
    } catch (error) {
      console.error("Unexpected error fetching bulk timesheet:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

/**
 * Create a new bulk timesheet
 * POST /api/bulk-timesheets
 * @access Private (Admin, Recruiter, Jobseeker)
 */
router.post(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  sanitizeInputs,
  activityLogger({
    onSuccess: async (req: Request, res: Response) => {
      const bulkTimesheetData = req.body;
      const newBulkTimesheet = res.locals.newBulkTimesheet;

      // Get client and position names for display
      let clientName = "Unknown Client";
      let positionTitle = "Unknown Position";

      if (bulkTimesheetData.clientId) {
        try {
          const { data: client } = await supabase
            .from("clients")
            .select("company_name, short_code")
            .eq("id", bulkTimesheetData.clientId)
            .single();
          if (client) {
            clientName = client.company_name || client.short_code || "Unknown Client";
          }
        } catch (error) {
          console.warn("Could not fetch client name for activity log");
        }
      }

      if (bulkTimesheetData.positionId) {
        try {
          const { data: position } = await supabase
            .from("positions")
            .select("title, position_code")
            .eq("id", bulkTimesheetData.positionId)
            .single();
          if (position) {
            positionTitle = position.title || position.position_code || "Unknown Position";
          }
        } catch (error) {
          console.warn("Could not fetch position title for activity log");
        }
      }

      const finalTotalPay = newBulkTimesheet?.total_jobseeker_pay ?? bulkTimesheetData.totalJobseekerPay ?? 0;
      const finalTotalHours = newBulkTimesheet?.total_hours ?? bulkTimesheetData.totalHours ?? 0;

      return {
        actionType: "create_bulk_timesheet",
        actionVerb: "created",
        primaryEntityType: "bulk_timesheet",
        primaryEntityId: newBulkTimesheet?.id,
        primaryEntityName: `Bulk Timesheet ${newBulkTimesheet?.invoice_number}`,
        secondaryEntityType: "client",
        secondaryEntityId: bulkTimesheetData.clientId || null,
        secondaryEntityName: clientName,
        displayMessage: `Created bulk timesheet ${newBulkTimesheet?.invoice_number} for ${clientName} - ${positionTitle} - $${finalTotalPay.toFixed(2)} (${finalTotalHours} hours)`,
        category: "financial",
        priority: "normal" as const,
        metadata: {
          invoiceNumber: newBulkTimesheet?.invoice_number,
          weekPeriod: newBulkTimesheet?.week_period ?? bulkTimesheetData.weekPeriod,
          numberOfJobseekers: newBulkTimesheet?.number_of_jobseekers ?? bulkTimesheetData.numberOfJobseekers,
          totalHours: finalTotalHours,
          totalPay: finalTotalPay,
          clientName,
          positionTitle,
        },
      };
    },
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.id;
      const bulkTimesheetData: BulkTimesheetData = req.body;

      // Validate required fields
      const requiredFields = [
        "clientId", "positionId", "invoiceNumber", "weekStartDate", "weekEndDate",
        "weekPeriod", "totalHours", "totalJobseekerPay", "numberOfJobseekers", "jobseekerTimesheets"
      ];

      for (const field of requiredFields) {
        if (bulkTimesheetData[field as keyof BulkTimesheetData] === undefined || bulkTimesheetData[field as keyof BulkTimesheetData] === null) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Validate client exists
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id")
        .eq("id", bulkTimesheetData.clientId)
        .maybeSingle();

      if (clientError || !client) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      // Validate position exists
      const { data: position, error: positionError } = await supabase
        .from("positions")
        .select("id")
        .eq("id", bulkTimesheetData.positionId)
        .maybeSingle();

      if (positionError || !position) {
        return res.status(400).json({ error: "Invalid position ID" });
      }

      // Prepare bulk timesheet data for database
      const dbBulkTimesheetData: Omit<DbBulkTimesheetData, "id" | "created_at" | "updated_at" | "version"> = {
        ...transformToDbFormat(bulkTimesheetData),
        created_by_user_id: userId,
        updated_by_user_id: userId,
      };

      // Insert bulk timesheet into database
      const { data: newBulkTimesheet, error: insertError } = await supabase
        .from("bulk_timesheets")
        .insert([dbBulkTimesheetData])
        .select("*")
        .single();

      if (insertError) {
        console.error("Error creating bulk timesheet:", insertError);
        return res.status(500).json({ error: "Failed to create bulk timesheet" });
      }

      // Store for activity logging
      res.locals.newBulkTimesheet = newBulkTimesheet;

      // Transform response to frontend format
      const formatted = transformToFrontendFormat(newBulkTimesheet);

      return res.status(201).json({
        success: true,
        message: "Bulk timesheet created successfully",
        bulkTimesheet: formatted,
      });
    } catch (error) {
      console.error("Unexpected error creating bulk timesheet:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

/**
 * Update an existing bulk timesheet
 * PUT /api/bulk-timesheets/:id
 * @access Private (Admin, Recruiter, Jobseeker - own timesheets only)
 */
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  sanitizeInputs,
  activityLogger({
    onSuccess: async (req: Request, res: Response) => {
      const bulkTimesheetData = req.body;
      const updatedBulkTimesheet = res.locals.updatedBulkTimesheet;
      const { id } = req.params;

      // Get client and position names for display
      let clientName = "Unknown Client";
      let positionTitle = "Unknown Position";

      if (bulkTimesheetData.clientId || updatedBulkTimesheet?.client_id) {
        try {
          const clientId = bulkTimesheetData.clientId || updatedBulkTimesheet?.client_id;
          const { data: client } = await supabase
            .from("clients")
            .select("company_name, short_code")
            .eq("id", clientId)
            .single();
          if (client) {
            clientName = client.company_name || client.short_code || "Unknown Client";
          }
        } catch (error) {
          console.warn("Could not fetch client name for activity log");
        }
      }

      if (bulkTimesheetData.positionId || updatedBulkTimesheet?.position_id) {
        try {
          const positionId = bulkTimesheetData.positionId || updatedBulkTimesheet?.position_id;
          const { data: position } = await supabase
            .from("positions")
            .select("title, position_code")
            .eq("id", positionId)
            .single();
          if (position) {
            positionTitle = position.title || position.position_code || "Unknown Position";
          }
        } catch (error) {
          console.warn("Could not fetch position title for activity log");
        }
      }

      const finalTotalPay = updatedBulkTimesheet?.total_jobseeker_pay ?? bulkTimesheetData.totalJobseekerPay ?? 0;
      const finalTotalHours = updatedBulkTimesheet?.total_hours ?? bulkTimesheetData.totalHours ?? 0;

      return {
        actionType: "update_bulk_timesheet",
        actionVerb: "updated",
        primaryEntityType: "bulk_timesheet",
        primaryEntityId: id,
        primaryEntityName: `Bulk Timesheet ${updatedBulkTimesheet?.invoice_number}`,
        secondaryEntityType: "client",
        secondaryEntityId: bulkTimesheetData.clientId || updatedBulkTimesheet?.client_id || null,
        secondaryEntityName: clientName,
        displayMessage: `Updated bulk timesheet ${updatedBulkTimesheet?.invoice_number} for ${clientName} - ${positionTitle} - $${finalTotalPay.toFixed(2)} (${finalTotalHours} hours)`,
        category: "financial",
        priority: "normal" as const,
        metadata: {
          invoiceNumber: updatedBulkTimesheet?.invoice_number,
          weekPeriod: updatedBulkTimesheet?.week_period ?? bulkTimesheetData.weekPeriod,
          numberOfJobseekers: updatedBulkTimesheet?.number_of_jobseekers ?? bulkTimesheetData.numberOfJobseekers,
          totalHours: finalTotalHours,
          totalPay: finalTotalPay,
          clientName,
          positionTitle,
        },
      };
    },
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.id;
      const userType = req.user.user_metadata?.user_type;
      const { id } = req.params;
      const bulkTimesheetData: Partial<BulkTimesheetData> = req.body;

      // Check if bulk timesheet exists and user has permission
      let existingQuery = supabase
        .from("bulk_timesheets")
        .select("*")
        .eq("id", id);

      if (userType === "jobseeker") {
        existingQuery = existingQuery.eq("created_by_user_id", userId);
      }

      const { data: existingBulkTimesheet, error: bulkTimesheetCheckError } = await existingQuery.maybeSingle();

      if (bulkTimesheetCheckError || !existingBulkTimesheet) {
        return res.status(404).json({ error: "Bulk timesheet not found or access denied" });
      }

      // Validate client if provided
      if (bulkTimesheetData.clientId) {
        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select("id")
          .eq("id", bulkTimesheetData.clientId)
          .maybeSingle();

        if (clientError || !client) {
          return res.status(400).json({ error: "Invalid client ID" });
        }
      }

      // Validate position if provided
      if (bulkTimesheetData.positionId) {
        const { data: position, error: positionError } = await supabase
          .from("positions")
          .select("id")
          .eq("id", bulkTimesheetData.positionId)
          .maybeSingle();

        if (positionError || !position) {
          return res.status(400).json({ error: "Invalid position ID" });
        }
      }

      // Prepare bulk timesheet data for database update
      const updateData: any = {};

      if (bulkTimesheetData.clientId) updateData.client_id = bulkTimesheetData.clientId;
      if (bulkTimesheetData.positionId) updateData.position_id = bulkTimesheetData.positionId;
      if (bulkTimesheetData.invoiceNumber) updateData.invoice_number = bulkTimesheetData.invoiceNumber;
      if (bulkTimesheetData.weekStartDate) updateData.week_start_date = bulkTimesheetData.weekStartDate;
      if (bulkTimesheetData.weekEndDate) updateData.week_end_date = bulkTimesheetData.weekEndDate;
      if (bulkTimesheetData.weekPeriod) updateData.week_period = bulkTimesheetData.weekPeriod;
      if (bulkTimesheetData.emailSent !== undefined) updateData.email_sent = bulkTimesheetData.emailSent;
      if (bulkTimesheetData.totalHours !== undefined) updateData.total_hours = bulkTimesheetData.totalHours;
      if (bulkTimesheetData.totalRegularHours !== undefined) updateData.total_regular_hours = bulkTimesheetData.totalRegularHours;
      if (bulkTimesheetData.totalOvertimeHours !== undefined) updateData.total_overtime_hours = bulkTimesheetData.totalOvertimeHours;
      if (bulkTimesheetData.totalOvertimePay !== undefined) updateData.total_overtime_pay = bulkTimesheetData.totalOvertimePay;
      if (bulkTimesheetData.totalJobseekerPay !== undefined) updateData.total_jobseeker_pay = bulkTimesheetData.totalJobseekerPay;
      if (bulkTimesheetData.totalClientBill !== undefined) updateData.total_client_bill = bulkTimesheetData.totalClientBill;
      if (bulkTimesheetData.totalBonus !== undefined) updateData.total_bonus = bulkTimesheetData.totalBonus;
      if (bulkTimesheetData.totalDeductions !== undefined) updateData.total_deductions = bulkTimesheetData.totalDeductions;
      if (bulkTimesheetData.netPay !== undefined) updateData.net_pay = bulkTimesheetData.netPay;
      if (bulkTimesheetData.numberOfJobseekers !== undefined) updateData.number_of_jobseekers = bulkTimesheetData.numberOfJobseekers;
      if (bulkTimesheetData.averageHoursPerJobseeker !== undefined) updateData.average_hours_per_jobseeker = bulkTimesheetData.averageHoursPerJobseeker;
      if (bulkTimesheetData.averagePayPerJobseeker !== undefined) updateData.average_pay_per_jobseeker = bulkTimesheetData.averagePayPerJobseeker;
      if (bulkTimesheetData.jobseekerTimesheets) updateData.jobseeker_timesheets = bulkTimesheetData.jobseekerTimesheets;

      updateData.updated_by_user_id = userId;

      // Update bulk timesheet in database
      const { data: updatedBulkTimesheet, error: updateError } = await supabase
        .from("bulk_timesheets")
        .update(updateData)
        .eq("id", id)
        .select("*")
        .single();

      if (updateError) {
        console.error("Error updating bulk timesheet:", updateError);
        return res.status(500).json({ error: "Failed to update bulk timesheet" });
      }

      // Store for activity logging
      res.locals.updatedBulkTimesheet = updatedBulkTimesheet;

      // Transform response to frontend format
      const formatted = transformToFrontendFormat(updatedBulkTimesheet);

      return res.status(200).json({
        success: true,
        message: "Bulk timesheet updated successfully",
        bulkTimesheet: formatted,
      });
    } catch (error) {
      console.error("Unexpected error updating bulk timesheet:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

/**
 * Delete a bulk timesheet
 * DELETE /api/bulk-timesheets/:id
 * @access Private (Admin only)
 */
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin"]),
  activityLogger({
    onSuccess: async (req: Request, res: Response) => {
      const { id } = req.params;
      const deletedBulkTimesheet = res.locals.deletedBulkTimesheet;

      // Get client and position names for display
      let clientName = "Unknown Client";
      let positionTitle = "Unknown Position";

      if (deletedBulkTimesheet?.client_id) {
        try {
          const { data: client } = await supabase
            .from("clients")
            .select("company_name, short_code")
            .eq("id", deletedBulkTimesheet.client_id)
            .single();
          if (client) {
            clientName = client.company_name || client.short_code || "Unknown Client";
          }
        } catch (error) {
          console.warn("Could not fetch client name for activity log");
        }
      }

      if (deletedBulkTimesheet?.position_id) {
        try {
          const { data: position } = await supabase
            .from("positions")
            .select("title, position_code")
            .eq("id", deletedBulkTimesheet.position_id)
            .single();
          if (position) {
            positionTitle = position.title || position.position_code || "Unknown Position";
          }
        } catch (error) {
          console.warn("Could not fetch position title for activity log");
        }
      }

      return {
        actionType: "delete_bulk_timesheet",
        actionVerb: "deleted",
        primaryEntityType: "bulk_timesheet",
        primaryEntityId: id,
        primaryEntityName: `Bulk Timesheet ${deletedBulkTimesheet?.invoice_number}`,
        secondaryEntityType: "client",
        secondaryEntityId: deletedBulkTimesheet?.client_id,
        secondaryEntityName: clientName,
        displayMessage: `Deleted bulk timesheet ${deletedBulkTimesheet?.invoice_number} for ${clientName} - ${positionTitle} - $${(deletedBulkTimesheet?.total_jobseeker_pay ?? 0).toFixed(2)}`,
        category: "financial",
        priority: "high" as const,
        metadata: {
          invoiceNumber: deletedBulkTimesheet?.invoice_number,
          weekPeriod: deletedBulkTimesheet?.week_period,
          numberOfJobseekers: deletedBulkTimesheet?.number_of_jobseekers,
          totalHours: deletedBulkTimesheet?.total_hours,
          totalPay: deletedBulkTimesheet?.total_jobseeker_pay,
          clientName,
          positionTitle,
        },
      };
    },
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { id } = req.params;

      // Check if bulk timesheet exists
      const { data: existingBulkTimesheet, error: bulkTimesheetCheckError } = await supabase
        .from("bulk_timesheets")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (bulkTimesheetCheckError || !existingBulkTimesheet) {
        return res.status(404).json({ error: "Bulk timesheet not found" });
      }

      // Store for activity logging
      res.locals.deletedBulkTimesheet = existingBulkTimesheet;

      // Delete bulk timesheet
      const { error: deleteError } = await supabase
        .from("bulk_timesheets")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("Error deleting bulk timesheet:", deleteError);
        return res.status(500).json({ error: "Failed to delete bulk timesheet" });
      }

      return res.status(200).json({
        success: true,
        message: "Bulk timesheet deleted successfully",
        deletedId: id,
      });
    } catch (error) {
      console.error("Unexpected error deleting bulk timesheet:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

export default router;
