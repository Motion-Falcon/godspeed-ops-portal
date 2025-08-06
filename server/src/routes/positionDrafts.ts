import { Router, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import { sanitizeInputs, apiRateLimiter } from "../middleware/security.js";
import { activityLogger } from "../middleware/activityLogger.js";
import dotenv from "dotenv";
import { PositionData } from "../types.js";
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

// Interface for position draft database record
interface DbPositionDraft {
  id: string;
  user_id: string;
  title: string;
  client_name: string;
  position_code: string;
  position_number: string;
  start_date: string;
  show_on_job_portal: boolean;
  last_updated: string;
  created_at: string;
  updated_at: string;
  created_by_user_id: string;
  updated_by_user_id: string;
}

// Helper function to apply filters to position drafts query
function applyPositionDraftFilters(
  query: any,
  filters: {
    search?: string;
    titleFilter?: string;
    clientFilter?: string;
    positionIdFilter?: string;
    positionCodeFilter?: string;
    creatorFilter?: string;
    updaterFilter?: string;
    dateFilter?: string;
    createdDateFilter?: string;
    startDateFilter?: string;
  }
) {
  const {
    search,
    titleFilter,
    clientFilter,
    positionIdFilter,
    positionCodeFilter,
    dateFilter,
    createdDateFilter,
    startDateFilter,
  } = filters;

  // Global search across multiple fields
  if (search && search.trim()) {
    const searchTerm = search.trim();
    query = query.or(
      `title.ilike.%${searchTerm}%,position_code.ilike.%${searchTerm}%,position_number.ilike.%${searchTerm}%,client_name.ilike.%${searchTerm}%`
    );
  }

  // Individual field filters
  if (titleFilter && titleFilter.trim()) {
    query = query.ilike("title", `%${titleFilter.trim()}%`);
  }

  if (clientFilter && clientFilter.trim()) {
    query = query.ilike("client_name", `%${clientFilter.trim()}%`);
  }

  if (positionIdFilter && positionIdFilter.trim()) {
    query = query.ilike("position_code", `%${positionIdFilter.trim()}%`);
  }

  if (positionCodeFilter && positionCodeFilter.trim()) {
    query = query.ilike("position_number", `%${positionCodeFilter.trim()}%`);
  }

  // Date filters
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

  return query;
}

/**
 * Get all position drafts for the user with pagination and filtering
 * GET /api/positions/draft
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
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

      // Build base query with selected fields for better performance
      let baseQuery = supabase.from("position_drafts").select(`
          id,
          title,
          client_name,
          position_code,
          position_number,
          start_date,
          show_on_job_portal,
          last_updated,
          created_at,
          updated_at,
          created_by_user_id,
          updated_by_user_id
        `);

      // Get total count (unfiltered)
      const { count: totalCount, error: countError } = await supabase
        .from("position_drafts")
        .select("*", { count: "exact", head: true });

      if (countError) {
        console.error("Error getting total count:", countError);
        return res
          .status(500)
          .json({ error: "Failed to get total count of drafts" });
      }

      // Apply filters to get filtered count
      let filteredCountQuery = supabase
        .from("position_drafts")
        .select("*", { count: "exact", head: true });

      filteredCountQuery = applyPositionDraftFilters(filteredCountQuery, {
        search,
        titleFilter,
        clientFilter,
        positionIdFilter,
        positionCodeFilter,
        dateFilter,
        createdDateFilter,
        startDateFilter,
      });

      const { count: filteredCount, error: filteredCountError } =
        await filteredCountQuery;

      if (filteredCountError) {
        console.error("Error getting filtered count:", filteredCountError);
        return res
          .status(500)
          .json({ error: "Failed to get filtered count of drafts" });
      }

      // Apply filters to main query
      let mainQuery = applyPositionDraftFilters(baseQuery, {
        search,
        titleFilter,
        clientFilter,
        positionIdFilter,
        positionCodeFilter,
        dateFilter,
        createdDateFilter,
        startDateFilter,
      });

      // Apply pagination and execute query
      const { data: drafts, error } = await mainQuery
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
            totalFiltered: filteredCount || 0,
            totalPages: Math.ceil((filteredCount || 0) / limit),
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }

      // Type the drafts array properly
      const typedDrafts = drafts as DbPositionDraft[];

      // Collect all user IDs to fetch their details
      const creatorIds = [
        ...new Set(
          typedDrafts
            .map((draft: DbPositionDraft) => draft.created_by_user_id)
            .filter(Boolean)
        ),
      ];
      const updaterIds = [
        ...new Set(
          typedDrafts
            .map((draft: DbPositionDraft) => draft.updated_by_user_id)
            .filter(Boolean)
        ),
      ];
      const allUserIds = [...new Set([...creatorIds, ...updaterIds])];

      // Fetch user details for all users
      const userDetailsMap: { [key: string]: any } = {};
      if (allUserIds.length > 0) {
        try {
          const userPromises = allUserIds.map(async (userId: string) => {
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
      const formattedDrafts = typedDrafts.map((draft: DbPositionDraft) => {
        const formattedDraft = {
          id: draft.id,
          userId: draft.user_id || draft.created_by_user_id,
          title: draft.title || "",
          clientName: draft.client_name,
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

      // Apply server-side user-based filters (creator/updater) after user details are fetched
      let finalFilteredDrafts = formattedDrafts;

      if (creatorFilter && creatorFilter.trim()) {
        const creatorTerm = creatorFilter.trim().toLowerCase();
        finalFilteredDrafts = finalFilteredDrafts.filter(
          (draft) =>
            (draft.creatorDetails?.name &&
              draft.creatorDetails.name.toLowerCase().includes(creatorTerm)) ||
            (draft.creatorDetails?.email &&
              draft.creatorDetails.email.toLowerCase().includes(creatorTerm))
        );
      }

      if (updaterFilter && updaterFilter.trim()) {
        const updaterTerm = updaterFilter.trim().toLowerCase();
        finalFilteredDrafts = finalFilteredDrafts.filter(
          (draft) =>
            (draft.updaterDetails?.name &&
              draft.updaterDetails.name.toLowerCase().includes(updaterTerm)) ||
            (draft.updaterDetails?.email &&
              draft.updaterDetails.email.toLowerCase().includes(updaterTerm))
        );
      }

      // Calculate pagination info
      const totalFiltered = filteredCount || 0;
      const totalPages = Math.ceil(totalFiltered / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.json({
        drafts: finalFilteredDrafts,
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
 * Save position draft
 * POST /api/positions/draft
 * @access Private (Admin, Recruiter)
 */
router.post(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sanitizeInputs,
  activityLogger({
    onSuccess: (req, res) => ({
      actionType: "create_position_draft",
      actionVerb: "created",
      primaryEntityType: "position_draft",
      primaryEntityId: res.locals.savedDraft?.id,
      primaryEntityName:
        res.locals.draftData?.title ||
        req.body.title ||
        "Untitled Position Draft",
      secondaryEntityType:
        res.locals.draftData?.client || req.body.client ? "client" : undefined,
      secondaryEntityId: res.locals.draftData?.client || req.body.client,
      secondaryEntityName: res.locals.clientName,
      displayMessage: `Created position draft "${
        res.locals.draftData?.title ||
        req.body.title ||
        "Untitled Position Draft"
      }"${
        res.locals.clientName ? ` for client "${res.locals.clientName}"` : ""
      }`,
      category: "position_management",
      priority: "normal",
      metadata: {
        positionCode:
          res.locals.draftData?.positionCode || req.body.positionCode,
        startDate: res.locals.draftData?.startDate || req.body.startDate,
        employmentTerm:
          res.locals.draftData?.employmentTerm || req.body.employmentTerm,
        employmentType:
          res.locals.draftData?.employmentType || req.body.employmentType,
        numberOfPositions:
          res.locals.draftData?.numberOfPositions || req.body.numberOfPositions,
        location:
          (res.locals.draftData?.city && res.locals.draftData?.province) ||
          (req.body.city && req.body.province)
            ? `${res.locals.draftData?.city || req.body.city}, ${
                res.locals.draftData?.province || req.body.province
              }`
            : null,
        isDraft: true,
      },
    }),
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.id;
      const positionData: Partial<PositionData> = req.body;

      // Remove clientName as it's not in the database schema
      const { clientName, ...positionDataWithoutClientName } = positionData;

      // Validate client if provided
      let client = null;
      if (positionDataWithoutClientName.client) {
        const { data: clientData, error: clientError } = await supabase
          .from("clients")
          .select("id, company_name")
          .eq("id", positionDataWithoutClientName.client)
          .maybeSingle();

        if (clientError) {
          console.error("Error checking client:", clientError);
          return res.status(500).json({ error: "Failed to validate client" });
        }

        if (!clientData) {
          return res.status(400).json({ error: "Invalid client ID" });
        }

        client = clientData;
      }

      // Store data for activity logging
      res.locals.draftData = positionDataWithoutClientName;
      res.locals.clientName = client?.company_name;

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

      // Add client_name if client is provided
      if (client) {
        dbDraftData.client_name = client.company_name;
      }

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

      // Store new draft for activity logging
      res.locals.savedDraft = newDraft;

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

/**
 * Update position draft
 * PUT /api/positions/draft
 * @access Private (Admin, Recruiter)
 */
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sanitizeInputs,
  activityLogger({
    onSuccess: (req, res) => ({
      actionType: "update_position_draft",
      actionVerb: "updated",
      primaryEntityType: "position_draft",
      primaryEntityId: req.params.id,
      primaryEntityName:
        res.locals.draftData?.title ||
        req.body.title ||
        "Untitled Position Draft",
      secondaryEntityType:
        res.locals.draftData?.client || req.body.client ? "client" : undefined,
      secondaryEntityId: res.locals.draftData?.client || req.body.client,
      secondaryEntityName: res.locals.clientName,
      displayMessage: `Updated position draft "${
        res.locals.draftData?.title ||
        req.body.title ||
        "Untitled Position Draft"
      }"${
        res.locals.clientName ? ` for client "${res.locals.clientName}"` : ""
      }`,
      category: "position_management",
      priority: "normal",
      metadata: {
        positionCode:
          res.locals.draftData?.positionCode || req.body.positionCode,
        startDate: res.locals.draftData?.startDate || req.body.startDate,
        employmentTerm:
          res.locals.draftData?.employmentTerm || req.body.employmentTerm,
        employmentType:
          res.locals.draftData?.employmentType || req.body.employmentType,
        numberOfPositions:
          res.locals.draftData?.numberOfPositions || req.body.numberOfPositions,
        location:
          (res.locals.draftData?.city && res.locals.draftData?.province) ||
          (req.body.city && req.body.province)
            ? `${res.locals.draftData?.city || req.body.city}, ${
                res.locals.draftData?.province || req.body.province
              }`
            : null,
        isDraft: true,
      },
    }),
  }),
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

      // Validate client if provided
      let client = null;
      if (positionDataWithoutClientName.client) {
        const { data: clientData, error: clientError } = await supabase
          .from("clients")
          .select("id, company_name")
          .eq("id", positionDataWithoutClientName.client)
          .maybeSingle();

        if (clientError) {
          console.error("Error checking client:", clientError);
          return res.status(500).json({ error: "Failed to validate client" });
        }

        if (!clientData) {
          return res.status(400).json({ error: "Invalid client ID" });
        }

        client = clientData;
      }

      // Store data for activity logging
      res.locals.draftData = positionDataWithoutClientName;
      res.locals.clientName = client?.company_name;

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

        // Add client_name if client is provided
        if (client) {
          dbUpdateData.client_name = client.company_name;
        }

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

        // Store updated draft for activity logging
        res.locals.savedDraft = updatedDraft;

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

        // Convert position data to snake_check for database
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

        // Add client_name if client is provided
        if (client) {
          dbDraftData.client_name = client.company_name;
        }

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

        // Store new draft for activity logging
        res.locals.savedDraft = newDraft;

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
  "/:id",
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
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  activityLogger({
    onSuccess: (req, res) => ({
      actionType: "delete_position_draft",
      actionVerb: "deleted",
      primaryEntityType: "position_draft",
      primaryEntityId: req.params.id,
      primaryEntityName:
        res.locals.deletedDraft?.title || `Position Draft ID: ${req.params.id}`,
      secondaryEntityType: res.locals.deletedDraft?.client_name
        ? "client"
        : undefined,
      secondaryEntityId: res.locals.deletedDraft?.client,
      secondaryEntityName: res.locals.deletedDraft?.client_name,
      displayMessage: `Deleted position draft "${
        res.locals.deletedDraft?.title || req.params.id
      }"${
        res.locals.deletedDraft?.client_name
          ? ` for client "${res.locals.deletedDraft.client_name}"`
          : ""
      }`,
      category: "position_management",
      priority: "normal",
      metadata: {
        positionCode: res.locals.deletedDraft?.position_code,
        startDate: res.locals.deletedDraft?.start_date,
        employmentTerm: res.locals.deletedDraft?.employment_term,
        employmentType: res.locals.deletedDraft?.employment_type,
        numberOfPositions: res.locals.deletedDraft?.number_of_positions,
        location:
          res.locals.deletedDraft?.city && res.locals.deletedDraft?.province
            ? `${res.locals.deletedDraft.city}, ${res.locals.deletedDraft.province}`
            : null,
        isDraft: true,
      },
    }),
  }),
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
        .select("*")
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

      // Store draft data for activity logging
      res.locals.deletedDraft = draft;

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

export default router;
