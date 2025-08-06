import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { sanitizeInputs, apiRateLimiter } from '../middleware/security.js';
import { activityLogger } from '../middleware/activityLogger.js';
import dotenv from 'dotenv';
import { PositionData } from '../types.js';
import { emailNotifier } from '../middleware/emailNotifier.js';
import { jobseekerAssignmentTextTemplate } from '../email-templates/jobseeker-assignment-txt.js';
import { jobseekerAssignmentHtmlTemplate } from '../email-templates/jobseeker-assignment-html.js';
import { jobseekerRemovalHtmlTemplate } from '../email-templates/jobseeker-removal-html.js';
import { jobseekerRemovalTextTemplate } from '../email-templates/jobseeker-removal-txt.js';

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


/**
 * Convert camelCase to snake_case properly handling consecutive capital letters
 */
function camelToSnakeCase(str: string): string {
  // Special handling for known problematic fields
  if (str === "documentsRequired") return "documents_required";

  // For other fields, general algorithm
  let result = "";
  let prevChar = "";

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (i === 0) {
      // First character is always lowercase
      result += char.toLowerCase();
    } else if (char === char.toUpperCase() && char !== char.toLowerCase()) {
      // This is a capital letter

      // If previous char was also uppercase and not the first char, don't add another underscore
      if (
        prevChar === prevChar.toUpperCase() &&
        prevChar !== prevChar.toLowerCase() &&
        i > 1
      ) {
        result += char.toLowerCase();
      } else {
        result += "_" + char.toLowerCase();
      }
    } else {
      result += char;
    }

    prevChar = char;
  }

  return result;
}

/**
 * Helper function to sync assigned_jobseekers array with active assignments
 * from position_candidate_assignments table
 */
async function syncAssignedJobseekers(positionId: string): Promise<string[]> {
  try {
    const { data: activeAssignments, error } = await supabase
      .from("position_candidate_assignments")
      .select("candidate_id")
      .eq("position_id", positionId)
      .eq("status", "active");

    if (error) {
      console.error("Error getting active assignments:", error);
      return [];
    }

    return activeAssignments ? activeAssignments.map(assignment => assignment.candidate_id) : [];
  } catch (error) {
    console.error("Error syncing assigned jobseekers:", error);
    return [];
  }
}

/**
 * Helper function to update position's assigned_jobseekers array based on active assignments
 */
async function updatePositionAssignedJobseekers(positionId: string): Promise<void> {
  try {
    const activeJobseekers = await syncAssignedJobseekers(positionId);
    
    await supabase
      .from("positions")
      .update({ assigned_jobseekers: activeJobseekers })
      .eq("id", positionId);
  } catch (error) {
    console.error("Error updating position assigned jobseekers:", error);
  }
}

/**
 * Get all positions with pagination and filtering
 * GET /api/positions
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  // apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      // Extract pagination and filter parameters from query
      const {
        page = "1",
        limit = "10",
        search = "",
        positionIdFilter = "",
        titleFilter = "",
        clientFilter = "",
        locationFilter = "",
        employmentTermFilter = "",
        employmentTypeFilter = "",
        positionCategoryFilter = "",
        experienceFilter = "",
        showOnPortalFilter = "",
        dateFilter = "",
      } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
        positionIdFilter?: string;
        titleFilter?: string;
        clientFilter?: string;
        locationFilter?: string;
        employmentTermFilter?: string;
        employmentTypeFilter?: string;
        positionCategoryFilter?: string;
        experienceFilter?: string;
        showOnPortalFilter?: string;
        dateFilter?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build the base query with all necessary fields
      let baseQuery = supabase
        .from("positions")
        .select(`
          id,
          position_code, 
          title,
          start_date,
          end_date,
          city, 
          province,
          employment_term,
          employment_type, 
          position_category,
          experience,
          show_on_job_portal,
          created_at,
          client_name,
          assigned_jobseekers,
          number_of_positions
        `);

      // Apply all filters at database level
      baseQuery = applyPositionFilters(baseQuery, {
        search,
        positionIdFilter,
        titleFilter,
        clientFilter,
        locationFilter,
        employmentTermFilter,
        employmentTypeFilter,
        positionCategoryFilter,
        experienceFilter,
        showOnPortalFilter,
        dateFilter
      });

      // Get total count (unfiltered)
      const { count: totalCount, error: countError } = await supabase
        .from("positions")
        .select("*", { count: "exact", head: true });

      if (countError) {
        console.error("Error getting total count:", countError);
        return res
          .status(500)
          .json({ error: "Failed to get total count of positions" });
      }

      // Get filtered count
      let countQuery = supabase
        .from("positions")
        .select("*", { count: "exact", head: true });

      countQuery = applyPositionFilters(countQuery, {
        search,
        positionIdFilter,
        titleFilter,
        clientFilter,
        locationFilter,
        employmentTermFilter,
        employmentTypeFilter,
        positionCategoryFilter,
        experienceFilter,
        showOnPortalFilter,
        dateFilter
      });

      const { count: filteredCount, error: filteredCountError } = await countQuery;

      if (filteredCountError) {
        console.error("Error getting filtered count:", filteredCountError);
        return res
          .status(500)
          .json({ error: "Failed to get filtered count of positions" });
      }

      // Apply pagination and execute main query
      const { data: positions, error } = await baseQuery
        .range(offset, offset + limitNum - 1)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching positions:", error);
        return res.status(500).json({ error: "Failed to fetch positions" });
      }

      if (!positions || positions.length === 0) {
        return res.json({
          positions: [],
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

      // Transform the response to include clientName and convert snake_case to camelCase
      const formattedPositions = await Promise.all(positions.map(async (position: any) => {
        // Since we're only selecting specific fields, handle the clients data properly
        const clientName = position.client_name || null;
        
        // Create a clean position object without the clients nested object
        const positionData = { ...position };
        delete positionData.client_name;

        // Sync assigned_jobseekers with active assignments from position_candidate_assignments table
        const activeJobseekers = await syncAssignedJobseekers(position.id);
        
        // Update the position data with synced assignments if they differ
        if (JSON.stringify(position.assigned_jobseekers || []) !== JSON.stringify(activeJobseekers)) {
          await updatePositionAssignedJobseekers(position.id);
          positionData.assigned_jobseekers = activeJobseekers;
        }

        // Convert snake_case to camelCase
        const formattedPosition = Object.entries(positionData).reduce(
          (acc, [key, value]) => {
            const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
              letter.toUpperCase()
            );
            acc[camelKey] = value;
            return acc;
          },
          { clientName } as Record<string, any>
        );

        return formattedPosition;
      }));

      // Calculate pagination metadata
      const totalFiltered = filteredCount || 0;
      const totalPages = Math.ceil(totalFiltered / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      return res.json({
        positions: formattedPositions,
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
      console.error("Unexpected error fetching positions:", error);
      return res
        .status(500)
        .json({
          error: "An unexpected error occurred while fetching positions",
        });
    }
  }
);

/**
 * Get all positions for a specific client with pagination and filtering
 * GET /api/positions/client/:clientId
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/client/:clientId",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  // apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      
      // Extract pagination and filter parameters from query
      const {
        page = "1",
        limit = "10",
        search = "",
        positionIdFilter = "",
        titleFilter = "",
        locationFilter = "",
        employmentTermFilter = "",
        employmentTypeFilter = "",
        positionCategoryFilter = "",
        experienceFilter = "",
        showOnPortalFilter = "",
        dateFilter = "",
      } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
        positionIdFilter?: string;
        titleFilter?: string;
        locationFilter?: string;
        employmentTermFilter?: string;
        employmentTypeFilter?: string;
        positionCategoryFilter?: string;
        experienceFilter?: string;
        showOnPortalFilter?: string;
        dateFilter?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Verify that the client exists
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, company_name, client_manager, accounting_person, sales_person")
        .eq("id", clientId)
        .single();

      if (clientError || !client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Build the base query with all necessary fields, filtered by client
      let baseQuery = supabase
        .from("positions")
        .select(`
          id,
          position_code, 
          position_number,
          title,
          start_date,
          end_date,
          employment_term,
          employment_type, 
          position_category,
          experience,
          show_on_job_portal,
          created_at,
          client_name,
          assigned_jobseekers,
          number_of_positions,
          payrate_type,
          regular_pay_rate,
          bill_rate,
          preferred_payment_method,
          terms,
          markup,
          overtime_enabled,
          overtime_hours,
          overtime_bill_rate,
          overtime_pay_rate
        `)
        .eq("client", clientId);

      // Apply additional filters at database level (excluding clientFilter since we're already filtering by client)
      baseQuery = applyPositionFilters(baseQuery, {
        search,
        positionIdFilter,
        titleFilter,
        locationFilter,
        employmentTermFilter,
        employmentTypeFilter,
        positionCategoryFilter,
        experienceFilter,
        showOnPortalFilter,
        dateFilter
      });

      // Get total count for this client (unfiltered)
      const { count: totalCount, error: countError } = await supabase
        .from("positions")
        .select("*", { count: "exact", head: true })
        .eq("client", clientId);

      if (countError) {
        console.error("Error getting total count:", countError);
        return res
          .status(500)
          .json({ error: "Failed to get total count of positions" });
      }

      // Get filtered count for this client
      let countQuery = supabase
        .from("positions")
        .select("*", { count: "exact", head: true })
        .eq("client", clientId);

      countQuery = applyPositionFilters(countQuery, {
        search,
        positionIdFilter,
        titleFilter,
        locationFilter,
        employmentTermFilter,
        employmentTypeFilter,
        positionCategoryFilter,
        experienceFilter,
        showOnPortalFilter,
        dateFilter
      });

      const { count: filteredCount, error: filteredCountError } = await countQuery;

      if (filteredCountError) {
        console.error("Error getting filtered count:", filteredCountError);
        return res
          .status(500)
          .json({ error: "Failed to get filtered count of positions" });
      }

      // Apply pagination and execute main query
      const { data: positions, error } = await baseQuery
        .range(offset, offset + limitNum - 1)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching client positions:", error);
        return res.status(500).json({ error: "Failed to fetch client positions" });
      }

      if (!positions || positions.length === 0) {
        return res.json({
          positions: [],
          client: {
            id: client.id,
            companyName: client.company_name,
            clientManager: client.client_manager,
            accountingPerson: client.accounting_person,
            salesPerson: client.sales_person
          },
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

      // Transform the response to include clientName and convert snake_case to camelCase
      const formattedPositions = await Promise.all(positions.map(async (position: any) => {
        // Since we're only selecting specific fields, handle the clients data properly
        const clientName = position.client_name || client.company_name;
        
        // Create a clean position object
        const positionData = { ...position };
        delete positionData.client_name;

        // Sync assigned_jobseekers with active assignments from position_candidate_assignments table
        const activeJobseekers = await syncAssignedJobseekers(position.id);
        
        // Update the position data with synced assignments if they differ
        if (JSON.stringify(position.assigned_jobseekers || []) !== JSON.stringify(activeJobseekers)) {
          await updatePositionAssignedJobseekers(position.id);
          positionData.assigned_jobseekers = activeJobseekers;
        }

        // Convert snake_case to camelCase
        const formattedPosition = Object.entries(positionData).reduce(
          (acc, [key, value]) => {
            const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
              letter.toUpperCase()
            );
            acc[camelKey] = value;
            return acc;
          },
          { clientName } as Record<string, any>
        );

        return formattedPosition;
      }));

      // Calculate pagination metadata
      const totalFiltered = filteredCount || 0;
      const totalPages = Math.ceil(totalFiltered / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      return res.json({
        positions: formattedPositions,
        client: {
          id: client.id,
          companyName: client.company_name,
          clientManager: client.client_manager,
          accountingPerson: client.accounting_person,
          salesPerson: client.sales_person
        },
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
      console.error("Unexpected error fetching client positions:", error);
      return res
        .status(500)
        .json({
          error: "An unexpected error occurred while fetching client positions",
        });
    }
  }
);

/**
 * Helper function to apply filters to a Supabase query
 */
function applyPositionFilters(query: any, filters: {
  search?: string;
  positionIdFilter?: string;
  titleFilter?: string;
  clientFilter?: string;
  locationFilter?: string;
  employmentTermFilter?: string;
  employmentTypeFilter?: string;
  positionCategoryFilter?: string;
  experienceFilter?: string;
  showOnPortalFilter?: string;
  dateFilter?: string;
}) {
  const {
    search,
    positionIdFilter,
    titleFilter,
    clientFilter,
    locationFilter,
    employmentTermFilter,
    employmentTypeFilter,
    positionCategoryFilter,
    experienceFilter,
    showOnPortalFilter,
    dateFilter
  } = filters;

  // Global search across multiple fields
  if (search && search.trim().length > 0) {
    const searchTerm = search.trim();
    query = query.or(`position_code.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,province.ilike.%${searchTerm}%,employment_term.ilike.%${searchTerm}%,employment_type.ilike.%${searchTerm}%,position_category.ilike.%${searchTerm}%,experience.ilike.%${searchTerm}%,client_name.ilike.%${searchTerm}%`);
  }

  // Individual column filters
  if (positionIdFilter && positionIdFilter.trim().length > 0) {
    query = query.ilike("position_code", `%${positionIdFilter.trim()}%`);
  }

  if (titleFilter && titleFilter.trim().length > 0) {
    query = query.ilike("title", `%${titleFilter.trim()}%`);
  }

  if (locationFilter && locationFilter.trim().length > 0) {
    const locationTerm = locationFilter.trim();
    query = query.or(`city.ilike.%${locationTerm}%,province.ilike.%${locationTerm}%`);
  }

  if (employmentTermFilter && employmentTermFilter !== "all") {
    query = query.eq("employment_term", employmentTermFilter);
  }

  if (employmentTypeFilter && employmentTypeFilter !== "all") {
    query = query.eq("employment_type", employmentTypeFilter);
  }

  if (positionCategoryFilter && positionCategoryFilter !== "all") {
    query = query.eq("position_category", positionCategoryFilter);
  }

  if (experienceFilter && experienceFilter !== "all") {
    query = query.eq("experience", experienceFilter);
  }

  if (showOnPortalFilter && showOnPortalFilter !== "all") {
    const showOnPortal = showOnPortalFilter === "true" || showOnPortalFilter === "Yes";
    query = query.eq("show_on_job_portal", showOnPortal);
  }

  if (dateFilter) {
    const filterDate = new Date(dateFilter);
    const nextDay = new Date(filterDate);
    nextDay.setDate(nextDay.getDate() + 1);
    query = query
      .gte("start_date", filterDate.toISOString().split("T")[0])
      .lt("start_date", nextDay.toISOString().split("T")[0]);
  }

  if (clientFilter && clientFilter.trim().length > 0) {
    query = query.ilike("client_name", `%${clientFilter.trim()}%`);
  }

  return query;
}

/**
 * Get position by ID
 * GET /api/positions/:id
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Get position from the database with client info
      const { data: position, error } = await supabase
        .from("positions")
        .select("*, clients(company_name)")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching position:", error);
        return res.status(404).json({ error: "Position not found" });
      }

      // Transform to include clientName
      const clientName = position.clients?.company_name || null;
      const { clients, ...positionData } = position;

      return res.status(200).json({
        ...positionData,
        clientName,
      });
    } catch (error) {
      console.error("Unexpected error fetching position:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

/**
 * Generate next position code for a client
 * GET /api/positions/generate-code/:clientId
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/generate-code/:clientId",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;

      // First, get the client's short code
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("short_code")
        .eq("id", clientId)
        .single();

      if (clientError || !client) {
        console.error("Error fetching client:", clientError);
        return res.status(404).json({ error: "Client not found" });
      }

      if (!client.short_code) {
        return res
          .status(400)
          .json({ error: "Client does not have a short code" });
      }

      // Use the database function to generate the next position code
      const { data: result, error: generateError } = await supabase.rpc(
        "generate_next_position_code",
        { client_short_code: client.short_code }
      );

      if (generateError) {
        console.error("Error generating position code:", generateError);
        return res
          .status(500)
          .json({ error: "Failed to generate position code" });
      }

      return res.status(200).json({
        positionCode: result,
        clientShortCode: client.short_code,
      });
    } catch (error) {
      console.error("Unexpected error generating position code:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

/**
 * Create a new position
 * POST /api/positions
 * @access Private (Admin, Recruiter)
 */
router.post(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sanitizeInputs,
  activityLogger({
    onSuccess: (req, res) => ({
      actionType: 'create_position',
      actionVerb: 'created',
      primaryEntityType: 'position',
      primaryEntityId: res.locals.newPosition?.id,
      primaryEntityName: req.body.title,
      secondaryEntityType: 'client',
      secondaryEntityId: req.body.client,
      secondaryEntityName: res.locals.clientName,
      displayMessage: `Created position "${req.body.title}" for client "${res.locals.clientName}"`,
      category: 'position_management',
      priority: 'normal',
      metadata: {
        positionCode: res.locals.newPosition?.position_code,
        startDate: req.body.startDate,
        employmentTerm: req.body.employmentTerm,
        employmentType: req.body.employmentType,
        numberOfPositions: req.body.numberOfPositions,
        regularPayRate: req.body.regularPayRate,
        billRate: req.body.billRate,
        location: `${req.body.city}, ${req.body.province}`
      }
    })
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.id;
      const positionData: PositionData = req.body;

      // Create a clean copy without clientName and with fixed date fields
      const cleanedData: PositionData = { ...positionData };

      // Remove clientName property if it exists
      if ((cleanedData as any).clientName !== undefined) {
        delete (cleanedData as any).clientName;
      }

      // Handle empty date fields
      if (cleanedData.startDate === "") cleanedData.startDate = undefined;
      if (cleanedData.endDate === "") cleanedData.endDate = undefined;
      if (cleanedData.projCompDate === "") cleanedData.projCompDate = undefined;

      // Validate date values
      if (cleanedData.startDate) {
        const startDate = new Date(cleanedData.startDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time part

        if (startDate < today) {
          return res.status(400).json({
            error: "Start date must be today or in the future",
            field: "startDate",
          });
        }

        // If endDate is provided, validate it's after startDate
        if (cleanedData.endDate) {
          const endDate = new Date(cleanedData.endDate);
          if (endDate <= startDate) {
            return res.status(400).json({
              error: "End date must be after start date",
              field: "endDate",
            });
          }
        }
      }

      // Ensure numberOfPositions is a number
      if (cleanedData.numberOfPositions !== undefined) {
        cleanedData.numberOfPositions = Number(cleanedData.numberOfPositions);
      }

      // Validate required fields
      const requiredFields = [
        "client",
        "title",
        "startDate",
        "description",
        "streetAddress",
        "city",
        "province",
        "postalCode",
        "employmentTerm",
        "employmentType",
        "positionCategory",
        "experience",
        "payrateType",
        "numberOfPositions",
        "regularPayRate",
        "billRate",
        "preferredPaymentMethod",
        "terms",
        "notes",
      ];

      for (const field of requiredFields) {
        if (!cleanedData[field as keyof PositionData]) {
          return res
            .status(400)
            .json({ error: `Missing required field: ${field}` });
        }
      }

      // Check if client exists
      const { data: client, error: clientCheckError } = await supabase
        .from("clients")
        .select("id, company_name")
        .eq("id", cleanedData.client)
        .maybeSingle();

      if (clientCheckError || !client) {
        console.error("Error checking client:", clientCheckError);
        return res.status(404).json({ error: "Client not found" });
      }

      // Store client name for activity logging
      res.locals.clientName = client.company_name;

      // Validate documents required - at least one must be selected
      const documentsRequired = cleanedData.documentsRequired || {};
      const hasAtLeastOneDoc = Object.values(documentsRequired).some(
        (v) => v === true
      );

      if (!hasAtLeastOneDoc) {
        return res.status(400).json({
          error: "At least one document must be required",
          field: "documentsRequired",
        });
      }

      // Prepare position data for database
      // Convert camelCase keys to snake_case using the helper function
      const dbPositionData: Record<string, any> = {};

      // Process each key-value pair
      Object.entries(cleanedData).forEach(([key, value]) => {
        // Convert camelCase to snake_case
        const snakeKey = camelToSnakeCase(key);
        dbPositionData[snakeKey] = value;
      });

      // Add meta fields
      dbPositionData.is_draft = false;
      dbPositionData.created_by_user_id = userId;
      dbPositionData.updated_by_user_id = userId;
      
      // Add client_name to the database data
      dbPositionData.client_name = client.company_name;

      // Insert position into database
      const { data: newPosition, error: insertError } = await supabase
        .from("positions")
        .insert([dbPositionData])
        .select()
        .single();

      if (insertError) {
        console.error("Error creating position:", insertError);
        return res.status(500).json({ error: "Failed to create position" });
      }

      // Store new position for activity logging
      res.locals.newPosition = newPosition;

      return res.status(201).json({
        success: true,
        message: "Position created successfully",
        position: newPosition,
      });
    } catch (error) {
      console.error("Unexpected error creating position:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

/**
 * Update an existing position
 * PUT /api/positions/:id
 * @access Private (Admin, Recruiter)
 */
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sanitizeInputs,
  activityLogger({
    onSuccess: (req, res) => ({
      actionType: 'update_position',
      actionVerb: 'updated',
      primaryEntityType: 'position',
      primaryEntityId: req.params.id,
      primaryEntityName: req.body.title,
      secondaryEntityType: 'client',
      secondaryEntityId: req.body.client,
      secondaryEntityName: res.locals.clientName,
      displayMessage: `Updated position "${req.body.title}" for client "${res.locals.clientName}"`,
      category: 'position_management',
      priority: 'normal',
      metadata: {
        positionCode: res.locals.updatedPosition?.position_code,
        startDate: req.body.startDate,
        employmentTerm: req.body.employmentTerm,
        employmentType: req.body.employmentType,
        numberOfPositions: req.body.numberOfPositions,
        regularPayRate: req.body.regularPayRate,
        billRate: req.body.billRate,
        location: `${req.body.city}, ${req.body.province}`,
        updatedFields: Object.keys(req.body).filter(key => key !== 'clientName')
      }
    })
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.id;
      const { id } = req.params;
      const positionData: PositionData = req.body;

      // Create a clean copy without clientName and with fixed date fields
      const cleanedData: PositionData = { ...positionData };

      // Remove clientName property if it exists
      if ((cleanedData as any).clientName !== undefined) {
        delete (cleanedData as any).clientName;
      }

      // Handle empty date fields
      if (cleanedData.startDate === "") cleanedData.startDate = undefined;
      if (cleanedData.endDate === "") cleanedData.endDate = undefined;
      if (cleanedData.projCompDate === "") cleanedData.projCompDate = undefined;

      // Validate dates only for non-draft positions
      if (!cleanedData.isDraft) {
        // For existing positions, we need to validate differently since they might have past start dates
        if (cleanedData.startDate) {
          const startDate = new Date(cleanedData.startDate);

          // If endDate is provided, validate it's after startDate
          if (cleanedData.endDate) {
            const endDate = new Date(cleanedData.endDate);
            if (endDate <= startDate) {
              return res.status(400).json({
                error: "End date must be after start date",
                field: "endDate",
              });
            }
          }
        }
      }

      // Ensure numberOfPositions is a number
      if (cleanedData.numberOfPositions !== undefined) {
        cleanedData.numberOfPositions = Number(cleanedData.numberOfPositions);
      }

      // Check if position exists
      const { data: existingPosition, error: positionCheckError } =
        await supabase
          .from("positions")
          .select("id")
          .eq("id", id)
          .maybeSingle();

      if (positionCheckError || !existingPosition) {
        return res.status(404).json({ error: "Position not found" });
      }

      // Validate required fields
      const requiredFields = [
        "client",
        "title",
        "startDate",
        "description",
        "streetAddress",
        "city",
        "province",
        "postalCode",
        "employmentTerm",
        "employmentType",
        "positionCategory",
        "experience",
        "payrateType",
        "numberOfPositions",
        "regularPayRate",
        "billRate",
        "preferredPaymentMethod",
        "terms",
        "notes",
      ];

      for (const field of requiredFields) {
        if (!cleanedData[field as keyof PositionData]) {
          return res
            .status(400)
            .json({ error: `Missing required field: ${field}` });
        }
      }

      // Check if client exists
      const { data: client, error: clientCheckError } = await supabase
        .from("clients")
        .select("id, company_name")
        .eq("id", cleanedData.client)
        .maybeSingle();

      if (clientCheckError || !client) {
        console.error("Error checking client:", clientCheckError);
        return res.status(404).json({ error: "Client not found" });
      }

      // Store client name for activity logging
      res.locals.clientName = client.company_name;

      // Validate documents required - at least one must be selected
      const documentsRequired = cleanedData.documentsRequired || {};
      const hasAtLeastOneDoc = Object.values(documentsRequired).some(
        (v) => v === true
      );

      if (!hasAtLeastOneDoc) {
        return res.status(400).json({
          error: "At least one document must be required",
          field: "documentsRequired",
        });
      }

      // Prepare position data for database
      // Convert camelCase keys to snake_case using the helper function
      const dbPositionData: Record<string, any> = {};

      // Process each key-value pair
      Object.entries(cleanedData).forEach(([key, value]) => {
        // Convert camelCase to snake_case
        const snakeKey = camelToSnakeCase(key);
        dbPositionData[snakeKey] = value;
      });

      // Add meta fields
      dbPositionData.is_draft = false;
      dbPositionData.updated_by_user_id = userId;
      dbPositionData.updated_at = new Date().toISOString();
      
      // Add client_name to the database data
      dbPositionData.client_name = client.company_name;

      // Update position in database
      const { data: updatedPosition, error: updateError } = await supabase
        .from("positions")
        .update(dbPositionData)
        .eq("id", id)
        .select(`
          id,
          client,
          client_name,
          title,
          position_code,
          start_date,
          end_date,
          show_on_job_portal,
          client_manager,
          sales_manager,
          position_number,
          description,
          street_address,
          city,
          province,
          postal_code,
          employment_term,
          employment_type,
          position_category,
          experience,
          documents_required,
          payrate_type,
          number_of_positions,
          regular_pay_rate,
          markup,
          bill_rate,
          overtime_enabled,
          overtime_hours,
          overtime_bill_rate,
          overtime_pay_rate,
          preferred_payment_method,
          terms,
          notes,
          assigned_to,
          proj_comp_date,
          task_time,
          assigned_jobseekers,
          is_draft,
          created_at,
          updated_at,
          created_by_user_id,
          updated_by_user_id
        `)
        .single();

      if (updateError) {
        console.error("Error updating position:", updateError);
        // Assignment was already deleted, but position update failed
        // This creates an inconsistent state, but we cannot easily rollback the deletion
        console.error("Warning: Assignment was deleted but position update failed. Manual intervention may be required.");
        return res.status(500).json({ error: "Failed to remove candidate" });
      }

      // Store updated position for activity logging
      res.locals.updatedPosition = updatedPosition;

      return res.status(200).json({
        success: true,
        message: "Position updated successfully",
        position: updatedPosition,
      });
    } catch (error) {
      console.error("Unexpected error updating position:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);


/**
 * Delete a position
 * DELETE /api/positions/:id
 * @access Private (Admin, Recruiter)
 */
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  activityLogger({
    onSuccess: (req, res) => ({
      actionType: 'delete_position',
      actionVerb: 'deleted',
      primaryEntityType: 'position',
      primaryEntityId: req.params.id,
      primaryEntityName: res.locals.deletedPosition?.title || `Position ID: ${req.params.id}`,
      secondaryEntityType: 'client',
      secondaryEntityId: res.locals.deletedPosition?.client,
      secondaryEntityName: res.locals.deletedPosition?.client_name,
      displayMessage: `Deleted position "${res.locals.deletedPosition?.title || req.params.id}"`,
      category: 'position_management',
      priority: 'high',
      metadata: {
        positionCode: res.locals.deletedPosition?.position_code,
        clientName: res.locals.deletedPosition?.client_name,
        startDate: res.locals.deletedPosition?.start_date,
        employmentTerm: res.locals.deletedPosition?.employment_term,
        employmentType: res.locals.deletedPosition?.employment_type,
        numberOfPositions: res.locals.deletedPosition?.number_of_positions,
        location: res.locals.deletedPosition ? 
          `${res.locals.deletedPosition.city}, ${res.locals.deletedPosition.province}` : null
      }
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if position exists and get position data for logging
      const { data: existingPosition, error: positionCheckError } =
        await supabase
          .from("positions")
          .select("*")
          .eq("id", id)
          .maybeSingle();

      if (positionCheckError || !existingPosition) {
        return res.status(404).json({ error: "Position not found" });
      }

      // Store position data for activity logging
      res.locals.deletedPosition = existingPosition;

      // Delete position
      const { error: deleteError } = await supabase
        .from("positions")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("Error deleting position:", deleteError);
        return res.status(500).json({ error: "Failed to delete position" });
      }

      return res.status(200).json({
        success: true,
        message: "Position deleted successfully",
        deletedId: id,
      });
    } catch (error) {
      console.error("Unexpected error deleting position:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

/**
 * Assign candidate to position
 * POST /api/positions/:id/assign
 * @access Private (Admin, Recruiter)
 */
router.post(
  "/:id/assign",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sanitizeInputs,
  activityLogger({
    onSuccess: (req, res) => ({
      actionType: 'assign_jobseeker',
      actionVerb: 'assigned',
      primaryEntityType: 'jobseeker',
      primaryEntityId: req.body.candidateId,
      primaryEntityName: res.locals.candidateName || `Candidate ID: ${req.body.candidateId}`,
      secondaryEntityType: 'position',
      secondaryEntityId: req.params.id,
      secondaryEntityName: res.locals.positionTitle,
      tertiaryEntityType: 'client',
      tertiaryEntityId: res.locals.clientId,
      tertiaryEntityName: res.locals.clientName,
      displayMessage: `Assigned candidate "${res.locals.candidateName || req.body.candidateId}" to position "${res.locals.positionTitle}"`,
      category: 'position_management',
      priority: 'normal',
      status: 'active',
      metadata: {
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        assignmentId: res.locals.newAssignment?.id,
        positionCode: res.locals.positionCode,
        totalAssignedCandidates: res.locals.totalAssigned
      }
    })
  }),
  emailNotifier({
    onSuccessEmail: async (req: Request, res: Response) => {
      const candidateName = res.locals.candidateName;
      const candidateId = req.body.candidateId;
      let candidateEmail = res.locals.candidateEmail;
      // Fetch candidate email if not present
      if (!candidateEmail && candidateId) {
        const { data: candidateProfile } = await supabase
          .from("jobseeker_profiles")
          .select("email, first_name, last_name")
          .eq("user_id", candidateId)
          .maybeSingle();
        if (candidateProfile) {
          candidateEmail = candidateProfile.email;
        }
      }
      if (!candidateEmail) return null;
      // Prepare variables for template
      const templateVars = {
        jobseeker_first_name: candidateName?.split(' ')[0] || 'Candidate',
        title: res.locals.position?.title || '',
        city: res.locals.position?.city || '',
        province: res.locals.position?.province || '',
        employment_type: res.locals.position?.employment_type || '',
        employment_term: res.locals.position?.employment_term || '',
        start_date: res.locals.position?.start_date || '',
        end_date: res.locals.position?.end_date || '',
        position_category: res.locals.position?.position_category || '',
        experience: res.locals.position?.experience || '',
      };
      console.log('[EmailNotifier] templateVars:', templateVars);
      // Use template functions
      const html = jobseekerAssignmentHtmlTemplate(templateVars);
      console.log('[EmailNotifier] Generated HTML:', html);
      const text = jobseekerAssignmentTextTemplate(templateVars);
      // Extract subject (first line from text template)
      const [subjectLine, ...bodyLines] = text.split('\n');
      const subject = subjectLine.replace('Subject:', '').trim();
      return {
        to: candidateEmail,
        subject,
        text: bodyLines.join('\n').trim(),
        html,
      };
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const { id: positionId } = req.params;
      const { candidateId, startDate, endDate } = req.body;
      const userId = req.user?.id;

      if (!candidateId) {
        return res.status(400).json({ error: "Candidate ID is required" });
      }

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get current position data
      const { data: position, error: positionError } = await supabase
        .from("positions")
        .select(`
          id,
          client,
          title,
          position_code,
          start_date,
          end_date,
          city,
          province,
          employment_term,
          employment_type,
          position_category,
          experience,
          assigned_jobseekers,
          number_of_positions
        `)
        .eq("id", positionId)
        .single();

      if (positionError || !position) {
        return res.status(404).json({ error: "Position not found" });
      }

      // Set full position object for email templates
      res.locals.position = position;

      // Store position data for activity logging
      res.locals.positionTitle = position.title;
      res.locals.positionCode = position.position_code;
      res.locals.clientId = position.client;
      // No assignment to res.locals.clientName here
      // No usage of position.client_name or position.number_of_positions in this route

      // Get candidate name for activity logging
      const { data: candidateDetails, error: candidateNameError } = await supabase
        .from("jobseeker_profiles")
        .select("first_name, last_name")
        .eq("user_id", candidateId)
        .maybeSingle();

      if (candidateDetails) {
        res.locals.candidateName = `${candidateDetails.first_name} ${candidateDetails.last_name}`;
      }

      // Check if candidate exists and get candidate name
      const { data: candidate, error: candidateError } = await supabase
        .from("jobseeker_profiles")
        .select("id, first_name, last_name")
        .eq("user_id", candidateId)
        .single();

      if (candidateError || !candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      // Store candidate name for activity logging
      res.locals.candidateName = `${candidate.first_name} ${candidate.last_name}`;

      // Check if there's already an active assignment for this position-candidate pair
      const { data: existingAssignment, error: assignmentCheckError } = await supabase
        .from("position_candidate_assignments")
        .select("id, status")
        .eq("position_id", positionId)
        .eq("candidate_id", candidateId)
        .eq("status", "active")
        .maybeSingle();

      if (assignmentCheckError) {
        console.error("Error checking existing assignment:", assignmentCheckError);
        return res.status(500).json({ error: "Failed to check existing assignment" });
      }

      if (existingAssignment) {
        return res.status(400).json({ error: "Candidate already assigned to this position" });
      }

      // Get current active assignments for this position
      const { data: activeAssignments, error: activeAssignmentsError } = await supabase
        .from("position_candidate_assignments")
        .select("candidate_id")
        .eq("position_id", positionId)
        .eq("status", "active");

      if (activeAssignmentsError) {
        console.error("Error getting active assignments:", activeAssignmentsError);
        return res.status(500).json({ error: "Failed to check position capacity" });
      }

      // Check if position has available slots
      if (activeAssignments && activeAssignments.length >= position.number_of_positions) {
        return res.status(400).json({ error: "No available positions to assign" });
      }

      // Create assignment record
      const { data: newAssignment, error: assignmentError } = await supabase
        .from("position_candidate_assignments")
        .insert({
          position_id: positionId,
          candidate_id: candidateId,
          start_date: startDate,
          end_date: endDate,
          status: "active",
          created_by_user_id: userId,
          updated_by_user_id: userId
        })
        .select()
        .single();

      if (assignmentError) {
        console.error("Error creating assignment:", assignmentError);
        return res.status(500).json({ error: "Failed to create assignment" });
      }

      // Store assignment for activity logging
      res.locals.newAssignment = newAssignment;

      // Update the assigned_jobseekers array in positions table for backward compatibility
      const currentAssigned = position.assigned_jobseekers || [];
      const updatedAssigned = [...currentAssigned, candidateId];

      // Store total assigned count for activity logging
      res.locals.totalAssigned = updatedAssigned.length;

      const { data: updatedPosition, error: updateError } = await supabase
        .from("positions")
        .update({ assigned_jobseekers: updatedAssigned })
        .eq("id", positionId)
        .select(`
          id,
          client,
          title,
          position_code,
          start_date,
          end_date,
          show_on_job_portal,
          client_manager,
          sales_manager,
          position_number,
          description,
          street_address,
          city,
          province,
          postal_code,
          employment_term,
          employment_type,
          position_category,
          experience,
          documents_required,
          payrate_type,
          number_of_positions,
          regular_pay_rate,
          markup,
          bill_rate,
          overtime_enabled,
          overtime_hours,
          overtime_bill_rate,
          overtime_pay_rate,
          preferred_payment_method,
          terms,
          notes,
          assigned_to,
          proj_comp_date,
          task_time,
          assigned_jobseekers,
          is_draft,
          created_at,
          updated_at,
          created_by_user_id,
          updated_by_user_id
        `)
        .single();

      if (updateError) {
        console.error("Error updating position:", updateError);
        // Assignment was already deleted, but position update failed
        // This creates an inconsistent state, but we cannot easily rollback the deletion
        console.error("Warning: Assignment was deleted but position update failed. Manual intervention may be required.");
        return res.status(500).json({ error: "Failed to remove candidate" });
      }

      return res.status(200).json({
        success: true,
        message: "Candidate assigned successfully",
        assignedJobseekers: updatedAssigned,
        position: updatedPosition,
        assignment: newAssignment
      });
    } catch (error) {
      console.error("Unexpected error assigning candidate:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

/**
 * Remove candidate from position
 * DELETE /api/positions/:id/assign/:candidateId
 * @access Private (Admin, Recruiter)
 */
router.delete(
  "/:id/assign/:candidateId",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  activityLogger({
    onSuccess: (req, res) => ({
      actionType: 'remove_jobseeker',
      actionVerb: 'removed',
      primaryEntityType: 'jobseeker',
      primaryEntityId: req.params.candidateId,
      primaryEntityName: res.locals.candidateName,
      secondaryEntityType: 'position',
      secondaryEntityId: req.params.id,
      secondaryEntityName: res.locals.positionTitle,
      tertiaryEntityType: 'client',
      tertiaryEntityId: res.locals.clientId,
      tertiaryEntityName: res.locals.clientName,
      displayMessage: `Removed candidate \"${res.locals.candidateName}\" from position \"${res.locals.positionTitle}\"`,
      category: 'position_management',
      priority: 'normal',
      status: 'removed',
      metadata: {
        removedAssignmentId: res.locals.removedAssignmentId,
        positionCode: res.locals.positionCode,
        remainingAssigned: res.locals.remainingAssigned
      }
    })
  }),
  emailNotifier({
    onSuccessEmail: async (req: Request, res: Response) => {
      const candidateName = res.locals.candidateName;
      const candidateId = req.params.candidateId;
      let candidateEmail = res.locals.candidateEmail;
      // Fetch candidate email if not present
      if (!candidateEmail && candidateId) {
        const { data: candidateProfile } = await supabase
          .from("jobseeker_profiles")
          .select("email, first_name, last_name")
          .eq("user_id", candidateId)
          .maybeSingle();
        if (candidateProfile) {
          candidateEmail = candidateProfile.email;
        }
      }
      if (!candidateEmail) return null;
      // Prepare variables for template
      const templateVars = {
        jobseeker_first_name: candidateName?.split(' ')[0] || 'Candidate',
        title: res.locals.position?.title || '',
        city: res.locals.position?.city || '',
        province: res.locals.position?.province || '',
        employment_type: res.locals.position?.employment_type || '',
        employment_term: res.locals.position?.employment_term || '',
        start_date: res.locals.position?.start_date || '',
        end_date: res.locals.position?.end_date || '',
        position_category: res.locals.position?.position_category || '',
        experience: res.locals.position?.experience || '',
        number_of_positions: res.locals.position?.number_of_positions || '',
      };
      console.log('[EmailNotifier] templateVars (removal):', templateVars);
      const html = jobseekerRemovalHtmlTemplate(templateVars);
      console.log('[EmailNotifier] Generated HTML (removal):', html);
      const text = jobseekerRemovalTextTemplate(templateVars);
      // Extract subject (first line from text template)
      const [subjectLine, ...bodyLines] = text.split('\n');
      const subject = subjectLine.replace('Subject:', '').trim();
      return {
        to: candidateEmail,
        subject,
        text: bodyLines.join('\n').trim(),
        html,
      };
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const { id: positionId, candidateId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get current position data with client info
      const { data: position, error: positionError } = await supabase
        .from("positions")
        .select(`
          id,
          client,
          title,
          position_code,
          start_date,
          end_date,
          city,
          province,
          employment_term,
          employment_type,
          position_category,
          experience,
          assigned_jobseekers
        `)
        .eq("id", positionId)
        .single();

      if (positionError || !position) {
        return res.status(404).json({ error: "Position not found" });
      }

      // Set full position object for email templates
      res.locals.position = position;

      // Store position data for activity logging
      res.locals.positionTitle = position.title;
      res.locals.positionCode = position.position_code;
      res.locals.clientId = position.client;
      // No assignment to res.locals.clientName here
      // No usage of position.client_name or position.number_of_positions in this route

      // Get candidate info
      const { data: candidate, error: candidateError } = await supabase
        .from("jobseeker_profiles")
        .select("first_name, last_name")
        .eq("user_id", candidateId)
        .single();

      if (candidateError || !candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      // Get client info
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, company_name")
        .eq("id", position.client)
        .single();

      // Store data for activity logger
      const candidateName = `${candidate.first_name} ${candidate.last_name}`.trim();
      res.locals.candidateName = candidateName;
      res.locals.positionTitle = position.title;
      res.locals.positionCode = position.position_code;
      res.locals.clientId = client?.id || null;
      // No assignment to res.locals.clientName here
      // No usage of position.client_name or position.number_of_positions in this route

      // Check if there's an active assignment for this position-candidate pair
      const { data: activeAssignment, error: assignmentCheckError } = await supabase
        .from("position_candidate_assignments")
        .select("id")
        .eq("position_id", positionId)
        .eq("candidate_id", candidateId)
        .maybeSingle();

      if (assignmentCheckError) {
        console.error("Error checking assignment:", assignmentCheckError);
        return res.status(500).json({ error: "Failed to check assignment" });
      }

      if (!activeAssignment) {
        return res.status(400).json({ error: "Candidate not assigned to this position" });
      }

      // Store assignment ID for activity logger
      res.locals.removedAssignmentId = activeAssignment.id;

      // Delete the assignment row completely
      const { error: deleteAssignmentError } = await supabase
        .from("position_candidate_assignments")
        .delete()
        .eq("id", activeAssignment.id);

      if (deleteAssignmentError) {
        console.error("Error deleting assignment:", deleteAssignmentError);
        return res.status(500).json({ error: "Failed to remove assignment" });
      }

      // Update the assigned_jobseekers array in positions table for backward compatibility
      const currentAssigned = position.assigned_jobseekers || [];
      const updatedAssigned = currentAssigned.filter((id: string) => id !== candidateId);

      // Store remaining assigned count for activity logger
      res.locals.remainingAssigned = updatedAssigned.length;

      const { data: updatedPosition, error: updateError } = await supabase
        .from("positions")
        .update({ assigned_jobseekers: updatedAssigned })
        .eq("id", positionId)
        .select(`
          id,
          client,
          title,
          position_code,
          start_date,
          end_date,
          show_on_job_portal,
          client_manager,
          sales_manager,
          position_number,
          description,
          street_address,
          city,
          province,
          postal_code,
          employment_term,
          employment_type,
          position_category,
          experience,
          documents_required,
          payrate_type,
          number_of_positions,
          regular_pay_rate,
          markup,
          bill_rate,
          overtime_enabled,
          overtime_hours,
          overtime_bill_rate,
          overtime_pay_rate,
          preferred_payment_method,
          terms,
          notes,
          assigned_to,
          proj_comp_date,
          task_time,
          assigned_jobseekers,
          is_draft,
          created_at,
          updated_at,
          created_by_user_id,
          updated_by_user_id
        `)
        .single();

      if (updateError) {
        console.error("Error updating position:", updateError);
        // Assignment was already deleted, but position update failed
        // This creates an inconsistent state, but we cannot easily rollback the deletion
        console.error("Warning: Assignment was deleted but position update failed. Manual intervention may be required.");
        return res.status(500).json({ error: "Failed to remove candidate" });
      }

      return res.status(200).json({
        success: true,
        message: "Candidate removed successfully",
        assignedJobseekers: updatedAssigned,
        position: updatedPosition
      });
    } catch (error) {
      console.error("Unexpected error removing candidate:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

/**
 * Get position assignments
 * GET /api/positions/:id/assignments
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/:id/assignments",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { id: positionId } = req.params;

      // Get all assignments for this position with jobseeker profile data
      const { data: assignments, error } = await supabase
        .from("position_candidate_assignments")
        .select(`
          id,
          candidate_id,
          start_date,
          end_date,
          status,
          created_at,
          updated_at
        `)
        .eq("position_id", positionId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching assignments:", error);
        return res.status(500).json({ error: "Failed to fetch assignments" });
      }

      // If no assignments, return empty array
      if (!assignments || assignments.length === 0) {
        return res.status(200).json({
          success: true,
          assignments: []
        });
      }

      // Get candidate IDs to fetch jobseeker profiles
      const candidateIds = assignments.map(assignment => assignment.candidate_id);

      // Fetch jobseeker profiles for all candidates
      const { data: jobseekerProfiles, error: profilesError } = await supabase
        .from("jobseeker_profiles")
        .select("id, user_id, first_name, last_name, email, mobile, employee_id")
        .in("user_id", candidateIds);

      if (profilesError) {
        console.error("Error fetching jobseeker profiles:", profilesError);
        return res.status(500).json({ error: "Failed to fetch candidate profiles" });
      }

      // Create a map for quick lookup
      const profilesMap = new Map();
      if (jobseekerProfiles) {
        jobseekerProfiles.forEach(profile => {
          profilesMap.set(profile.user_id, profile);
        });
      }

      // Combine assignments with jobseeker profile data
      const enrichedAssignments = assignments.map(assignment => {
        const profile = profilesMap.get(assignment.candidate_id);
        return {
          ...assignment,
          jobseekerProfile: profile ? {
            ...profile,
            jobseeker_profile_id: profile.id,
            employee_id: profile.employee_id
          } : null
        };
      });

      return res.status(200).json({
        success: true,
        assignments: enrichedAssignments
      });
    } catch (error) {
      console.error("Unexpected error fetching assignments:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

/**
 * Get all position assignments for a specific candidate with advanced filtering
 * GET /api/positions/candidate/:candidateId/assignments
 * @access Private (Admin, Recruiter, JobSeeker - limited access for jobseekers)
 */
router.get(
  "/candidate/:candidateId/assignments",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  async (req: Request, res: Response) => {
    try {
      const { candidateId } = req.params;
      const {
        page = "1",
        limit = "10",
        status = "",
        startDate = "",
        endDate = "",
        search = "",
        employmentType = "",
        positionCategory = "",
      } = req.query as {
        page?: string;
        limit?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
        search?: string;
        employmentType?: string;
        positionCategory?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Check if user is NOT a jobseeker (admin or recruiter) to include compensation details
      const isJobseeker = req.user?.user_metadata?.user_type === 'jobseeker';
      const includeCompensation = !isJobseeker;

      // Verify candidate exists and get basic info
      const { data: candidate, error: candidateError } = await supabase
        .from("jobseeker_profiles")
        .select("id, first_name, last_name, email")
        .eq("user_id", candidateId)
        .single();

      if (candidateError || !candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      // Get compensation data if user is authorized
      let compensationData = null;
      if (includeCompensation) {
        const { data: compData, error: compError } = await supabase
          .from("jobseeker_profiles")
          .select("payrate_type, bill_rate, pay_rate, payment_method, hst_gst, cash_deduction, overtime_enabled, overtime_hours, overtime_bill_rate, overtime_pay_rate")
          .eq("user_id", candidateId)
          .single();

        if (!compError && compData) {
          compensationData = compData;
        }
      }

      // Get status counts for this candidate
      const { data: statusCounts, error: statusCountError } = await supabase
        .from("position_candidate_assignments")
        .select("status")
        .eq("candidate_id", candidateId);

      if (statusCountError) {
        console.error("Error getting status counts:", statusCountError);
        return res.status(500).json({ error: "Failed to get status counts" });
      }

      // Calculate status counts
      const counts = {
        active: 0,
        completed: 0,
        upcoming: 0,
        total: statusCounts?.length || 0
      };

      if (statusCounts) {
        statusCounts.forEach((assignment: any) => {
          if (assignment.status === 'active') {
            counts.active++;
          } else if (assignment.status === 'completed') {
            counts.completed++;
          } else if (assignment.status === 'upcoming') {
            counts.upcoming++;
          }
        });
      }

      // Build the base query for assignments with position details
      let baseQuery = supabase
        .from("position_candidate_assignments")
        .select(`
          id,
          position_id,
          candidate_id,
          start_date,
          end_date,
          status,
          created_at,
          updated_at,
          positions:position_id (
            id,
            position_code,
            title,
            client_name,
            city,
            province,
            employment_term,
            employment_type,
            position_category,
            experience,
            show_on_job_portal,
            start_date,
            end_date,
            payrate_type,
            number_of_positions,
            regular_pay_rate,
            bill_rate,
            preferred_payment_method,
            terms,
            markup,
            overtime_enabled,
            overtime_hours,
            overtime_bill_rate,
            overtime_pay_rate
          )
        `)
        .eq("candidate_id", candidateId);

      // Apply assignment-level filters
      if (status && status !== "all") {
        baseQuery = baseQuery.eq("status", status);
      }

      if (startDate) {
        baseQuery = baseQuery.gte("start_date", startDate);
      }

      if (endDate) {
        baseQuery = baseQuery.lte("end_date", endDate);
      }

      // Get total count for pagination (before position filters)
      let countQuery = supabase
        .from("position_candidate_assignments")
        .select("*", { count: "exact", head: true })
        .eq("candidate_id", candidateId);

      // Apply same assignment-level filters to count query
      if (status && status !== "all") {
        countQuery = countQuery.eq("status", status);
      }

      if (startDate) {
        countQuery = countQuery.gte("start_date", startDate);
      }

      if (endDate) {
        countQuery = countQuery.lte("end_date", endDate);
      }

      const { count: totalCount, error: countError } = await countQuery;

      if (countError) {
        console.error("Error getting assignment count:", countError);
        return res.status(500).json({ error: "Failed to get assignment count" });
      }

      // Execute main query with pagination
      const { data: assignments, error } = await baseQuery
        .range(offset, offset + limitNum - 1)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching candidate assignments:", error);
        return res.status(500).json({ error: "Failed to fetch assignments" });
      }

      if (!assignments || assignments.length === 0) {
        return res.json({
          candidate: {
            id: candidate.id,
            firstName: candidate.first_name,
            lastName: candidate.last_name,
            email: candidate.email
          },
          assignments: [],
          statusCounts: counts,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount || 0,
            totalPages: Math.ceil((totalCount || 0) / limitNum),
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }

      // Transform the response to match frontend expectations
      let formattedAssignments = assignments.map((assignment: any) => {
        const position = assignment.positions;
        
        // Convert assignment fields from snake_case to camelCase
        const formattedAssignment = {
          id: assignment.id,
          positionId: assignment.position_id,
          candidateId: assignment.candidate_id,
          startDate: assignment.start_date,
          endDate: assignment.end_date,
          status: assignment.status,
          createdAt: assignment.created_at,
          updatedAt: assignment.updated_at,
          position: position ? {
            id: position.id,
            positionCode: position.position_code,
            title: position.title,
            clientName: position.client_name,
            city: position.city,
            province: position.province,
            employmentTerm: position.employment_term,
            employmentType: position.employment_type,
            positionCategory: position.position_category,
            experience: position.experience,
            showOnJobPortal: position.show_on_job_portal,
            startDate: position.start_date,
            endDate: position.end_date,
            regularPayRate: position.regular_pay_rate,
            billRate: position.bill_rate,
            numberOfPositions: position.number_of_positions,
            markup: position.markup,
            overtimeEnabled: position.overtime_enabled,
            overtimeHours: position.overtime_hours,
            overtimeBillRate: position.overtime_bill_rate,
            overtimePayRate: position.overtime_pay_rate
          } : null
        };

        return formattedAssignment;
      });

      // Apply position-level filters (client-side on server for now since we need to join data)
      if (search && search.trim()) {
        const searchTerm = search.trim().toLowerCase();
        formattedAssignments = formattedAssignments.filter(assignment => {
          const pos = assignment.position;
          if (!pos) return false;
          
          return (
            pos.title?.toLowerCase().includes(searchTerm) ||
            pos.clientName?.toLowerCase().includes(searchTerm) ||
            pos.city?.toLowerCase().includes(searchTerm) ||
            pos.province?.toLowerCase().includes(searchTerm) ||
            pos.positionCode?.toLowerCase().includes(searchTerm)
          );
        });
      }

      if (employmentType && employmentType !== "all") {
        formattedAssignments = formattedAssignments.filter(assignment => {
          const pos = assignment.position;
          if (!pos) return false;

          if (employmentType === "Full-Time") return pos.employmentType === "Full-time";
          if (employmentType === "Part-Time") return pos.employmentType === "Part-time";
          if (employmentType === "Contract") return pos.employmentTerm === "Contract";
          return true;
        });
      }

      if (positionCategory && positionCategory !== "all") {
        formattedAssignments = formattedAssignments.filter(assignment => {
          const pos = assignment.position;
          if (!pos) return false;

          if (positionCategory === "AZ") return pos.positionCategory === "Driver" && pos.title?.includes("AZ");
          if (positionCategory === "DZ") return pos.positionCategory === "Driver" && pos.title?.includes("DZ");
          if (positionCategory === "Admin") return pos.positionCategory === "Office";
          if (positionCategory === "General Labour") return pos.positionCategory === "Other";
          if (positionCategory === "Warehouse") return pos.positionCategory === "Warehouse";
          return pos.positionCategory === positionCategory;
        });
      }

      // Sort assignments: active first, then upcoming by start date, then completed last
      formattedAssignments.sort((a, b) => {
        // Priority order: active (1), upcoming (2), completed (3)
        const statusPriority = {
          'active': 1,
          'upcoming': 2,
          'completed': 3
        };

        const aPriority = statusPriority[a.status as keyof typeof statusPriority] || 4;
        const bPriority = statusPriority[b.status as keyof typeof statusPriority] || 4;

        // First sort by status priority
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        // For same status, sort by start date
        if (a.status === 'upcoming' && b.status === 'upcoming') {
          // For upcoming assignments, sort by start date (earliest first)
          const aDate = new Date(a.startDate || '');
          const bDate = new Date(b.startDate || '');
          return aDate.getTime() - bDate.getTime();
        }

        if (a.status === 'active' && b.status === 'active') {
          // For active assignments, sort by start date (most recent first)
          const aDate = new Date(a.startDate || '');
          const bDate = new Date(b.startDate || '');
          return bDate.getTime() - aDate.getTime();
        }

        if (a.status === 'completed' && b.status === 'completed') {
          // For completed assignments, sort by end date (most recent first)
          const aDate = new Date(a.endDate || a.startDate || '');
          const bDate = new Date(b.endDate || b.startDate || '');
          return bDate.getTime() - aDate.getTime();
        }

        // Default case: maintain order
        return 0;
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil((totalCount || 0) / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.json({
        candidate: {
          id: candidate.id,
          firstName: candidate.first_name,
          lastName: candidate.last_name,
          email: candidate.email
        },
        assignments: formattedAssignments,
        statusCounts: counts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount || 0,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      });
    } catch (error) {
      console.error("Unexpected error fetching candidate assignments:", error);
      res
        .status(500)
        .json({ error: "An unexpected error occurred while fetching candidate assignments" });
    }
  }
);

export default router;