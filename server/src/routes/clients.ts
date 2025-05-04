import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { apiRateLimiter, sanitizeInputs } from '../middleware/security.js';
import dotenv from 'dotenv';
import { ClientData, DbClientData } from '../types.js';
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
  if (str === 'invoiceCC2') return 'invoice_cc2';
  if (str === 'invoiceCC3') return 'invoice_cc3';
  if (str === 'invoiceCCDispatch') return 'invoice_cc_dispatch';
  if (str === 'invoiceCCAccounts') return 'invoice_cc_accounts';
  
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
 * Get all clients
 * GET /api/clients
 * @access Private (Admin, Recruiter)
 */
router.get('/', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      // Get clients from the database
      const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching clients:', error);
        return res.status(500).json({ error: 'Failed to fetch clients' });
      }

      return res.status(200).json(clients);
    } catch (error) {
      console.error('Unexpected error fetching clients:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Get all client drafts for the user
 * GET /api/clients/drafts
 * @access Private (Admin, Recruiter)
 */
router.get('/drafts', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;

      // Get all drafts for this user
      const { data: drafts, error } = await supabase
        .from('client_drafts')
        .select('*')
        .eq('created_by_user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching all drafts:', error);
        return res.status(500).json({ error: 'Failed to fetch drafts' });
      }

      // Convert snake_case to camelCase for frontend
      const clientDrafts = drafts.map(draft => {
        return Object.entries(draft).reduce((acc, [key, value]) => {
          // Convert snake_case to camelCase
          const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          acc[camelKey] = value;
          return acc;
        }, {} as Record<string, any>);
      });

      return res.status(200).json(clientDrafts);
    } catch (error) {
      console.error('Unexpected error fetching all drafts:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Get client by ID
 * GET /api/clients/:id
 * @access Private (Admin, Recruiter)
 */
router.get('/:id', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Get client from the database
      const { data: client, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching client:', error);
        return res.status(404).json({ error: 'Client not found' });
      }

      return res.status(200).json(client);
    } catch (error) {
      console.error('Unexpected error fetching client:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Create a new client
 * POST /api/clients
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
      const clientData: ClientData = req.body;
      
      // Validate required fields
      const requiredFields = [
        'companyName', 'billingName', 'contactPersonName1', 
        'emailAddress1', 'mobile1', 'streetAddress1',
        'city1', 'province1', 'postalCode1'
      ];

      for (const field of requiredFields) {
        if (!clientData[field as keyof ClientData]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Check if client with same company name already exists
      const { data: existingClient, error: clientCheckError } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('company_name', clientData.companyName)
        .maybeSingle();

      if (clientCheckError) {
        console.error('Error checking for existing client:', clientCheckError);
        return res.status(500).json({ error: 'Failed to validate company name uniqueness' });
      }

      // If client already exists, return an error
      if (existingClient) {
        return res.status(409).json({ 
          error: 'A client with this company name already exists',
          field: 'companyName'
        });
      }

      // Prepare client data for database
      const dbClientData: Omit<DbClientData, 'id' | 'created_at' | 'updated_at'> = {
        // Basic Details
        company_name: clientData.companyName,
        billing_name: clientData.billingName,
        short_code: clientData.shortCode,
        list_name: clientData.listName,
        website: clientData.website,
        client_manager: clientData.clientManager,
        sales_person: clientData.salesPerson,
        accounting_person: clientData.accountingPerson,
        merge_invoice: clientData.mergeInvoice,
        currency: clientData.currency,
        work_province: clientData.workProvince,
        
        // Contact Details
        contact_person_name1: clientData.contactPersonName1,
        email_address1: clientData.emailAddress1,
        mobile1: clientData.mobile1,
        contact_person_name2: clientData.contactPersonName2,
        email_address2: clientData.emailAddress2,
        invoice_cc2: clientData.invoiceCC2 || false,
        mobile2: clientData.mobile2,
        contact_person_name3: clientData.contactPersonName3,
        email_address3: clientData.emailAddress3,
        invoice_cc3: clientData.invoiceCC3 || false,
        mobile3: clientData.mobile3,
        dispatch_dept_email: clientData.dispatchDeptEmail,
        invoice_cc_dispatch: clientData.invoiceCCDispatch || false,
        accounts_dept_email: clientData.accountsDeptEmail,
        invoice_cc_accounts: clientData.invoiceCCAccounts || false,
        invoice_language: clientData.invoiceLanguage,
        
        // Address Details
        street_address1: clientData.streetAddress1,
        city1: clientData.city1,
        province1: clientData.province1,
        postal_code1: clientData.postalCode1,
        street_address2: clientData.streetAddress2,
        city2: clientData.city2,
        province2: clientData.province2,
        postal_code2: clientData.postalCode2,
        street_address3: clientData.streetAddress3,
        city3: clientData.city3,
        province3: clientData.province3,
        postal_code3: clientData.postalCode3,
        
        // Payment & Billings
        preferred_payment_method: clientData.preferredPaymentMethod,
        terms: clientData.terms,
        pay_cycle: clientData.payCycle,
        credit_limit: clientData.creditLimit,
        notes: clientData.notes,
        
        // Meta fields
        is_draft: false,
        created_by_user_id: userId,
        updated_by_user_id: userId,
      };

      // Insert client into database
      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert([dbClientData])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating client:', insertError);
        return res.status(500).json({ error: 'Failed to create client' });
      }

      return res.status(201).json({
        success: true,
        message: 'Client created successfully',
        client: newClient
      });
    } catch (error) {
      console.error('Unexpected error creating client:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Update an existing client
 * PUT /api/clients/:id
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
      const clientData: ClientData = req.body;
      
      // Check if client exists
      const { data: existingClient, error: clientCheckError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (clientCheckError || !existingClient) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Validate required fields
      const requiredFields = [
        'companyName', 'billingName', 'contactPersonName1', 
        'emailAddress1', 'mobile1', 'streetAddress1',
        'city1', 'province1', 'postalCode1'
      ];

      for (const field of requiredFields) {
        if (!clientData[field as keyof ClientData]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Check for duplicate company name (but ignore the current client)
      const { data: duplicateClient, error: duplicateCheckError } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('company_name', clientData.companyName)
        .neq('id', id)
        .maybeSingle();

      if (duplicateCheckError) {
        console.error('Error checking for duplicate client:', duplicateCheckError);
        return res.status(500).json({ error: 'Failed to validate company name uniqueness' });
      }

      // If a different client with the same name exists, return an error
      if (duplicateClient) {
        return res.status(409).json({ 
          error: 'Another client with this company name already exists',
          field: 'companyName'
        });
      }

      // Prepare client data for database update
      const dbClientData = {
        // Basic Details
        company_name: clientData.companyName,
        billing_name: clientData.billingName,
        short_code: clientData.shortCode,
        list_name: clientData.listName,
        website: clientData.website,
        client_manager: clientData.clientManager,
        sales_person: clientData.salesPerson,
        accounting_person: clientData.accountingPerson,
        merge_invoice: clientData.mergeInvoice,
        currency: clientData.currency,
        work_province: clientData.workProvince,
        
        // Contact Details
        contact_person_name1: clientData.contactPersonName1,
        email_address1: clientData.emailAddress1,
        mobile1: clientData.mobile1,
        contact_person_name2: clientData.contactPersonName2,
        email_address2: clientData.emailAddress2,
        invoice_cc2: clientData.invoiceCC2 || false,
        mobile2: clientData.mobile2,
        contact_person_name3: clientData.contactPersonName3,
        email_address3: clientData.emailAddress3,
        invoice_cc3: clientData.invoiceCC3 || false,
        mobile3: clientData.mobile3,
        dispatch_dept_email: clientData.dispatchDeptEmail,
        invoice_cc_dispatch: clientData.invoiceCCDispatch || false,
        accounts_dept_email: clientData.accountsDeptEmail,
        invoice_cc_accounts: clientData.invoiceCCAccounts || false,
        invoice_language: clientData.invoiceLanguage,
        
        // Address Details
        street_address1: clientData.streetAddress1,
        city1: clientData.city1,
        province1: clientData.province1,
        postal_code1: clientData.postalCode1,
        street_address2: clientData.streetAddress2,
        city2: clientData.city2,
        province2: clientData.province2,
        postal_code2: clientData.postalCode2,
        street_address3: clientData.streetAddress3,
        city3: clientData.city3,
        province3: clientData.province3,
        postal_code3: clientData.postalCode3,
        
        // Payment & Billings
        preferred_payment_method: clientData.preferredPaymentMethod,
        terms: clientData.terms,
        pay_cycle: clientData.payCycle,
        credit_limit: clientData.creditLimit,
        notes: clientData.notes,
        
        // Meta fields
        is_draft: false,
        updated_by_user_id: userId,
        updated_at: new Date().toISOString(),
      };

      // Update client in database
      const { data: updatedClient, error: updateError } = await supabase
        .from('clients')
        .update(dbClientData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating client:', updateError);
        return res.status(500).json({ error: 'Failed to update client' });
      }

      return res.status(200).json({
        success: true,
        message: 'Client updated successfully',
        client: updatedClient
      });
    } catch (error) {
      console.error('Unexpected error updating client:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Save client draft
 * PUT /api/clients/draft/:id
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
      const clientData: Partial<ClientData> = req.body;
      const { id } = req.params;
      
      // Check if we're updating an existing draft or creating a new one
      if (id) {
        // Check if the draft exists
        const { data: existingDraft, error: draftCheckError } = await supabase
          .from('client_drafts')
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
          ...clientData,
          is_draft: true,
          updated_at: new Date().toISOString(),
          updated_by_user_id: userId,
          last_updated: new Date().toISOString(),
        };

        // Convert camelCase to snake_case for database
        const dbUpdateData = Object.entries(updateData).reduce((acc, [key, value]) => {
          // Convert camelCase to snake_case using the helper function
          const snakeKey = camelToSnakeCase(key);
          acc[snakeKey] = value;
          return acc;
        }, {} as Record<string, any>);

        // Update the draft
        const { data: updatedDraft, error: updateError } = await supabase
          .from('client_drafts')
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
          draft: updatedDraft
        });
      } else {
        // Creating a new draft
        // Generate a new UUID for the draft
        const draftId = uuidv4();

        // Convert client data to snake_case for database
        const dbDraftData = Object.entries(clientData).reduce((acc, [key, value]) => {
          // Convert camelCase to snake_case using the helper function
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
          .from('client_drafts')
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
          draft: newDraft
        });
      }
    } catch (error) {
      console.error('Unexpected error saving draft:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Get latest client draft
 * GET /api/clients/draft
 * @access Private (Admin, Recruiter)
 */
router.get('/draft', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;

      // Get the latest draft for this user
      const { data: draft, error } = await supabase
        .from('client_drafts')
        .select('*')
        .eq('created_by_user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching draft:', error);
        return res.status(500).json({ error: 'Failed to fetch draft' });
      }

      // Convert snake_case to camelCase for frontend
      let clientDraft = null;
      
      if (draft) {
        clientDraft = Object.entries(draft).reduce((acc, [key, value]) => {
          // Convert snake_case to camelCase
          const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          acc[camelKey] = value;
          return acc;
        }, {} as Record<string, any>);
      }

      return res.status(200).json({
        draft: clientDraft,
        lastUpdated: draft?.last_updated || null
      });
    } catch (error) {
      console.error('Unexpected error fetching draft:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Delete a client
 * DELETE /api/clients/:id
 * @access Private (Admin only)
 */
router.delete('/:id', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if client exists
      const { data: existingClient, error: clientCheckError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (clientCheckError || !existingClient) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Delete client
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting client:', deleteError);
        return res.status(500).json({ error: 'Failed to delete client' });
      }

      return res.status(200).json({
        success: true,
        message: 'Client deleted successfully',
        deletedId: id
      });
    } catch (error) {
      console.error('Unexpected error deleting client:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Create a new client draft
 * POST /api/clients/draft
 * @access Private (Admin, Recruiter)
 */
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
      const clientData: Partial<ClientData> = req.body;
      
      // Generate a new UUID for the draft
      const draftId = uuidv4();

      // Convert client data to snake_case for database
      const dbDraftData = Object.entries(clientData).reduce((acc, [key, value]) => {
        // Convert camelCase to snake_case using the helper function
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
        .from('client_drafts')
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

/**
 * Update an existing client draft
 * PUT /api/clients/draft/:id
 * @access Private (Admin, Recruiter)
 */
router.put('/draft/:id', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  sanitizeInputs,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const clientData: Partial<ClientData> = req.body;
      const { id } = req.params;
      
      // Check if the draft exists
      const { data: existingDraft, error: draftCheckError } = await supabase
        .from('client_drafts')
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
        ...clientData,
        is_draft: true,
        updated_at: new Date().toISOString(),
        updated_by_user_id: userId,
        last_updated: new Date().toISOString(),
      };

      // Convert camelCase to snake_case for database
      const dbUpdateData = Object.entries(updateData).reduce((acc, [key, value]) => {
        // Convert camelCase to snake_case using the helper function
        const snakeKey = camelToSnakeCase(key);
        acc[snakeKey] = value;
        return acc;
      }, {} as Record<string, any>);

      // Update the draft
      const { data: updatedDraft, error: updateError } = await supabase
        .from('client_drafts')
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
    } catch (error) {
      console.error('Unexpected error updating draft:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Get client draft by ID
 * GET /api/clients/draft/:id
 * @access Private (Admin, Recruiter)
 */
router.get('/draft/:id', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const { id } = req.params;

      // Get the draft by ID
      const { data: draft, error } = await supabase
        .from('client_drafts')
        .select('*')
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

      // Convert snake_case to camelCase for frontend
      const clientDraft = Object.entries(draft).reduce((acc, [key, value]) => {
        // Convert snake_case to camelCase
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        acc[camelKey] = value;
        return acc;
      }, {} as Record<string, any>);

      return res.status(200).json({
        draft: clientDraft,
        lastUpdated: draft.last_updated || null
      });
    } catch (error) {
      console.error('Unexpected error fetching draft by ID:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Delete a client draft
 * DELETE /api/clients/draft/:id
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
        .from('client_drafts')
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
        .from('client_drafts')
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

export default router; 