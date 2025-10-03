import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { apiRateLimiter, sanitizeInputs } from '../middleware/security.js';
import { activityLogger } from '../middleware/activityLogger.js';
import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';
import { invoiceHtmlTemplate } from '../email-templates/invoice-html.js';
import { decode } from 'html-entities';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

// Helper to build version history entry
function createVersionEntry(userId: string, version: number, action: string) {
  return {
    version,
    updated_by: userId,
    updated_at: new Date().toISOString(),
    action
  };
}

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
  paymentTerms?: string;
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
  version_history?: any[]; // New field for version history
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
function transformToDbFormat(invoiceData: InvoiceData): DbInvoiceData {
  return {
    client_id: invoiceData.clientId,
    invoice_date: invoiceData.invoiceDate,
    due_date: invoiceData.dueDate,
    status: invoiceData.status || 'draft',
    currency: invoiceData.currency || 'CAD',
    subtotal: invoiceData.subtotal,
    total_tax: invoiceData.totalTax,
    total_hst: invoiceData.totalHst,
    total_gst: invoiceData.totalGst,
    total_qst: invoiceData.totalQst,
    grand_total: invoiceData.grandTotal,
    total_hours: invoiceData.totalHours,
    email_sent: invoiceData.emailSent || false,
    email_sent_date: invoiceData.emailSentDate,
    invoice_sent_to: invoiceData.invoice_sent_to,
    document_generated: invoiceData.documentGenerated || false,
    document_path: invoiceData.documentPath,
    document_file_name: invoiceData.documentFileName,
    document_file_size: invoiceData.documentFileSize,
    document_mime_type: invoiceData.documentMimeType,
    document_generated_at: invoiceData.documentGeneratedAt,
    invoice_data: {
      ...invoiceData.invoiceData,
      paymentTerms: invoiceData.paymentTerms
    }
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
  // apiRateLimiter,
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
  // apiRateLimiter,
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
  // apiRateLimiter,
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
      let clientId = invoiceData.clientId || newInvoice?.client_id;
      
      if (clientId) {
        try {
          const { data: client } = await supabase
            .from('clients')
            .select('company_name, short_code')
            .eq('id', clientId)
            .single();
          if (client) {
            clientName = client.company_name || client.short_code || 'Unknown Client';
          }
        } catch (error) {
          console.warn('Could not fetch client name for activity log');
        }
      }

      // Use created invoice data for accurate values, fallback to request data
      const finalGrandTotal = newInvoice?.grand_total ?? invoiceData.grandTotal ?? 0;
      const finalCurrency = newInvoice?.currency ?? invoiceData.currency ?? 'CAD';

      return {
        actionType: 'create_invoice',
        actionVerb: 'created',
        primaryEntityType: 'invoice',
        primaryEntityId: newInvoice?.id,
        primaryEntityName: `Invoice ${newInvoice?.invoice_number}`,
        secondaryEntityType: 'client',
        secondaryEntityId: clientId || null,
        secondaryEntityName: clientName,
        displayMessage: `Created invoice ${newInvoice?.invoice_number} for ${clientName} - $${finalGrandTotal.toFixed(2)} ${finalCurrency}`,
        category: 'financial',
        priority: 'normal' as const,
        metadata: {
          invoiceNumber: newInvoice?.invoice_number,
          invoiceDate: newInvoice?.invoice_date ?? invoiceData.invoiceDate,
          dueDate: newInvoice?.due_date ?? invoiceData.dueDate,
          status: newInvoice?.status ?? invoiceData.status ?? 'draft',
          currency: finalCurrency,
          subtotal: newInvoice?.subtotal ?? invoiceData.subtotal ?? 0,
          grandTotal: finalGrandTotal,
          totalHours: newInvoice?.total_hours ?? invoiceData.totalHours ?? 0
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
      const dbInvoiceData: Omit<DbInvoiceData, 'id' | 'created_at' | 'updated_at'> = {
        ...transformToDbFormat(invoiceData),
        // Use the invoice number from the request if provided, otherwise let DB generate
        invoice_number: invoiceData.invoiceNumber || undefined,
        created_by_user_id: userId,
        updated_by_user_id: userId,
        version: 1,
        version_history: [createVersionEntry(userId, 1, 'created')],
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
      
      // Get client name for display - check multiple sources for client ID
      let clientName = 'Unknown Client';
      let clientId = invoiceData.clientId || updatedInvoice?.client_id;
      
      if (clientId) {
        try {
          const { data: client } = await supabase
            .from('clients')
            .select('company_name, short_code')
            .eq('id', clientId)
            .single();
          if (client) {
            clientName = client.company_name || client.short_code || 'Unknown Client';
          }
        } catch (error) {
          console.warn('Could not fetch client name for activity log');
        }
      }

      // Use updated invoice data for accurate values, fallback to request data
      const finalGrandTotal = updatedInvoice?.grand_total ?? invoiceData.grandTotal ?? 0;
      const finalCurrency = updatedInvoice?.currency ?? invoiceData.currency ?? 'CAD';
      const finalStatus = updatedInvoice?.status ?? invoiceData.status ?? 'draft';

      return {
        actionType: 'update_invoice',
        actionVerb: 'updated',
        primaryEntityType: 'invoice',
        primaryEntityId: id,
        primaryEntityName: `Invoice ${updatedInvoice?.invoice_number}`,
        secondaryEntityType: 'client',
        secondaryEntityId: clientId || null,
        secondaryEntityName: clientName,
        displayMessage: `Updated invoice ${updatedInvoice?.invoice_number} for ${clientName} - $${finalGrandTotal.toFixed(2)} ${finalCurrency}`,
        category: 'financial',
        priority: 'normal' as const,
        metadata: {
          invoiceNumber: updatedInvoice?.invoice_number,
          invoiceDate: updatedInvoice?.invoice_date ?? invoiceData.invoiceDate,
          dueDate: updatedInvoice?.due_date ?? invoiceData.dueDate,
          status: finalStatus,
          currency: finalCurrency,
          subtotal: updatedInvoice?.subtotal ?? invoiceData.subtotal ?? 0,
          grandTotal: finalGrandTotal,
          totalHours: updatedInvoice?.total_hours ?? invoiceData.totalHours ?? 0
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

      // Versioning logic
      const versionedFields = [
        'clientId', 'invoiceDate', 'dueDate', 'status', 'currency', 'subtotal', 'totalTax', 'totalHst', 'totalGst', 'totalQst', 'grandTotal', 'totalHours', 'documentGenerated', 'documentPath', 'documentFileName', 'documentFileSize', 'documentMimeType', 'documentGeneratedAt', 'invoiceData'
      ];
      const isVersionedUpdate = Object.keys(invoiceData).some(key => versionedFields.includes(key));
      if (isVersionedUpdate) {
        const prevVersion = existingInvoice.version || 1;
        const newVersion = prevVersion + 1;
        updateData.version = newVersion;
        const prevHistory = Array.isArray(existingInvoice.version_history) ? existingInvoice.version_history : [];
        updateData.version_history = [...prevHistory, createVersionEntry(userId, newVersion, 'updated')];
      }

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
  authorizeRoles(['admin', 'recruiter']),
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
        displayMessage: `Deleted invoice ${deletedInvoice?.invoice_number} for ${clientName} - $${(deletedInvoice?.grand_total ?? 0).toFixed(2)} ${deletedInvoice?.currency || 'CAD'}`,
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
      const { documentPath, documentFileName, documentFileSize, documentGeneratedAt, documentMimeType, documentGenerated } = req.body;

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
          document_generated: documentGenerated,
          document_path: documentPath,
          document_file_name: documentFileName,
          document_file_size: documentFileSize,
          document_mime_type: documentMimeType,
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

/**
 * Fetch timesheets for a client within a date range
 * GET /api/invoices/timesheets-by-client/:clientId
 * @access Private (Admin, Recruiter)
 */
router.get('/timesheets-by-client/:clientId',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { clientId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      // Fetch timesheets for the client within the date range
      // Join with positions to filter by client, and with jobseeker_profiles to get jobseeker details
      const { data: timesheets, error } = await supabase
        .from('timesheets')
        .select(`
          id,
          jobseeker_profile_id,
          jobseeker_user_id,
          position_id,
          week_start_date,
          week_end_date,
          total_regular_hours,
          total_overtime_hours,
          regular_pay_rate,
          regular_bill_rate,
          overtime_pay_rate,
          overtime_bill_rate,
          total_jobseeker_pay,
          total_client_bill,
          overtime_enabled,
          bonus_amount,
          deduction_amount,
          invoice_number,
          positions!inner(
            id,
            title,
            position_code,
            position_number,
            client
          ),
          jobseeker_profiles!inner(
            id,
            first_name,
            last_name,
            email,
            employee_id
          )
        `)
        .eq('positions.client', clientId)
        .gte('week_start_date', startDate)
        .lte('week_end_date', endDate)
        .order('week_start_date', { ascending: true });

      if (error) {
        console.error('Error fetching timesheets:', error);
        return res.status(500).json({ error: 'Failed to fetch timesheets' });
      }

      // Transform the data to a more usable format
      const formattedTimesheets = (timesheets || []).map((timesheet: any) => ({
        id: timesheet.id,
        jobseekerProfileId: timesheet.jobseeker_profile_id,
        jobseekerUserId: timesheet.jobseeker_user_id,
        positionId: timesheet.position_id,
        weekStartDate: timesheet.week_start_date,
        weekEndDate: timesheet.week_end_date,
        totalRegularHours: parseFloat(timesheet.total_regular_hours) || 0,
        totalOvertimeHours: parseFloat(timesheet.total_overtime_hours) || 0,
        regularPayRate: parseFloat(timesheet.regular_pay_rate) || 0,
        regularBillRate: parseFloat(timesheet.regular_bill_rate) || 0,
        overtimePayRate: parseFloat(timesheet.overtime_pay_rate) || 0,
        overtimeBillRate: parseFloat(timesheet.overtime_bill_rate) || 0,
        totalJobseekerPay: parseFloat(timesheet.total_jobseeker_pay) || 0,
        totalClientBill: parseFloat(timesheet.total_client_bill) || 0,
        overtimeEnabled: timesheet.overtime_enabled,
        bonusAmount: parseFloat(timesheet.bonus_amount) || 0,
        deductionAmount: parseFloat(timesheet.deduction_amount) || 0,
        invoiceNumber: timesheet.invoice_number,
        position: {
          id: timesheet.positions.id,
          title: timesheet.positions.title,
          positionCode: timesheet.positions.position_code,
          positionNumber: timesheet.positions.position_number,
          clientId: timesheet.positions.client
        },
        jobseekerProfile: {
          id: timesheet.jobseeker_profiles.id,
          firstName: timesheet.jobseeker_profiles.first_name,
          lastName: timesheet.jobseeker_profiles.last_name,
          email: timesheet.jobseeker_profiles.email,
          employeeId: timesheet.jobseeker_profiles.employee_id
        }
      }));

      return res.status(200).json({
        success: true,
        timesheets: formattedTimesheets,
        count: formattedTimesheets.length
      });
    } catch (error) {
      console.error('Unexpected error fetching timesheets:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Send invoice email
 * POST /api/invoices/:id/send-email
 * @access Private (Admin, Recruiter)
 */
router.post('/:id/send-email',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  // apiRateLimiter,
  activityLogger({
    onSuccess: (req, res) => {
      const { id } = req.params;
      const { email } = req.body;
      const result = res.locals.invoiceSendResult || {};
      return {
        actionType: 'send_invoice_email',
        actionVerb: 'sent invoice email',
        primaryEntityType: 'invoice',
        primaryEntityId: id,
        primaryEntityName: result.invoiceNumber || result.invoice_number || id,
        secondaryEntityType: 'client',
        secondaryEntityId: result.clientId,
        secondaryEntityName: result.clientName,
        displayMessage: `Sent invoice ${result.invoiceNumber || result.invoice_number || id} to ${email}`,
        category: 'financial',
        priority: 'normal',
        metadata: {
          invoiceNumber: result.invoiceNumber || result.invoice_number,
          recipient: email,
          cc: result.cc,
          clientName: result.clientName,
        },
      };
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Recipient email is required' });

      // Fetch invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (invoiceError || !invoice) return res.status(404).json({ error: 'Invoice not found' });

      // Fetch client for CC logic
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', invoice.client_id)
        .maybeSingle();
      if (clientError || !client) return res.status(404).json({ error: 'Client not found' });

      // Build CC list
      const cc: string[] = [];
      if (client.invoice_cc2 && client.email_address2) cc.push(client.email_address2);
      if (client.invoice_cc3 && client.email_address3) cc.push(client.email_address3);
      if (client.invoice_cc_dispatch && client.dispatch_dept_email) cc.push(client.dispatch_dept_email);
      if (client.invoice_cc_accounts && client.accounts_dept_email) cc.push(client.accounts_dept_email);

      // Download PDF from Supabase Storage
      if (!invoice.document_path || !invoice.document_file_name) {
        return res.status(400).json({ error: 'Invoice PDF not found for this invoice' });
      }
      const { data: pdfData, error: pdfError } = await supabase.storage
        .from('invoices')
        .download(invoice.document_path.replace(/&#x2F;/g, '/'));
      if (pdfError || !pdfData) return res.status(500).json({ error: 'Failed to download invoice PDF' });
      // Read as buffer
      const pdfBuffer = Buffer.from(await pdfData.arrayBuffer());
      const pdfBase64 = pdfBuffer.toString('base64');

      // Prepare email content
      const html = invoiceHtmlTemplate({
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        clientName: client.company_name,
        clientEmail: client.email_address1,
        grandTotal: invoice.grand_total,
        currency: invoice.currency,
        messageOnInvoice: invoice.invoice_data?.messageOnInvoice,
      });
      const subject = `Invoice #${invoice.invoice_number} for ${client.company_name}`;

      // Prepare the main PDF attachment
      const attachments = [
        {
          content: pdfBase64,
          filename: decode(invoice.document_file_name),
          type: decode(invoice.document_mime_type || 'application/pdf'),
          disposition: 'attachment',
        }
      ];

      // Add additional attachments from invoice_data.attachments
      if (Array.isArray(invoice.invoice_data?.attachments)) {
        for (const att of invoice.invoice_data.attachments) {
          if (att.uploadStatus === 'uploaded' && att.filePath && att.fileName && att.bucketName) {
            try {
              const { data: fileData, error: fileError } = await supabase.storage
                .from(att.bucketName)
                .download(decode(att.filePath));
              if (fileError || !fileData) {
                console.error('[SendGrid] Failed to download attachment:', att.fileName, fileError);
                continue;
              }
              const fileBuffer = Buffer.from(await fileData.arrayBuffer());
              attachments.push({
                content: fileBuffer.toString('base64'),
                filename: decode(att.fileName),
                type: decode(att.fileType || 'application/octet-stream'),
                disposition: 'attachment',
              });
            } catch (err) {
              console.error('[SendGrid] Error downloading attachment:', att.fileName, err);
            }
          }
        }
      }

      const sendPayload = {
        to: email,
        cc: cc.length > 0 ? cc : undefined,
        from: process.env.DEFAULT_FROM_EMAIL as string,
        subject,
        html,
        attachments,
      };
      console.log('[SendGrid] Sending email with payload:', {
        to: sendPayload.to,
        from: sendPayload.from,
        subject: sendPayload.subject,
        cc: sendPayload.cc,
        attachments: sendPayload.attachments.map(a => ({ filename: a.filename, type: a.type, size: a.content.length }))
      });
      try {
        await sgMail.send(sendPayload);
      } catch (error: any) {
        console.error('[SendGrid] Error object:', error);
        if (error && typeof error === 'object' && 'response' in error && error.response && error.response.body && error.response.body.errors) {
          console.error('[SendGrid] Error details:', error.response.body.errors);
          return res.status(500).json({ error: 'Failed to send invoice email', details: error.response.body.errors });
        }
        return res.status(500).json({ error: 'Failed to send invoice email' });
      }

      // Update invoice email_sent fields (not version/version_history)
      await supabase
        .from('invoices')
        .update({
          email_sent: true,
          email_sent_date: new Date().toISOString(),
          invoice_sent_to: email,
        })
        .eq('id', id);

      // After successful send, set locals for activityLogger
      res.locals.invoiceSendResult = {
        invoiceNumber: invoice.invoice_number,
        clientId: client.id,
        clientName: client.company_name,
        cc,
      };

      return res.status(200).json({ success: true, message: 'Invoice email sent successfully' });
    } catch (error) {
      console.error('Error sending invoice email:', error);
      return res.status(500).json({ error: 'Failed to send invoice email' });
    }
  }
);

export default router;