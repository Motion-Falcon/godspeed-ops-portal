import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import { createClient } from "@supabase/supabase-js";
import { apiRateLimiter, sanitizeInputs } from "../middleware/security.js";
import dotenv from "dotenv";
import { PositionData, DbPositionData } from "../types.js";
import { v4 as uuidv4 } from "uuid";

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

      // Calculate offset for pagination
      const offset = (pageNum - 1) * limitNum;

      // Only select the fields that are actually used in the client
      // This reduces data transfer and improves performance
      const selectedFields = [
        "id",
        "position_code", 
        "title",
        "start_date",
        "end_date",
        "city", 
        "province",
        "employment_term",
        "employment_type", 
        "position_category",
        "experience",
        "show_on_job_portal",
        "created_at", // Still needed for ordering
        "clients(company_name)",
        "assigned_jobseekers",
        "number_of_positions"
      ].join(", ");

      // Start building the query with optimized field selection
      let query = supabase.from("positions").select(selectedFields);

      // Apply database-level filters (only if they meet minimum character requirement)
      if (positionIdFilter && positionIdFilter.length >= 3) {
        query = query.ilike("position_code", `%${positionIdFilter}%`);
      }

      if (titleFilter && titleFilter.length >= 3) {
        query = query.ilike("title", `%${titleFilter}%`);
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
        const showOnPortal =
          showOnPortalFilter === "true" || showOnPortalFilter === "Yes";
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

      // Get total count first (without pagination and without filters)
      const { count: totalCount, error: countError } = await supabase
        .from("positions")
        .select("*", { count: "exact", head: true });

      if (countError) {
        console.error("Error getting total count:", countError);
        return res
          .status(500)
          .json({ error: "Failed to get total count of positions" });
      }

      // Get filtered count (with filters but without pagination)
      let countQuery = supabase
        .from("positions")
        .select("*", { count: "exact", head: true });

      // Apply the same filters to the count query
      if (positionIdFilter && positionIdFilter.length >= 3) {
        countQuery = countQuery.ilike("position_code", `%${positionIdFilter}%`);
      }

      if (titleFilter && titleFilter.length >= 3) {
        countQuery = countQuery.ilike("title", `%${titleFilter}%`);
      }

      if (employmentTermFilter && employmentTermFilter !== "all") {
        countQuery = countQuery.eq("employment_term", employmentTermFilter);
      }

      if (employmentTypeFilter && employmentTypeFilter !== "all") {
        countQuery = countQuery.eq("employment_type", employmentTypeFilter);
      }

      if (positionCategoryFilter && positionCategoryFilter !== "all") {
        countQuery = countQuery.eq("position_category", positionCategoryFilter);
      }

      if (experienceFilter && experienceFilter !== "all") {
        countQuery = countQuery.eq("experience", experienceFilter);
      }

      if (showOnPortalFilter && showOnPortalFilter !== "all") {
        const showOnPortal =
          showOnPortalFilter === "true" || showOnPortalFilter === "Yes";
        countQuery = countQuery.eq("show_on_job_portal", showOnPortal);
      }

      if (dateFilter) {
        const filterDate = new Date(dateFilter);
        const nextDay = new Date(filterDate);
        nextDay.setDate(nextDay.getDate() + 1);
        countQuery = countQuery
          .gte("start_date", filterDate.toISOString().split("T")[0])
          .lt("start_date", nextDay.toISOString().split("T")[0]);
      }

      const { count: filteredCount, error: filteredCountError } =
        await countQuery;

      if (filteredCountError) {
        console.error("Error getting filtered count:", filteredCountError);
        return res
          .status(500)
          .json({ error: "Failed to get filtered count of positions" });
      }

      // Apply pagination and execute query
      const { data: positions, error } = await query
        .range(offset, offset + limitNum - 1)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching positions:", error);
        return res.status(500).json({ error: "Failed to fetch positions" });
      }

      if (!positions) {
        return res.json({
          positions: [],
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

      // Transform the response to include clientName and convert snake_case to camelCase
      const formattedPositions = await Promise.all(positions.map(async (position: any) => {
        // Since we're only selecting specific fields, handle the clients data properly
        const clientName = position.clients?.company_name || null;
        
        // Create a clean position object without the clients nested object
        const positionData = { ...position };
        delete positionData.clients;

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

      // Apply client-side filters after formatting (for computed fields that need 3+ characters)
      let filteredPositions = formattedPositions;

      if (search && search.length >= 3) {
        filteredPositions = filteredPositions.filter(
          (position) =>
            (position.title &&
              position.title.toLowerCase().includes(search.toLowerCase())) ||
            (position.clientName &&
              position.clientName
                .toLowerCase()
                .includes(search.toLowerCase())) ||
            (position.positionCode &&
              position.positionCode
                .toLowerCase()
                .includes(search.toLowerCase())) ||
            (position.city &&
              position.city.toLowerCase().includes(search.toLowerCase())) ||
            (position.province &&
              position.province.toLowerCase().includes(search.toLowerCase()))
        );
      }

      if (clientFilter && clientFilter.length >= 3) {
        filteredPositions = filteredPositions.filter(
          (position) =>
            position.clientName &&
            position.clientName
              .toLowerCase()
              .includes(clientFilter.toLowerCase())
        );
      }

      if (locationFilter && locationFilter.length >= 3) {
        filteredPositions = filteredPositions.filter((position) => {
          const location = `${position.city || ""} ${
            position.province || ""
          }`.trim();
          return location.toLowerCase().includes(locationFilter.toLowerCase());
        });
      }

      if (positionIdFilter && positionIdFilter.length >= 3) {
        filteredPositions = filteredPositions.filter(
          (position) =>
            position.positionCode &&
            position.positionCode
              .toLowerCase()
              .includes(positionIdFilter.toLowerCase())
        );
      }

      // Calculate pagination info based on the actual final filtered count
      const actualFilteredCount = filteredPositions.length;

      // For pagination calculation, we need to account for the fact that we applied client-side filters
      // If we have client-side filters, we need to estimate the total filtered count
      let totalFilteredForPagination = filteredCount || 0;

      // If we have client-side filters that could reduce the count, use the actual count
      const hasClientSideFilters =
        (search && search.length >= 3) ||
        (positionIdFilter && positionIdFilter.length >= 3) ||
        (clientFilter && clientFilter.length >= 3) ||
        (locationFilter && locationFilter.length >= 3);

      if (hasClientSideFilters) {
        // For client-side filtered results, we can't easily calculate total across all pages
        // So we'll use a conservative approach
        totalFilteredForPagination =
          actualFilteredCount + (pageNum - 1) * limitNum;

        // If we got a full page, there might be more
        if (
          actualFilteredCount === limitNum &&
          filteredCount &&
          filteredCount > totalFilteredForPagination
        ) {
          totalFilteredForPagination = filteredCount;
        }
      }

      const totalPages = Math.ceil(totalFilteredForPagination / limitNum);
      const hasNextPage =
        pageNum < totalPages && actualFilteredCount === limitNum;
      const hasPrevPage = pageNum > 1;

      return res.json({
        positions: filteredPositions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount || 0,
          totalFiltered: totalFilteredForPagination,
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
 * Get all position drafts for the user with pagination and filtering
 * GET /api/positions/drafts
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/drafts",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  // apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const titleFilter = (req.query.titleFilter as string) || "";
      const clientFilter = (req.query.clientFilter as string) || "";
      const positionIdFilter = (req.query.positionIdFilter as string) || "";
      const positionCodeFilter = (req.query.positionCodeFilter as string) || "";
      const creatorFilter = (req.query.creatorFilter as string) || "";
      const updaterFilter = (req.query.updaterFilter as string) || "";
      const dateFilter = (req.query.dateFilter as string) || "";
      const createdDateFilter = (req.query.createdDateFilter as string) || "";
      const startDateFilter = (req.query.startDateFilter as string) || "";

      // Calculate offset
      const offset = (page - 1) * limit;

      // Build base query
      let query = supabase
        .from("position_drafts")
        .select("*, clients(company_name)");

      // Apply database-level filters (only if they meet minimum character requirement)
      if (titleFilter && titleFilter.length >= 3) {
        query = query.ilike("title", `%${titleFilter}%`);
      }

      if (positionIdFilter && positionIdFilter.length >= 3) {
        query = query.ilike("position_code", `%${positionIdFilter}%`);
      }

      if (positionCodeFilter && positionCodeFilter.length >= 3) {
        query = query.ilike("position_number", `%${positionCodeFilter}%`);
      }

      if (dateFilter) {
        const filterDate = new Date(dateFilter);
        const nextDay = new Date(filterDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query
          .gte("updated_at", filterDate.toISOString())
          .lt("updated_at", nextDay.toISOString());
      }

      if (createdDateFilter) {
        const filterDate = new Date(createdDateFilter);
        const nextDay = new Date(filterDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query
          .gte("created_at", filterDate.toISOString())
          .lt("created_at", nextDay.toISOString());
      }

      if (startDateFilter) {
        const filterDate = new Date(startDateFilter);
        const nextDay = new Date(filterDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query
          .gte("start_date", filterDate.toISOString())
          .lt("start_date", nextDay.toISOString());
      }

      // Get total count first (without pagination and without filters)
      const { count: totalCount, error: countError } = await supabase
        .from("position_drafts")
        .select("*", { count: "exact", head: true });

      if (countError) {
        console.error("Error getting total count:", countError);
        return res
          .status(500)
          .json({ error: "Failed to get total count of drafts" });
      }

      // Get filtered count (with filters but without pagination)
      let countQuery = supabase
        .from("position_drafts")
        .select("*", { count: "exact", head: true });

      // Apply the same filters to the count query
      if (positionIdFilter && positionIdFilter.length >= 3) {
        countQuery = countQuery.ilike("position_code", `%${positionIdFilter}%`);
      }

      if (titleFilter && titleFilter.length >= 3) {
        countQuery = countQuery.ilike("title", `%${titleFilter}%`);
      }

      if (positionCodeFilter && positionCodeFilter.length >= 3) {
        countQuery = countQuery.ilike(
          "position_number",
          `%${positionCodeFilter}%`
        );
      }

      if (dateFilter) {
        const filterDate = new Date(dateFilter);
        const nextDay = new Date(filterDate);
        nextDay.setDate(nextDay.getDate() + 1);
        countQuery = countQuery
          .gte("updated_at", filterDate.toISOString())
          .lt("updated_at", nextDay.toISOString());
      }

      if (createdDateFilter) {
        const filterDate = new Date(createdDateFilter);
        const nextDay = new Date(filterDate);
        nextDay.setDate(nextDay.getDate() + 1);
        countQuery = countQuery
          .gte("created_at", filterDate.toISOString())
          .lt("created_at", nextDay.toISOString());
      }

      if (startDateFilter) {
        const filterDate = new Date(startDateFilter);
        const nextDay = new Date(filterDate);
        nextDay.setDate(nextDay.getDate() + 1);
        countQuery = countQuery
          .gte("start_date", filterDate.toISOString())
          .lt("start_date", nextDay.toISOString());
      }

      const { count: filteredCount, error: filteredCountError } =
        await countQuery;

      if (filteredCountError) {
        console.error("Error getting filtered count:", filteredCountError);
        return res
          .status(500)
          .json({ error: "Failed to get filtered count of drafts" });
      }

      // Apply pagination and execute query
      const { data: drafts, error } = await query
        .range(offset, offset + limit - 1)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error fetching position drafts:", error);
        return res.status(500).json({ error: "Failed to fetch drafts" });
      }

      if (!drafts) {
        return res.json({
          drafts: [],
          pagination: {
            page,
            limit,
            total: totalCount || 0,
            totalPages: Math.ceil((totalCount || 0) / limit),
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }

      // Collect all user IDs to fetch their details
      const creatorIds = [
        ...new Set(
          drafts.map((draft) => draft.created_by_user_id).filter(Boolean)
        ),
      ];
      const updaterIds = [
        ...new Set(
          drafts.map((draft) => draft.updated_by_user_id).filter(Boolean)
        ),
      ];
      const allUserIds = [...new Set([...creatorIds, ...updaterIds])];

      // Fetch user details for all users
      const userDetailsMap: { [key: string]: any } = {};
      if (allUserIds.length > 0) {
        try {
          const userPromises = allUserIds.map(async (userId) => {
            try {
              const { data: userData, error: userError } =
                await supabase.auth.admin.getUserById(userId);
              if (!userError && userData?.user) {
                return {
                  userId,
                  details: {
                    id: userData.user.id,
                    email: userData.user.email,
                    name: userData.user.user_metadata?.name || "Unknown",
                    userType:
                      userData.user.user_metadata?.user_type || "Unknown",
                    createdAt: userData.user.created_at,
                  },
                };
              }
              return { userId, details: null };
            } catch (err) {
              console.error(`Error fetching user details for ${userId}:`, err);
              return { userId, details: null };
            }
          });

          const userResults = await Promise.all(userPromises);
          userResults.forEach(({ userId, details }) => {
            if (details) {
              userDetailsMap[userId] = details;
            }
          });
        } catch (error) {
          console.error("Error fetching user details:", error);
          // Continue without user details if there's an error
        }
      }

      // Transform drafts format to match client expectations
      const formattedDrafts = drafts.map((draft) => {
        const clientName = draft.clients?.company_name || null;

        // Create a formatted draft object
        const formattedDraft = {
          id: draft.id,
          userId: draft.user_id || draft.created_by_user_id, // fallback for user_id
          title: draft.title || "",
          clientName: clientName,
          positionCode: draft.position_code,
          positionNumber: draft.position_number,
          startDate: draft.start_date,
          showOnJobPortal: draft.show_on_job_portal,
          lastUpdated: draft.last_updated,
          createdAt: draft.created_at,
          createdByUserId: draft.created_by_user_id,
          updatedAt: draft.updated_at,
          updatedByUserId: draft.updated_by_user_id,
          creatorDetails: draft.created_by_user_id
            ? userDetailsMap[draft.created_by_user_id] || null
            : null,
          updaterDetails: draft.updated_by_user_id
            ? userDetailsMap[draft.updated_by_user_id] || null
            : null,
        };

        return formattedDraft;
      });

      // Apply client-side filters after formatting (since they involve computed fields)
      let filteredDrafts = formattedDrafts;

      if (search && search.length >= 3) {
        filteredDrafts = formattedDrafts.filter(
          (draft) =>
            draft.title.toLowerCase().includes(search.toLowerCase()) ||
            (draft.clientName &&
              draft.clientName.toLowerCase().includes(search.toLowerCase())) ||
            (draft.positionCode &&
              draft.positionCode
                .toLowerCase()
                .includes(search.toLowerCase())) ||
            (draft.positionNumber &&
              draft.positionNumber.toLowerCase().includes(search.toLowerCase()))
        );
      }

      if (clientFilter && clientFilter.length >= 3) {
        filteredDrafts = filteredDrafts.filter(
          (draft) =>
            draft.clientName &&
            draft.clientName.toLowerCase().includes(clientFilter.toLowerCase())
        );
      }

      if (positionIdFilter && positionIdFilter.length >= 3) {
        filteredDrafts = filteredDrafts.filter(
          (draft) =>
            draft.positionCode &&
            draft.positionCode
              .toLowerCase()
              .includes(positionIdFilter.toLowerCase())
        );
      }

      if (positionCodeFilter && positionCodeFilter.length >= 3) {
        filteredDrafts = filteredDrafts.filter(
          (draft) =>
            draft.positionNumber &&
            draft.positionNumber
              .toLowerCase()
              .includes(positionCodeFilter.toLowerCase())
        );
      }

      if (creatorFilter && creatorFilter.length >= 3) {
        filteredDrafts = filteredDrafts.filter(
          (draft) =>
            (draft.creatorDetails?.name &&
              draft.creatorDetails.name
                .toLowerCase()
                .includes(creatorFilter.toLowerCase())) ||
            (draft.creatorDetails?.email &&
              draft.creatorDetails.email
                .toLowerCase()
                .includes(creatorFilter.toLowerCase()))
        );
      }

      if (updaterFilter && updaterFilter.length >= 3) {
        filteredDrafts = filteredDrafts.filter(
          (draft) =>
            (draft.updaterDetails?.name &&
              draft.updaterDetails.name
                .toLowerCase()
                .includes(updaterFilter.toLowerCase())) ||
            (draft.updaterDetails?.email &&
              draft.updaterDetails.email
                .toLowerCase()
                .includes(updaterFilter.toLowerCase()))
        );
      }

      // Calculate pagination info based on filtered count
      const totalFiltered = filteredCount || 0;
      const totalPages = Math.ceil(totalFiltered / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.json({
        drafts: filteredDrafts,
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalFiltered,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      });
    } catch (error) {
      console.error("Unexpected error fetching position drafts:", error);
      res
        .status(500)
        .json({ error: "An unexpected error occurred while fetching drafts" });
    }
  }
);

/**
 * Get position by ID
 * GET /api/positions/:id
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  // apiRateLimiter,
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
  // apiRateLimiter,
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

      // Update position in database
      const { data: updatedPosition, error: updateError } = await supabase
        .from("positions")
        .update(dbPositionData)
        .eq("id", id)
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
 * Save position draft
 * POST or PUT /api/positions/draft
 * @access Private (Admin, Recruiter)
 */
router.put(
  "/draft/:id?",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sanitizeInputs,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.id;
      const positionData: Partial<PositionData> = req.body;
      const { id } = req.params;

      // Remove clientName as it's not in the database schema
      const { clientName, ...positionDataWithoutClientName } = positionData;

      // Handle empty date fields - convert empty strings to null
      // Using a type-safe approach to avoid TypeScript errors
      const dataWithNullDates = { ...positionDataWithoutClientName };
      if (dataWithNullDates.startDate === "")
        dataWithNullDates.startDate = undefined;
      if (dataWithNullDates.endDate === "")
        dataWithNullDates.endDate = undefined;
      if (dataWithNullDates.projCompDate === "")
        dataWithNullDates.projCompDate = undefined;

      // Ensure numberOfPositions is a number
      if (dataWithNullDates.numberOfPositions !== undefined) {
        dataWithNullDates.numberOfPositions = Number(
          dataWithNullDates.numberOfPositions
        );
      }

      // Check if we're updating an existing draft or creating a new one
      if (id) {
        // Check if the draft exists
        const { data: existingDraft, error: draftCheckError } = await supabase
          .from("position_drafts")
          .select("id, created_by_user_id")
          .eq("id", id)
          .maybeSingle();

        if (draftCheckError) {
          console.error("Error checking for existing draft:", draftCheckError);
          return res
            .status(500)
            .json({ error: "Failed to check draft status" });
        }

        // If draft doesn't exist or doesn't belong to the user
        if (!existingDraft) {
          return res.status(404).json({ error: "Draft not found" });
        }

        // Prepare update data with timestamps
        const updateData = {
          ...dataWithNullDates,
          is_draft: true,
          updated_at: new Date().toISOString(),
          updated_by_user_id: userId,
          last_updated: new Date().toISOString(),
        };

        // Convert camelCase to snake_case for database
        const dbUpdateData = Object.entries(updateData).reduce(
          (acc, [key, value]) => {
            const snakeKey = camelToSnakeCase(key);
            acc[snakeKey] = value;
            return acc;
          },
          {} as Record<string, any>
        );

        // Update the draft
        const { data: updatedDraft, error: updateError } = await supabase
          .from("position_drafts")
          .update(dbUpdateData)
          .eq("id", id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating draft:", updateError);
          return res.status(500).json({ error: "Failed to update draft" });
        }

        return res.status(200).json({
          success: true,
          message: "Draft updated successfully",
          draft: updatedDraft,
          lastUpdated: updatedDraft.last_updated,
        });
      } else {
        // Creating a new draft
        // Generate a new UUID for the draft
        const draftId = uuidv4();

        // Convert position data to snake_case for database
        const dbDraftData = Object.entries(dataWithNullDates).reduce(
          (acc, [key, value]) => {
            const snakeKey = camelToSnakeCase(key);
            acc[snakeKey] = value;
            return acc;
          },
          {} as Record<string, any>
        );

        // Add required fields
        dbDraftData.id = draftId;
        dbDraftData.is_draft = true;
        dbDraftData.created_by_user_id = userId;
        dbDraftData.updated_by_user_id = userId;
        dbDraftData.created_at = new Date().toISOString();
        dbDraftData.updated_at = new Date().toISOString();
        dbDraftData.last_updated = new Date().toISOString();

        // Insert new draft
        const { data: newDraft, error: insertError } = await supabase
          .from("position_drafts")
          .insert([dbDraftData])
          .select()
          .single();

        if (insertError) {
          console.error("Error creating draft:", insertError);
          return res.status(500).json({ error: "Failed to create draft" });
        }

        return res.status(201).json({
          success: true,
          message: "Draft created successfully",
          draft: newDraft,
          lastUpdated: newDraft.last_updated,
        });
      }
    } catch (error) {
      console.error("Unexpected error saving draft:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

/**
 * Get position draft by ID
 * GET /api/positions/draft/:id
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/draft/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  // apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.id;
      const { id } = req.params;

      // Get the draft by ID with client info
      const { data: draft, error } = await supabase
        .from("position_drafts")
        .select("*, clients(company_name)")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching draft by ID:", error);
        return res.status(500).json({ error: "Failed to fetch draft" });
      }

      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }

      // Make sure the draft belongs to the user
      if (draft.created_by_user_id !== userId) {
        return res
          .status(403)
          .json({ error: "You do not have permission to access this draft" });
      }

      // Transform to include clientName and convert snake_case to camelCase
      const clientName = draft.clients?.company_name || null;
      const { clients, ...draftData } = draft;

      // Convert snake_case to camelCase
      const formattedDraft = Object.entries(draftData).reduce(
        (acc, [key, value]) => {
          const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
            letter.toUpperCase()
          );
          acc[camelKey] = value;
          return acc;
        },
        { clientName } as Record<string, any>
      );

      return res.status(200).json({
        draft: formattedDraft,
        lastUpdated: draft.last_updated || null,
      });
    } catch (error) {
      console.error("Unexpected error fetching draft by ID:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

/**
 * Delete a position draft
 * DELETE /api/positions/draft/:id
 * @access Private (Admin, Recruiter)
 */
router.delete(
  "/draft/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.id;
      const { id } = req.params;

      // Make sure the draft exists and belongs to the user
      const { data: draft, error: checkError } = await supabase
        .from("position_drafts")
        .select("id, created_by_user_id")
        .eq("id", id)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking draft:", checkError);
        return res.status(500).json({ error: "Failed to check draft status" });
      }

      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }

      if (draft.created_by_user_id !== userId) {
        return res
          .status(403)
          .json({ error: "You do not have permission to delete this draft" });
      }

      // Delete the draft
      const { error: deleteError } = await supabase
        .from("position_drafts")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("Error deleting draft:", deleteError);
        return res.status(500).json({ error: "Failed to delete draft" });
      }

      return res.status(200).json({
        success: true,
        message: "Draft deleted successfully",
        deletedId: id,
      });
    } catch (error) {
      console.error("Unexpected error deleting draft:", error);
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
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

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
        .select("assigned_jobseekers, number_of_positions")
        .eq("id", positionId)
        .single();

      if (positionError || !position) {
        return res.status(404).json({ error: "Position not found" });
      }

      // Check if candidate exists
      const { data: candidate, error: candidateError } = await supabase
        .from("jobseeker_profiles")
        .select("id")
        .eq("id", candidateId)
        .single();

      if (candidateError || !candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }

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

      // Update the assigned_jobseekers array in positions table for backward compatibility
      const currentAssigned = position.assigned_jobseekers || [];
      const updatedAssigned = [...currentAssigned, candidateId];

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
  async (req: Request, res: Response) => {
    try {
      const { id: positionId, candidateId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get current position data
      const { data: position, error: positionError } = await supabase
        .from("positions")
        .select("assigned_jobseekers")
        .eq("id", positionId)
        .single();

      if (positionError || !position) {
        return res.status(404).json({ error: "Position not found" });
      }

      // Check if there's an active assignment for this position-candidate pair
      const { data: activeAssignment, error: assignmentCheckError } = await supabase
        .from("position_candidate_assignments")
        .select("id")
        .eq("position_id", positionId)
        .eq("candidate_id", candidateId)
        .eq("status", "active")
        .maybeSingle();

      if (assignmentCheckError) {
        console.error("Error checking assignment:", assignmentCheckError);
        return res.status(500).json({ error: "Failed to check assignment" });
      }

      if (!activeAssignment) {
        return res.status(400).json({ error: "Candidate not assigned to this position" });
      }

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

      // Get all assignments for this position
      const { data: assignments, error } = await supabase
        .from("position_candidate_assignments")
        .select(`
          id,
          candidate_id,
          start_date,
          end_date,
          status,
          created_at,
          updated_at,
          jobseeker_profiles:candidate_id (
            id,
            first_name,
            last_name,
            email,
            mobile
          )
        `)
        .eq("position_id", positionId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching assignments:", error);
        return res.status(500).json({ error: "Failed to fetch assignments" });
      }

      return res.status(200).json({
        success: true,
        assignments: assignments || []
      });
    } catch (error) {
      console.error("Unexpected error fetching assignments:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

// Create a new position draft
router.post(
  "/draft",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sanitizeInputs,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.id;
      const positionData: Partial<PositionData> = req.body;

      // Remove clientName as it's not in the database schema
      const { clientName, ...positionDataWithoutClientName } = positionData;

      // Handle empty date fields - convert empty strings to null
      // Using a type-safe approach to avoid TypeScript errors
      const dataWithNullDates = { ...positionDataWithoutClientName };
      if (dataWithNullDates.startDate === "")
        dataWithNullDates.startDate = undefined;
      if (dataWithNullDates.endDate === "")
        dataWithNullDates.endDate = undefined;
      if (dataWithNullDates.projCompDate === "")
        dataWithNullDates.projCompDate = undefined;

      // Ensure numberOfPositions is a number
      if (dataWithNullDates.numberOfPositions !== undefined) {
        dataWithNullDates.numberOfPositions = Number(
          dataWithNullDates.numberOfPositions
        );
      }

      // Generate a new UUID for the draft
      const draftId = uuidv4();

      // Use dataWithNullDates instead of positionData
      // Convert position data to snake_case for database
      const dbDraftData = Object.entries(dataWithNullDates).reduce(
        (acc, [key, value]) => {
          const snakeKey = camelToSnakeCase(key);
          acc[snakeKey] = value;
          return acc;
        },
        {} as Record<string, any>
      );

      // Add required fields
      dbDraftData.id = draftId;
      dbDraftData.is_draft = true;
      dbDraftData.created_by_user_id = userId;
      dbDraftData.updated_by_user_id = userId;
      dbDraftData.created_at = new Date().toISOString();
      dbDraftData.updated_at = new Date().toISOString();
      dbDraftData.last_updated = new Date().toISOString();

      // Insert new draft
      const { data: newDraft, error: insertError } = await supabase
        .from("position_drafts")
        .insert([dbDraftData])
        .select()
        .single();

      if (insertError) {
        console.error("Error creating draft:", insertError);
        return res.status(500).json({ error: "Failed to create draft" });
      }

      return res.status(201).json({
        success: true,
        message: "Draft created successfully",
        draft: newDraft,
        lastUpdated: newDraft.last_updated,
      });
    } catch (error) {
      console.error("Unexpected error creating draft:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

export default router;