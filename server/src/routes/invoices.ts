import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { apiRateLimiter, sanitizeInputs } from '../middleware/security.js';
import { activityLogger } from '../middleware/activityLogger.js';
import dotenv from 'dotenv';
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

// Types for invoice data
interface InvoiceData {
  clientId: string;
  invoiceDate: string;
  invoiceNumber?: string;
  dueDate: string;
  status?: string;
  currency?: string;
  subtotal: number;
  totalTax: number;
  totalHst?: number;
  totalGst?: number;
  totalQst?: number;
  grandTotal: number;
  totalHours: number;
  emailSent?: boolean;
  emailSentDate?: string;
  invoice_sent_to?: string;
  documentGenerated?: boolean;
  documentPath?: string;
  documentFileName?: string;
  documentFileSize?: number;
  documentMimeType?: string;
  documentGeneratedAt?: string;
  invoiceData: any; // Complete JSONB object from frontend
}

interface DbInvoiceData {
  id?: string;
  invoice_number?: string;
  client_id: string;
  invoice_date: string;
  due_date: string;
  status: string;
  currency: string;
  subtotal: number;
  total_tax: number;
  total_hst?: number;
  total_gst?: number;
  total_qst?: number;
  grand_total: number;
  total_hours: number;
  email_sent: boolean;
  email_sent_date?: string;
  invoice_sent_to?: string;
  document_generated: boolean;
  document_path?: string;
  document_file_name?: string;
  document_file_size?: number;
  document_mime_type?: string;
  document_generated_at?: string;
  invoice_data: any; // JSONB
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
 * Transform invoice data from camelCase to snake_case for database
 */
function transformToDbFormat(data: InvoiceData): Omit<DbInvoiceData, 'id' | 'invoice_number' | 'created_at' | 'updated_at' | 'version'> {
  return {
    client_id: data.clientId,
    invoice_date: data.invoiceDate,
    due_date: data.dueDate,
    status: data.status || 'draft',
    currency: data.currency || 'CAD',
    subtotal: data.subtotal,
    total_tax: data.totalTax,
    total_hst: data.totalHst || 0,
    total_gst: data.totalGst || 0,
    total_qst: data.totalQst || 0,
    grand_total: data.grandTotal,
    total_hours: data.totalHours,
    email_sent: data.emailSent || false,
    email_sent_date: data.emailSentDate || undefined,
    invoice_sent_to: data.invoice_sent_to || undefined,
    document_generated: data.documentGenerated || false,
    document_path: data.documentPath || undefined,
    document_file_name: data.documentFileName || undefined,
    document_file_size: data.documentFileSize || undefined,
    document_mime_type: data.documentMimeType || 'application/pdf',
    document_generated_at: data.documentGeneratedAt || undefined,
    invoice_data: data.invoiceData
  };
}

/**
 * Transform invoice data from snake_case to camelCase for frontend
 */
function transformToFrontendFormat(data: DbInvoiceData): any {
  const result: any = {};
  
  Object.entries(data).forEach(([key, value]) => {
    const camelKey = snakeToCamelCase(key);
    result[camelKey] = value;
  });
  
  return result;
}

/**
 * Generate next available invoice number
 * GET /api/invoices/generate-invoice-number
 * @access Private (Admin, Recruiter)
 */
router.get('/generate-invoice-number',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get all existing invoice numbers to find the lowest available number
      const { data: existingInvoices, error: fetchError } = await supabase
        .from('invoices')
        .select('invoice_number')
        .not('invoice_number', 'is', null)
        .order('invoice_number', { ascending: true });

      if (fetchError) {
        console.error('Error fetching existing invoice numbers:', fetchError);
        return res.status(500).json({ error: 'Failed to generate invoice number' });
      }

      // Extract numeric parts from existing invoice numbers and sort them
      const existingNumbers: number[] = [];
      
      if (existingInvoices && existingInvoices.length > 0) {
        for (const invoice of existingInvoices) {
          const invoiceNumber = invoice.invoice_number;
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
      }

      // Sort numbers to find gaps
      existingNumbers.sort((a, b) => a - b);

      // Find the lowest available number starting from 1
      let lowestAvailable = 1;
      
      for (const num of existingNumbers) {
        if (num === lowestAvailable) {
          lowestAvailable++;
        } else if (num > lowestAvailable) {
          // Found a gap, use the current lowestAvailable
          break;
        }
      }

      // Format as padded string without INV prefix
      const nextInvoiceNumber = lowestAvailable.toString().padStart(6, '0');

      // Double-check this number doesn't exist (race condition protection)
      const checkNumbers = [
        nextInvoiceNumber,
        `INV-${nextInvoiceNumber}`
      ];

      for (const checkNumber of checkNumbers) {
        const { data: existingInvoice, error: existingError } = await supabase
          .from('invoices')
          .select('id')
          .eq('invoice_number', checkNumber)
          .maybeSingle();

        if (existingError) {
          console.error('Error checking existing invoice number:', existingError);
          return res.status(500).json({ error: 'Failed to validate invoice number' });
        }

        if (existingInvoice) {
          // If this number exists, increment and try again
          lowestAvailable++;
          const newNumber = lowestAvailable.toString().padStart(6, '0');
          
          return res.status(200).json({
            success: true,
            invoiceNumber: newNumber
          });
        }
      }

      return res.status(200).json({
        success: true,
        invoiceNumber: nextInvoiceNumber
      });
    } catch (error) {
      console.error('Unexpected error generating invoice number:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Get all invoices with pagination and filtering
 * GET /api/invoices
 * @access Private (Admin, Recruiter, Jobseeker - own invoices only)
 */
router.get('/', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter', 'jobseeker']),
  apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const userType = req.user.user_metadata?.user_type;

      // Extract pagination and filter parameters from query
      const { 
        page = '1', 
        limit = '10', 
        searchTerm = '',
        clientFilter = '',
        clientEmailFilter = '',
        invoiceNumberFilter = '',
        dateRangeStart = '',
        dateRangeEnd = '',
        emailSentFilter = '',
        invoiceSentFilter = '',
        documentGeneratedFilter = ''
      } = req.query as {
        page?: string;
        limit?: string;
        searchTerm?: string;
        clientFilter?: string;
        clientEmailFilter?: string;
        invoiceNumberFilter?: string;
        dateRangeStart?: string;
        dateRangeEnd?: string;
        emailSentFilter?: string;
        invoiceSentFilter?: string;
        documentGeneratedFilter?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build the base query with joins for related data
      let baseQuery = supabase
        .from('invoices')
        .select(`
          *,
          clients!inner(id, company_name, short_code, email_address1)
        `);

      // Apply role-based filtering
      if (userType === 'jobseeker') {
        baseQuery = baseQuery.eq('created_by_user_id', userId);
      }

      // Apply all filters at database level
      baseQuery = applyInvoiceFilters(baseQuery, {
        searchTerm,
        clientFilter,
        clientEmailFilter,
        invoiceNumberFilter,
        dateRangeStart,
        dateRangeEnd,
        emailSentFilter,
        invoiceSentFilter,
        documentGeneratedFilter
      });

      // Get total count (unfiltered for user's access level)
      let totalCountQuery = supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });

      if (userType === 'jobseeker') {
        totalCountQuery = totalCountQuery.eq('created_by_user_id', userId);
      }

      const { count: totalCount, error: countError } = await totalCountQuery;

      if (countError) {
        console.error('Error getting total count:', countError);
        return res.status(500).json({ error: 'Failed to get total count of invoices' });
      }

      // Get filtered count
      let filteredCountQuery = supabase
        .from('invoices')
        .select(`
          *,
          clients!inner(id, company_name, short_code, email_address1)
        `, { count: 'exact', head: true });

      if (userType === 'jobseeker') {
        filteredCountQuery = filteredCountQuery.eq('created_by_user_id', userId);
      }

      filteredCountQuery = applyInvoiceFilters(filteredCountQuery, {
        searchTerm,
        clientFilter,
        clientEmailFilter,
        invoiceNumberFilter,
        dateRangeStart,
        dateRangeEnd,
        emailSentFilter,
        invoiceSentFilter,
        documentGeneratedFilter
      });

      const { count: filteredCount, error: filteredCountError } = await filteredCountQuery;

      if (filteredCountError) {
        console.error('Error getting filtered count:', filteredCountError);
        return res.status(500).json({ error: 'Failed to get filtered count of invoices' });
      }

      // Apply pagination and execute main query
      const { data: invoices, error } = await baseQuery
        .range(offset, offset + limitNum - 1)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching invoices:', error);
        return res.status(500).json({ error: 'Failed to fetch invoices' });
      }

      if (!invoices || invoices.length === 0) {
        return res.json({
          invoices: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount || 0,
            totalFiltered: filteredCount || 0,
            totalPages: Math.ceil((filteredCount || 0) / limitNum),
            hasNextPage: false,
            hasPrevPage: false
          }
        });
      }

      // Transform invoices to frontend format
      const formattedInvoices = invoices.map(invoice => {
        const formatted = transformToFrontendFormat(invoice);
        
        // Add related data
        formatted.client = invoice.clients;
        
        // Clean up the joined data from the main object
        delete formatted.clients;
        
        return formatted;
      });

      // Calculate pagination metadata
      const totalFiltered = filteredCount || 0;
      const totalPages = Math.ceil(totalFiltered / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      return res.status(200).json({
        invoices: formattedInvoices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount || 0,
          totalFiltered,
          totalPages,
          hasNextPage,
          hasPrevPage
        }
      });
    } catch (error) {
      console.error('Unexpected error fetching invoices:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Helper function to apply filters to a Supabase query
 */
function applyInvoiceFilters(query: any, filters: {
  searchTerm?: string;
  clientFilter?: string;
  clientEmailFilter?: string;
  invoiceNumberFilter?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  emailSentFilter?: string;
  invoiceSentFilter?: string;
  documentGeneratedFilter?: string;
}) {
  const {
    searchTerm,
    clientFilter,
    clientEmailFilter,
    invoiceNumberFilter,
    dateRangeStart,
    dateRangeEnd,
    emailSentFilter,
    invoiceSentFilter,
    documentGeneratedFilter
  } = filters;

  // Global search across multiple fields
  if (searchTerm && searchTerm.trim().length > 0) {
    const searchTermTrimmed = searchTerm.trim();
    query = query.or(`invoice_number.ilike.%${searchTermTrimmed}%,clients.company_name.ilike.%${searchTermTrimmed}%,clients.short_code.ilike.%${searchTermTrimmed}%,clients.email_address1.ilike.%${searchTermTrimmed}%`);
  }

  // Individual column filters
  if (clientFilter && clientFilter.trim().length > 0) {
    query = query.or(`clients.company_name.ilike.%${clientFilter.trim()}%,clients.short_code.ilike.%${clientFilter.trim()}%`);
  }
  if (clientEmailFilter && clientEmailFilter.trim().length > 0) {
    query = query.ilike('clients.email_address1', `%${clientEmailFilter.trim()}%`);
  }
  if (invoiceNumberFilter && invoiceNumberFilter.trim().length > 0) {
    query = query.ilike('invoice_number', `%${invoiceNumberFilter.trim()}%`);
  } 
  if (dateRangeStart && dateRangeStart.trim().length > 0) {
    query = query.gte('invoice_date', dateRangeStart.trim());
  }
  if (dateRangeEnd && dateRangeEnd.trim().length > 0) {
    query = query.lte('invoice_date', dateRangeEnd.trim());
  }
  if (emailSentFilter && emailSentFilter.trim().length > 0) {
    const emailSentBool = emailSentFilter.toLowerCase() === 'true';
    query = query.eq('email_sent', emailSentBool);
  }
  if (invoiceSentFilter && invoiceSentFilter.trim().length > 0) {
    // If you have a separate field for invoice sent, filter here. Otherwise, skip or map to email_sent.
    // For now, map to email_sent for demonstration.
    const invoiceSentBool = invoiceSentFilter.toLowerCase() === 'true';
    query = query.eq('email_sent', invoiceSentBool);
  }
  if (documentGeneratedFilter && documentGeneratedFilter.trim().length > 0) {
    const documentGeneratedBool = documentGeneratedFilter.toLowerCase() === 'true';
    query = query.eq('document_generated', documentGeneratedBool);
  }

  return query;
}

/**
 * Get a specific invoice by ID
 * GET /api/invoices/:id
 * @access Private (Admin, Recruiter, Jobseeker - own invoices only)
 */
router.get('/:id', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter', 'jobseeker']),
  apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const userType = req.user.user_metadata?.user_type;
      const { id } = req.params;

      // Build query with role-based filtering
      let query = supabase
        .from('invoices')
        .select(`
          *,
          clients!inner(id, company_name, short_code, email_address1, city1, province1, postal_code1)
        `)
        .eq('id', id);

      if (userType === 'jobseeker') {
        query = query.eq('created_by_user_id', userId);
      }

      const { data: invoice, error } = await query.maybeSingle();

      if (error) {
        console.error('Error fetching invoice:', error);
        return res.status(500).json({ error: 'Failed to fetch invoice' });
      }

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found or access denied' });
      }

      // Transform to frontend format
      const formatted = transformToFrontendFormat(invoice);
      formatted.client = invoice.clients;
      
      // Clean up joined data
      delete formatted.clients;

      return res.status(200).json(formatted);
    } catch (error) {
      console.error('Unexpected error fetching invoice:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Create a new invoice
 * POST /api/invoices
 * @access Private (Admin, Recruiter, Jobseeker)
 */
router.post('/', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter', 'jobseeker']),
  sanitizeInputs,
  activityLogger({
    onSuccess: async (req: Request, res: Response) => {
      const invoiceData = req.body;
      const newInvoice = res.locals.newInvoice;
      
      // Get client name for display
      let clientName = 'Unknown Client';
      if (invoiceData.clientId) {
        try {
          const { data: client } = await supabase
            .from('clients')
            .select('company_name, short_code')
            .eq('id', invoiceData.clientId)
            .single();
          if (client) {
            clientName = client.company_name || client.short_code || 'Unknown Client';
          }
        } catch (error) {
          console.warn('Could not fetch client name for activity log');
        }
      }

      return {
        actionType: 'create_invoice',
        actionVerb: 'created',
        primaryEntityType: 'invoice',
        primaryEntityId: newInvoice?.id,
        primaryEntityName: `Invoice ${newInvoice?.invoice_number}`,
        secondaryEntityType: 'client',
        secondaryEntityId: invoiceData.clientId,
        secondaryEntityName: clientName,
        displayMessage: `Created invoice ${newInvoice?.invoice_number} for ${clientName} - $${invoiceData.grandTotal} ${invoiceData.currency || 'CAD'}`,
        category: 'financial',
        priority: 'normal' as const,
        metadata: {
          invoiceNumber: newInvoice?.invoice_number,
          invoiceDate: invoiceData.invoiceDate,
          dueDate: invoiceData.dueDate,
          status: invoiceData.status || 'draft',
          currency: invoiceData.currency || 'CAD',
          subtotal: invoiceData.subtotal,
          grandTotal: invoiceData.grandTotal,
          totalHours: invoiceData.totalHours
        }
      };
    }
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const invoiceData: InvoiceData = req.body;
      
      // Validate required fields
      const requiredFields = [
        'clientId', 'invoiceDate', 'dueDate', 'subtotal', 
        'totalTax', 'grandTotal', 'totalHours', 'invoiceData'
      ];

      for (const field of requiredFields) {
        if (invoiceData[field as keyof InvoiceData] === undefined || invoiceData[field as keyof InvoiceData] === null) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Validate client exists
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', invoiceData.clientId)
        .maybeSingle();

      if (clientError || !client) {
        return res.status(400).json({ error: 'Invalid client ID' });
      }

      // Prepare invoice data for database
      const dbInvoiceData: Omit<DbInvoiceData, 'id' | 'created_at' | 'updated_at' | 'version'> = {
        ...transformToDbFormat(invoiceData),
        // Use the invoice number from the request if provided, otherwise let DB generate
        invoice_number: invoiceData.invoiceNumber || undefined,
        created_by_user_id: userId,
        updated_by_user_id: userId,
      };

      // Insert invoice into database
      const { data: newInvoice, error: insertError } = await supabase
        .from('invoices')
        .insert([dbInvoiceData])
        .select('*')
        .single();

      if (insertError) {
        console.error('Error creating invoice:', insertError);
        return res.status(500).json({ error: 'Failed to create invoice' });
      }

      // Store for activity logging
      res.locals.newInvoice = newInvoice;

      // Transform response to frontend format
      const formatted = transformToFrontendFormat(newInvoice);

      return res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        invoice: formatted
      });
    } catch (error) {
      console.error('Unexpected error creating invoice:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Update an existing invoice
 * PUT /api/invoices/:id
 * @access Private (Admin, Recruiter, Jobseeker - own draft invoices only)
 */
router.put('/:id', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter', 'jobseeker']),
  sanitizeInputs,
  activityLogger({
    onSuccess: async (req: Request, res: Response) => {
      const invoiceData = req.body;
      const updatedInvoice = res.locals.updatedInvoice;
      const { id } = req.params;
      
      // Get client name for display
      let clientName = 'Unknown Client';
      if (invoiceData.clientId) {
        try {
          const { data: client } = await supabase
            .from('clients')
            .select('company_name, short_code')
            .eq('id', invoiceData.clientId)
            .single();
          if (client) {
            clientName = client.company_name || client.short_code || 'Unknown Client';
          }
        } catch (error) {
          console.warn('Could not fetch client name for activity log');
        }
      }

      return {
        actionType: 'update_invoice',
        actionVerb: 'updated',
        primaryEntityType: 'invoice',
        primaryEntityId: id,
        primaryEntityName: `Invoice ${updatedInvoice?.invoice_number}`,
        secondaryEntityType: 'client',
        secondaryEntityId: invoiceData.clientId,
        secondaryEntityName: clientName,
        displayMessage: `Updated invoice ${updatedInvoice?.invoice_number} for ${clientName} - $${invoiceData.grandTotal} ${invoiceData.currency || 'CAD'}`,
        category: 'financial',
        priority: 'normal' as const,
        metadata: {
          invoiceNumber: updatedInvoice?.invoice_number,
          invoiceDate: invoiceData.invoiceDate,
          dueDate: invoiceData.dueDate,
          status: invoiceData.status || 'draft',
          currency: invoiceData.currency || 'CAD',
          subtotal: invoiceData.subtotal,
          grandTotal: invoiceData.grandTotal,
          totalHours: invoiceData.totalHours
        }
      };
    }
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const userType = req.user.user_metadata?.user_type;
      const { id } = req.params;
      const invoiceData: Partial<InvoiceData> = req.body;

      // Check if invoice exists and user has permission
      let existingQuery = supabase
        .from('invoices')
        .select('*')
        .eq('id', id);

      if (userType === 'jobseeker') {
        // Jobseekers can only update their own draft invoices
        existingQuery = existingQuery.eq('created_by_user_id', userId).eq('status', 'draft');
      } else if (userType === 'recruiter') {
        // Recruiters can update any invoice but not delete
        // No additional restriction needed here
      }
      // Admin can update any invoice

      const { data: existingInvoice, error: invoiceCheckError } = await existingQuery.maybeSingle();

      if (invoiceCheckError || !existingInvoice) {
        return res.status(404).json({ error: 'Invoice not found or access denied' });
      }

      // Additional validation for jobseekers - can only update draft invoices
      if (userType === 'jobseeker' && existingInvoice.status !== 'draft') {
        return res.status(403).json({ error: 'You can only update draft invoices' });
      }

      // Validate client if provided
      if (invoiceData.clientId) {
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('id')
          .eq('id', invoiceData.clientId)
          .maybeSingle();

        if (clientError || !client) {
          return res.status(400).json({ error: 'Invalid client ID' });
        }
      }

      // Prepare invoice data for database update
      const updateData: any = {};
      
      if (invoiceData.clientId) updateData.client_id = invoiceData.clientId;
      if (invoiceData.invoiceDate) updateData.invoice_date = invoiceData.invoiceDate;
      if (invoiceData.dueDate) updateData.due_date = invoiceData.dueDate;
      if (invoiceData.status) updateData.status = invoiceData.status;
      if (invoiceData.currency) updateData.currency = invoiceData.currency;
      if (invoiceData.subtotal !== undefined) updateData.subtotal = invoiceData.subtotal;
      if (invoiceData.totalTax !== undefined) updateData.total_tax = invoiceData.totalTax;
      if (invoiceData.totalHst !== undefined) updateData.total_hst = invoiceData.totalHst;
      if (invoiceData.totalGst !== undefined) updateData.total_gst = invoiceData.totalGst;
      if (invoiceData.totalQst !== undefined) updateData.total_qst = invoiceData.totalQst;
      if (invoiceData.grandTotal !== undefined) updateData.grand_total = invoiceData.grandTotal;
      if (invoiceData.totalHours !== undefined) updateData.total_hours = invoiceData.totalHours;
      if (invoiceData.emailSent !== undefined) updateData.email_sent = invoiceData.emailSent;
      if (invoiceData.emailSentDate) updateData.email_sent_date = invoiceData.emailSentDate;
      if (invoiceData.invoice_sent_to) updateData.invoice_sent_to = invoiceData.invoice_sent_to;
      if (invoiceData.documentGenerated !== undefined) updateData.document_generated = invoiceData.documentGenerated;
      if (invoiceData.documentPath) updateData.document_path = invoiceData.documentPath;
      if (invoiceData.documentFileName) updateData.document_file_name = invoiceData.documentFileName;
      if (invoiceData.documentFileSize) updateData.document_file_size = invoiceData.documentFileSize;
      if (invoiceData.documentMimeType) updateData.document_mime_type = invoiceData.documentMimeType;
      if (invoiceData.documentGeneratedAt) updateData.document_generated_at = invoiceData.documentGeneratedAt;
      if (invoiceData.invoiceData) updateData.invoice_data = invoiceData.invoiceData;

      updateData.updated_by_user_id = userId;

      // Update invoice in database
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Error updating invoice:', updateError);
        return res.status(500).json({ error: 'Failed to update invoice' });
      }

      // Store for activity logging
      res.locals.updatedInvoice = updatedInvoice;

      // Transform response to frontend format
      const formatted = transformToFrontendFormat(updatedInvoice);

      return res.status(200).json({
        success: true,
        message: 'Invoice updated successfully',
        invoice: formatted
      });
    } catch (error) {
      console.error('Unexpected error updating invoice:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Delete an invoice
 * DELETE /api/invoices/:id
 * @access Private (Admin only)
 */
router.delete('/:id', 
  authenticateToken, 
  authorizeRoles(['admin']),
  activityLogger({
    onSuccess: async (req: Request, res: Response) => {
      const { id } = req.params;
      const deletedInvoice = res.locals.deletedInvoice;
      
      // Get client name for display
      let clientName = 'Unknown Client';
      if (deletedInvoice?.client_id) {
        try {
          const { data: client } = await supabase
            .from('clients')
            .select('company_name, short_code')
            .eq('id', deletedInvoice.client_id)
            .single();
          if (client) {
            clientName = client.company_name || client.short_code || 'Unknown Client';
          }
        } catch (error) {
          console.warn('Could not fetch client name for activity log');
        }
      }

      return {
        actionType: 'delete_invoice',
        actionVerb: 'deleted',
        primaryEntityType: 'invoice',
        primaryEntityId: id,
        primaryEntityName: `Invoice ${deletedInvoice?.invoice_number}`,
        secondaryEntityType: 'client',
        secondaryEntityId: deletedInvoice?.client_id,
        secondaryEntityName: clientName,
        displayMessage: `Deleted invoice ${deletedInvoice?.invoice_number} for ${clientName} - $${deletedInvoice?.grand_total} ${deletedInvoice?.currency || 'CAD'}`,
        category: 'financial',
        priority: 'high' as const,
        metadata: {
          invoiceNumber: deletedInvoice?.invoice_number,
          invoiceDate: deletedInvoice?.invoice_date,
          dueDate: deletedInvoice?.due_date,
          status: deletedInvoice?.status,
          currency: deletedInvoice?.currency,
          subtotal: deletedInvoice?.subtotal,
          grandTotal: deletedInvoice?.grand_total,
          totalHours: deletedInvoice?.total_hours
        }
      };
    }
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;

      // Check if invoice exists
      const { data: existingInvoice, error: invoiceCheckError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (invoiceCheckError || !existingInvoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Store for activity logging
      res.locals.deletedInvoice = existingInvoice;

      // Delete invoice
      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting invoice:', deleteError);
        return res.status(500).json({ error: 'Failed to delete invoice' });
      }

      return res.status(200).json({
        success: true,
        message: 'Invoice deleted successfully',
        deletedId: id
      });
    } catch (error) {
      console.error('Unexpected error deleting invoice:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Update invoice document information (for PDF generation)
 * PATCH /api/invoices/:id/document
 * @access Private (Admin, Recruiter, System)
 */
router.patch('/:id/document', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  sanitizeInputs,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { documentPath, documentFileName, documentFileSize, documentGeneratedAt } = req.body;

      if (!documentPath) {
        return res.status(400).json({ error: 'Document path is required' });
      }

      // Check if invoice exists
      const { data: existingInvoice, error: invoiceCheckError } = await supabase
        .from('invoices')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (invoiceCheckError || !existingInvoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Update document information
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update({
          document_generated: true,
          document_path: documentPath,
          document_file_name: documentFileName,
          document_file_size: documentFileSize,
          document_generated_at: documentGeneratedAt || new Date().toISOString(),
          updated_by_user_id: req.user.id
        })
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Error updating invoice document:', updateError);
        return res.status(500).json({ error: 'Failed to update invoice document' });
      }

      // Transform response to frontend format
      const formatted = transformToFrontendFormat(updatedInvoice);

      return res.status(200).json({
        success: true,
        message: 'Invoice document updated successfully',
        invoice: formatted
      });
    } catch (error) {
      console.error('Unexpected error updating invoice document:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

export default router;