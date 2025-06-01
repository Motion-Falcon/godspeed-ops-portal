import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { apiRateLimiter, sanitizeInputs } from '../middleware/security.js';
import dotenv from 'dotenv';
import { PositionData, DbPositionData } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const router = Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Convert camelCase to snake_case properly handling consecutive capital letters
 */
function camelToSnakeCase(str: string): string {
  // Special handling for known problematic fields
  if (str === 'documentsRequired') return 'documents_required';
  
  // For other fields, general algorithm
  let result = '';
  let prevChar = '';
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (i === 0) {
      // First character is always lowercase
      result += char.toLowerCase();
    } else if (char === char.toUpperCase() && char !== char.toLowerCase()) {
      // This is a capital letter
      
      // If previous char was also uppercase and not the first char, don't add another underscore
      if (prevChar === prevChar.toUpperCase() && prevChar !== prevChar.toLowerCase() && i > 1) {
        result += char.toLowerCase();
      } else {
        result += '_' + char.toLowerCase();
      }
    } else {
      result += char;
    }
    
    prevChar = char;
  }
  
  return result;
}

/**
 * Get all positions
 * GET /api/positions
 * @access Private (Admin, Recruiter)
 */
router.get('/', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  // apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      // Get positions from the database
      const { data: positions, error } = await supabase
        .from('positions')
        .select('*, clients(company_name)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching positions:', error);
        return res.status(500).json({ error: 'Failed to fetch positions' });
      }

      // Transform the response to include clientName
      const formattedPositions = positions.map(position => {
        const clientName = position.clients?.company_name || null;
        // Remove the clients object and add clientName directly
        const { clients, ...positionData } = position;
        return {
          ...positionData,
          clientName
        };
      });

      return res.status(200).json(formattedPositions);
    } catch (error) {
      console.error('Unexpected error fetching positions:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Get all position drafts for the user
 * GET /api/positions/drafts
 * @access Private (Admin, Recruiter)
 */
router.get('/drafts', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  // apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;

      // Get all drafts for this user with client information
      const { data: drafts, error } = await supabase
        .from('position_drafts')
        .select('*, clients(company_name)')
        .eq('created_by_user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching all drafts:', error);
        return res.status(500).json({ error: 'Failed to fetch drafts' });
      }

      // Transform the response to include clientName and convert snake_case to camelCase
      const formattedDrafts = drafts.map(draft => {
        const clientName = draft.clients?.company_name || null;
        // Remove the clients object
        const { clients, ...draftData } = draft;
        
        // Convert snake_case to camelCase
        return Object.entries(draftData).reduce((acc, [key, value]) => {
          // Convert snake_case to camelCase
          const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          acc[camelKey] = value;
          return acc;
        }, { clientName } as Record<string, any>);
      });

      return res.status(200).json(formattedDrafts);
    } catch (error) {
      console.error('Unexpected error fetching all drafts:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Get position by ID
 * GET /api/positions/:id
 * @access Private (Admin, Recruiter)
 */
router.get('/:id', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  // apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Get position from the database with client info
      const { data: position, error } = await supabase
        .from('positions')
        .select('*, clients(company_name)')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching position:', error);
        return res.status(404).json({ error: 'Position not found' });
      }

      // Transform to include clientName
      const clientName = position.clients?.company_name || null;
      const { clients, ...positionData } = position;

      return res.status(200).json({
        ...positionData,
        clientName
      });
    } catch (error) {
      console.error('Unexpected error fetching position:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Generate next position code for a client
 * GET /api/positions/generate-code/:clientId
 * @access Private (Admin, Recruiter)
 */
router.get('/generate-code/:clientId', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  // apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;

      // First, get the client's short code
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('short_code')
        .eq('id', clientId)
        .single();

      if (clientError || !client) {
        console.error('Error fetching client:', clientError);
        return res.status(404).json({ error: 'Client not found' });
      }

      if (!client.short_code) {
        return res.status(400).json({ error: 'Client does not have a short code' });
      }

      // Use the database function to generate the next position code
      const { data: result, error: generateError } = await supabase
        .rpc('generate_next_position_code', { client_short_code: client.short_code });

      if (generateError) {
        console.error('Error generating position code:', generateError);
        return res.status(500).json({ error: 'Failed to generate position code' });
      }

      return res.status(200).json({
        positionCode: result,
        clientShortCode: client.short_code
      });
    } catch (error) {
      console.error('Unexpected error generating position code:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Create a new position
 * POST /api/positions
 * @access Private (Admin, Recruiter)
 */
router.post('/', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  sanitizeInputs,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
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
      if (cleanedData.startDate === '') cleanedData.startDate = undefined;
      if (cleanedData.endDate === '') cleanedData.endDate = undefined;
      if (cleanedData.projCompDate === '') cleanedData.projCompDate = undefined;
      
      // Validate date values
      if (cleanedData.startDate) {
        const startDate = new Date(cleanedData.startDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time part
        
        if (startDate < today) {
          return res.status(400).json({ 
            error: 'Start date must be today or in the future',
            field: 'startDate'
          });
        }
        
        // If endDate is provided, validate it's after startDate
        if (cleanedData.endDate) {
          const endDate = new Date(cleanedData.endDate);
          if (endDate <= startDate) {
            return res.status(400).json({ 
              error: 'End date must be after start date',
              field: 'endDate'
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
        'client', 'title', 'startDate', 'description', 
        'streetAddress', 'city', 'province', 'postalCode',
        'employmentTerm', 'employmentType', 'positionCategory', 'experience',
        'payrateType', 'numberOfPositions', 'regularPayRate', 'billRate',
        'preferredPaymentMethod', 'terms', 'notes'
      ];

      for (const field of requiredFields) {
        if (!cleanedData[field as keyof PositionData]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Check if client exists
      const { data: client, error: clientCheckError } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('id', cleanedData.client)
        .maybeSingle();

      if (clientCheckError || !client) {
        console.error('Error checking client:', clientCheckError);
        return res.status(404).json({ error: 'Client not found' });
      }

      // Validate documents required - at least one must be selected
      const documentsRequired = cleanedData.documentsRequired || {};
      const hasAtLeastOneDoc = Object.values(documentsRequired).some(v => v === true);
      
      if (!hasAtLeastOneDoc) {
        return res.status(400).json({ 
          error: 'At least one document must be required',
          field: 'documentsRequired'
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
        .from('positions')
        .insert([dbPositionData])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating position:', insertError);
        return res.status(500).json({ error: 'Failed to create position' });
      }

      return res.status(201).json({
        success: true,
        message: 'Position created successfully',
        position: newPosition
      });
    } catch (error) {
      console.error('Unexpected error creating position:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Update an existing position
 * PUT /api/positions/:id
 * @access Private (Admin, Recruiter)
 */
router.put('/:id', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  sanitizeInputs,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
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
      if (cleanedData.startDate === '') cleanedData.startDate = undefined;
      if (cleanedData.endDate === '') cleanedData.endDate = undefined;
      if (cleanedData.projCompDate === '') cleanedData.projCompDate = undefined;
      
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
                error: 'End date must be after start date',
                field: 'endDate'
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
      const { data: existingPosition, error: positionCheckError } = await supabase
        .from('positions')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (positionCheckError || !existingPosition) {
        return res.status(404).json({ error: 'Position not found' });
      }

      // Validate required fields
      const requiredFields = [
        'client', 'title', 'startDate', 'description', 
        'streetAddress', 'city', 'province', 'postalCode',
        'employmentTerm', 'employmentType', 'positionCategory', 'experience',
        'payrateType', 'numberOfPositions', 'regularPayRate', 'billRate',
        'preferredPaymentMethod', 'terms', 'notes'
      ];

      for (const field of requiredFields) {
        if (!cleanedData[field as keyof PositionData]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Check if client exists
      const { data: client, error: clientCheckError } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('id', cleanedData.client)
        .maybeSingle();

      if (clientCheckError || !client) {
        console.error('Error checking client:', clientCheckError);
        return res.status(404).json({ error: 'Client not found' });
      }

      // Validate documents required - at least one must be selected
      const documentsRequired = cleanedData.documentsRequired || {};
      const hasAtLeastOneDoc = Object.values(documentsRequired).some(v => v === true);
      
      if (!hasAtLeastOneDoc) {
        return res.status(400).json({ 
          error: 'At least one document must be required',
          field: 'documentsRequired'
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
        .from('positions')
        .update(dbPositionData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating position:', updateError);
        return res.status(500).json({ error: 'Failed to update position' });
      }

      return res.status(200).json({
        success: true,
        message: 'Position updated successfully',
        position: updatedPosition
      });
    } catch (error) {
      console.error('Unexpected error updating position:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Save position draft
 * POST or PUT /api/positions/draft
 * @access Private (Admin, Recruiter)
 */
router.put('/draft/:id?', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  sanitizeInputs,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const positionData: Partial<PositionData> = req.body;
      const { id } = req.params;
      
      // Remove clientName as it's not in the database schema
      const { clientName, ...positionDataWithoutClientName } = positionData;
      
      // Handle empty date fields - convert empty strings to null
      // Using a type-safe approach to avoid TypeScript errors
      const dataWithNullDates = { ...positionDataWithoutClientName };
      if (dataWithNullDates.startDate === '') dataWithNullDates.startDate = undefined;
      if (dataWithNullDates.endDate === '') dataWithNullDates.endDate = undefined;
      if (dataWithNullDates.projCompDate === '') dataWithNullDates.projCompDate = undefined;
      
      // Ensure numberOfPositions is a number
      if (dataWithNullDates.numberOfPositions !== undefined) {
        dataWithNullDates.numberOfPositions = Number(dataWithNullDates.numberOfPositions);
      }
      
      // Check if we're updating an existing draft or creating a new one
      if (id) {
        // Check if the draft exists
        const { data: existingDraft, error: draftCheckError } = await supabase
          .from('position_drafts')
          .select('id, created_by_user_id')
          .eq('id', id)
          .maybeSingle();

        if (draftCheckError) {
          console.error('Error checking for existing draft:', draftCheckError);
          return res.status(500).json({ error: 'Failed to check draft status' });
        }

        // If draft doesn't exist or doesn't belong to the user
        if (!existingDraft) {
          return res.status(404).json({ error: 'Draft not found' });
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
        const dbUpdateData = Object.entries(updateData).reduce((acc, [key, value]) => {
          const snakeKey = camelToSnakeCase(key);
          acc[snakeKey] = value;
          return acc;
        }, {} as Record<string, any>);

        // Update the draft
        const { data: updatedDraft, error: updateError } = await supabase
          .from('position_drafts')
          .update(dbUpdateData)
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating draft:', updateError);
          return res.status(500).json({ error: 'Failed to update draft' });
        }

        return res.status(200).json({
          success: true,
          message: 'Draft updated successfully',
          draft: updatedDraft,
          lastUpdated: updatedDraft.last_updated
        });
      } else {
        // Creating a new draft
        // Generate a new UUID for the draft
        const draftId = uuidv4();

        // Convert position data to snake_case for database
        const dbDraftData = Object.entries(dataWithNullDates).reduce((acc, [key, value]) => {
          const snakeKey = camelToSnakeCase(key);
          acc[snakeKey] = value;
          return acc;
        }, {} as Record<string, any>);

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
          .from('position_drafts')
          .insert([dbDraftData])
          .select()
          .single();

        if (insertError) {
          console.error('Error creating draft:', insertError);
          return res.status(500).json({ error: 'Failed to create draft' });
        }

        return res.status(201).json({
          success: true,
          message: 'Draft created successfully',
          draft: newDraft,
          lastUpdated: newDraft.last_updated
        });
      }
    } catch (error) {
      console.error('Unexpected error saving draft:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Get position draft by ID
 * GET /api/positions/draft/:id
 * @access Private (Admin, Recruiter)
 */
router.get('/draft/:id', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  // apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const { id } = req.params;

      // Get the draft by ID with client info
      const { data: draft, error } = await supabase
        .from('position_drafts')
        .select('*, clients(company_name)')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching draft by ID:', error);
        return res.status(500).json({ error: 'Failed to fetch draft' });
      }

      if (!draft) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      // Make sure the draft belongs to the user
      if (draft.created_by_user_id !== userId) {
        return res.status(403).json({ error: 'You do not have permission to access this draft' });
      }

      // Transform to include clientName and convert snake_case to camelCase
      const clientName = draft.clients?.company_name || null;
      const { clients, ...draftData } = draft;
      
      // Convert snake_case to camelCase
      const formattedDraft = Object.entries(draftData).reduce((acc, [key, value]) => {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        acc[camelKey] = value;
        return acc;
      }, { clientName } as Record<string, any>);

      return res.status(200).json({
        draft: formattedDraft,
        lastUpdated: draft.last_updated || null
      });
    } catch (error) {
      console.error('Unexpected error fetching draft by ID:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Delete a position draft
 * DELETE /api/positions/draft/:id
 * @access Private (Admin, Recruiter)
 */
router.delete('/draft/:id', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const { id } = req.params;

      // Make sure the draft exists and belongs to the user
      const { data: draft, error: checkError } = await supabase
        .from('position_drafts')
        .select('id, created_by_user_id')
        .eq('id', id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking draft:', checkError);
        return res.status(500).json({ error: 'Failed to check draft status' });
      }

      if (!draft) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      if (draft.created_by_user_id !== userId) {
        return res.status(403).json({ error: 'You do not have permission to delete this draft' });
      }

      // Delete the draft
      const { error: deleteError } = await supabase
        .from('position_drafts')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting draft:', deleteError);
        return res.status(500).json({ error: 'Failed to delete draft' });
      }

      return res.status(200).json({
        success: true,
        message: 'Draft deleted successfully',
        deletedId: id
      });
    } catch (error) {
      console.error('Unexpected error deleting draft:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Delete a position
 * DELETE /api/positions/:id
 * @access Private (Admin, Recruiter)
 */
router.delete('/:id', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if position exists
      const { data: existingPosition, error: positionCheckError } = await supabase
        .from('positions')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (positionCheckError || !existingPosition) {
        return res.status(404).json({ error: 'Position not found' });
      }

      // Delete position
      const { error: deleteError } = await supabase
        .from('positions')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting position:', deleteError);
        return res.status(500).json({ error: 'Failed to delete position' });
      }

      return res.status(200).json({
        success: true,
        message: 'Position deleted successfully',
        deletedId: id
      });
    } catch (error) {
      console.error('Unexpected error deleting position:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

// Create a new position draft
router.post('/draft', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  sanitizeInputs,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const positionData: Partial<PositionData> = req.body;

      // Remove clientName as it's not in the database schema
      const { clientName, ...positionDataWithoutClientName } = positionData;
      
      // Handle empty date fields - convert empty strings to null
      // Using a type-safe approach to avoid TypeScript errors
      const dataWithNullDates = { ...positionDataWithoutClientName };
      if (dataWithNullDates.startDate === '') dataWithNullDates.startDate = undefined;
      if (dataWithNullDates.endDate === '') dataWithNullDates.endDate = undefined;
      if (dataWithNullDates.projCompDate === '') dataWithNullDates.projCompDate = undefined;

      // Ensure numberOfPositions is a number
      if (dataWithNullDates.numberOfPositions !== undefined) {
        dataWithNullDates.numberOfPositions = Number(dataWithNullDates.numberOfPositions);
      }

      // Generate a new UUID for the draft
      const draftId = uuidv4();

      // Use dataWithNullDates instead of positionData
      // Convert position data to snake_case for database
      const dbDraftData = Object.entries(dataWithNullDates).reduce((acc, [key, value]) => {
        const snakeKey = camelToSnakeCase(key);
        acc[snakeKey] = value;
        return acc;
      }, {} as Record<string, any>);

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
        .from('position_drafts')
        .insert([dbDraftData])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating draft:', insertError);
        return res.status(500).json({ error: 'Failed to create draft' });
      }

      return res.status(201).json({
        success: true,
        message: 'Draft created successfully',
        draft: newDraft,
        lastUpdated: newDraft.last_updated
      });
    } catch (error) {
      console.error('Unexpected error creating draft:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

export default router; 