import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { sanitizeInputs, apiRateLimiter } from '../middleware/security.js';
import { activityLogger } from '../middleware/activityLogger.js';
import { emailNotifier } from '../middleware/emailNotifier.js';
import { consentHtmlTemplate, generateConsentTextTemplate } from '../email-templates/consent-html.js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { decode } from 'html-entities';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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

function hasUserMetadataRole(user: Request['user'] | undefined, role: string): boolean {
  const rawRoles = (user?.user_metadata as Record<string, unknown> | undefined)?.user_role;
  if (!Array.isArray(rawRoles)) {
    return false;
  }

  return rawRoles.some((userRole) => typeof userRole === 'string' && userRole === role);
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!hasUserMetadataRole(req.user, 'superadmin')) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Only super admins can create consent requests'
    });
  }

  return next();
}

/**
 * Convert snake_case to camelCase
 */
function snakeToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert an object's keys from snake_case to camelCase
 */
function convertObjectToCamelCase(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertObjectToCamelCase(item));
  }
  
  if (typeof obj === 'object') {
    const converted: any = {};
    Object.entries(obj).forEach(([key, value]) => {
      const camelKey = snakeToCamelCase(key);
      converted[camelKey] = convertObjectToCamelCase(value);
    });
    return converted;
  }
  
  return obj;
}

/**
 * Generate secure consent token
 */
function generateConsentToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate consent email content
 */
function generateConsentEmail(recipientName: string, documentName: string, consentUrl: string) {
  const templateVars = {
    recipientName,
    documentName,
    consentUrl
  };

  return {
    subject: `Digital Consent Request: ${documentName}`,
    html: consentHtmlTemplate(templateVars),
    text: generateConsentTextTemplate(templateVars)
  };
}

type ConsentMode = 'standard' | 'autofill';
type ConsentAutofillFieldType = 'consentedName' | 'consentDate';

interface ConsentAutofillField {
  id?: string;
  key?: ConsentAutofillFieldType;
  fieldType?: ConsentAutofillFieldType;
  label?: string;
  page: number;
  xPct: number;
  yPct: number;
  size?: number;
}

interface NormalizedConsentAutofillField {
  id: string;
  fieldType: ConsentAutofillFieldType;
  label?: string;
  page: number;
  xPct: number;
  yPct: number;
  size: number;
}

function decodeStoragePath(filePath: string): string {
  return decode(filePath)
    .replace(/&#x2F;/g, '/')
    .replace(/&#x5C;/g, '\\');
}

function sanitizeFileBaseName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '');
  const sanitized = withoutExtension
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return sanitized || 'consent_document';
}

function formatConsentDateForTemplate(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return dateIso;
  }

  return date.toISOString().slice(0, 10);
}

function parseConsentMode(value: unknown): ConsentMode {
  if (value === undefined || value === null || value === '') {
    return 'standard';
  }

  if (value === 'standard' || value === 'autofill') {
    return value;
  }

  throw new Error('Invalid consent mode. Expected "standard" or "autofill".');
}

function parseAutofillFieldType(value: unknown): ConsentAutofillFieldType {
  if (value === 'consentedName' || value === 'consentDate') {
    return value;
  }

  throw new Error('Template fields must include only Full Name and Consent Date.');
}

function parseAutofillFields(
  rawFields: unknown,
  options?: { requireBothTypes?: boolean }
): NormalizedConsentAutofillField[] {
  const requireBothTypes = options?.requireBothTypes ?? true;

  if (!Array.isArray(rawFields)) {
    throw new Error('Auto-fill mode requires template field setup.');
  }

  if (rawFields.length === 0) {
    throw new Error('Template setup must include at least one field.');
  }

  const normalizedFields: NormalizedConsentAutofillField[] = [];

  rawFields.forEach((rawField, index) => {
    if (!rawField || typeof rawField !== 'object') {
      throw new Error('Template fields are invalid.');
    }

    const field = rawField as ConsentAutofillField;

    const fieldType = parseAutofillFieldType(field.fieldType ?? field.key);

    const page = Number(field.page);
    const xPct = Number(field.xPct);
    const yPct = Number(field.yPct);
    const size = field.size === undefined ? 14 : Number(field.size);

    const isInvalidPage = !Number.isInteger(page) || page < 1;
    const isInvalidX = !Number.isFinite(xPct) || xPct < 0 || xPct > 1;
    const isInvalidY = !Number.isFinite(yPct) || yPct < 0 || yPct > 1;
    const isInvalidSize = !Number.isFinite(size) || size < 6 || size > 72;

    if (isInvalidPage || isInvalidX || isInvalidY || isInvalidSize) {
      throw new Error('Template field coordinates are invalid.');
    }

    normalizedFields.push({
      id:
        typeof field.id === 'string' && field.id.trim().length > 0
          ? field.id.trim()
          : `field_${index + 1}`,
      fieldType,
      label: typeof field.label === 'string' ? field.label : undefined,
      page,
      xPct,
      yPct,
      size
    });
  });

  const hasNameField = normalizedFields.some((field) => field.fieldType === 'consentedName');
  const hasDateField = normalizedFields.some((field) => field.fieldType === 'consentDate');

  if (requireBothTypes && (!hasNameField || !hasDateField)) {
    throw new Error('Template setup must include both Full Name and Consent Date fields.');
  }

  return normalizedFields;
}

async function generateFilledConsentPdf(params: {
  templateFilePath: string;
  originalFileName: string;
  recordId: string;
  consentedName: string;
  completedAt: string;
  autofillFields: NormalizedConsentAutofillField[];
}): Promise<{ filePath: string; fileName: string }> {
  const {
    templateFilePath,
    originalFileName,
    recordId,
    consentedName,
    completedAt,
    autofillFields
  } = params;

  const decodedTemplatePath = decodeStoragePath(templateFilePath);

  const { data: sourceFile, error: downloadError } = await supabase.storage
    .from('consent-documents')
    .download(decodedTemplatePath);

  if (downloadError || !sourceFile) {
    throw new Error(`Failed to read template document: ${downloadError?.message || 'Unknown error'}`);
  }

  const templateBytes = new Uint8Array(await sourceFile.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const autofillValues: Record<ConsentAutofillFieldType, string> = {
    consentedName: consentedName.trim(),
    consentDate: formatConsentDateForTemplate(completedAt)
  };

  autofillFields.forEach((field) => {
    const pageIndex = field.page - 1;
    const page = pages[pageIndex];

    if (!page) {
      throw new Error(`Template field "${field.fieldType}" references missing page ${field.page}.`);
    }

    const value = autofillValues[field.fieldType];
    if (!value) {
      return;
    }

    const { width, height } = page.getSize();
    const drawX = field.xPct * width;
    const drawY = height - (field.yPct * height);

    page.drawText(value, {
      x: drawX,
      y: drawY,
      size: field.size,
      font,
      color: rgb(0, 0, 0)
    });
  });

  const outputBytes = await pdfDoc.save();
  const safeBaseName = sanitizeFileBaseName(originalFileName);
  const outputFileName = `${safeBaseName}_consent_${recordId.slice(0, 8)}.pdf`;
  const outputPath = `filled-consents/${recordId}/${Date.now()}_${outputFileName}`;

  const { data: uploadedFile, error: uploadError } = await supabase.storage
    .from('consent-documents')
    .upload(outputPath, outputBytes, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Failed to store generated consent PDF: ${uploadError.message}`);
  }

  return {
    filePath: uploadedFile?.path || outputPath,
    fileName: outputFileName
  };
}

/**
 * Helper function to apply filters to a Supabase query for consent documents
 */
function applyConsentDocumentFilters(query: any, filters: {
  search?: string;
  fileNameFilter?: string;
  uploaderFilter?: string;
  statusFilter?: string;
  recipientTypeFilter?: string;
  dateFilter?: string;
}) {
  const {
    search,
    fileNameFilter,
    uploaderFilter,
    statusFilter,
    recipientTypeFilter,
    dateFilter
  } = filters;

  // Global search across multiple fields
  if (search && search.trim().length > 0) {
    const searchTerm = search.trim();
    query = query.or(`file_name.ilike.%${searchTerm}%,file_path.ilike.%${searchTerm}%`);
  }

  // Individual column filters
  if (fileNameFilter && fileNameFilter.trim().length > 0) {
    query = query.ilike('file_name', `%${fileNameFilter.trim()}%`);
  }

  if (statusFilter && statusFilter.trim().length > 0) {
    const status = statusFilter.trim().toLowerCase() === 'active';
    query = query.eq('is_active', status);
  }

  // Note: recipientTypeFilter will be handled in the main query with join

  // Date filters
  if (dateFilter) {
    const filterDate = new Date(dateFilter);
    const nextDay = new Date(filterDate);
    nextDay.setDate(nextDay.getDate() + 1);
    query = query.gte('created_at', filterDate.toISOString()).lt('created_at', nextDay.toISOString());
  }

  return query;
}

/**
 * Helper function to apply filters to consent records query
 */
function applyConsentRecordFilters(query: any, filters: {
  search?: string;
  statusFilter?: string;
  typeFilter?: string;
  nameFilter?: string;
  dateFilter?: string;
}) {
  const {
    search,
    statusFilter,
    typeFilter,
    nameFilter,
    dateFilter
  } = filters;

  // Global search
  if (search && search.trim().length > 0) {
    const searchTerm = search.trim();
    query = query.or(`consented_name.ilike.%${searchTerm}%`);
  }

  // Status filter
  if (statusFilter && statusFilter.trim().length > 0) {
    query = query.eq('status', statusFilter.trim());
  }

  // Type filter
  if (typeFilter && typeFilter.trim().length > 0) {
    query = query.eq('consentable_type', typeFilter.trim());
  }

  // Name filter
  if (nameFilter && nameFilter.trim().length > 0) {
    query = query.ilike('consented_name', `%${nameFilter.trim()}%`);
  }

  // Date filter
  if (dateFilter) {
    const filterDate = new Date(dateFilter);
    const nextDay = new Date(filterDate);
    nextDay.setDate(nextDay.getDate() + 1);
    query = query.gte('sent_at', filterDate.toISOString()).lt('sent_at', nextDay.toISOString());
  }

  return query;
}

/**
 * Get consent autofill templates
 * GET /api/consent/templates
 * @access Private (Admin, Recruiter)
 */
router.get('/templates',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  async (req: Request, res: Response) => {
    try {
      const {
        search = '',
        includeInactive = 'false'
      } = req.query as {
        search?: string;
        includeInactive?: string;
      };

      let query = supabase
        .from('consent_document_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (search.trim().length > 0) {
        const searchTerm = search.trim();
        query = query.or(
          `template_name.ilike.%${searchTerm}%,template_description.ilike.%${searchTerm}%,file_name.ilike.%${searchTerm}%`
        );
      }

      const shouldIncludeInactive =
        includeInactive === 'true' && req.user?.user_metadata?.user_type === 'admin';
      if (!shouldIncludeInactive) {
        query = query.eq('is_active', true);
      }

      const { data: templates, error } = await query;

      if (error) {
        console.error('Error fetching consent templates:', error);
        return res.status(500).json({ error: 'Failed to fetch consent templates' });
      }

      return res.status(200).json({
        templates: convertObjectToCamelCase(templates || [])
      });
    } catch (error) {
      console.error('Unexpected error fetching consent templates:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Create consent autofill template
 * POST /api/consent/templates
 * @access Private (Admin)
 */
router.post('/templates',
  authenticateToken,
  authorizeRoles(['admin']),
  sanitizeInputs,
  async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const {
        templateName,
        templateDescription,
        fileName,
        filePath,
        fieldMappings,
        isActive
      } = req.body;

      if (!templateName || typeof templateName !== 'string' || templateName.trim().length < 2) {
        return res.status(400).json({
          error: 'Template name must be at least 2 characters'
        });
      }

      if (!fileName || typeof fileName !== 'string' || !filePath || typeof filePath !== 'string') {
        return res.status(400).json({ error: 'Template document file name and path are required' });
      }

      if (!fileName.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'Consent templates support PDF documents only' });
      }

      let parsedFieldMappings: NormalizedConsentAutofillField[];
      try {
        parsedFieldMappings = parseAutofillFields(fieldMappings);
      } catch (error) {
        return res.status(400).json({
          error: error instanceof Error ? error.message : 'Invalid template field setup'
        });
      }

      const { data: createdTemplate, error: insertError } = await supabase
        .from('consent_document_templates')
        .insert({
          template_name: templateName.trim(),
          template_description:
            typeof templateDescription === 'string' && templateDescription.trim().length > 0
              ? templateDescription.trim()
              : null,
          file_name: fileName,
          file_path: filePath,
          field_mappings: parsedFieldMappings,
          is_active: isActive === false ? false : true,
          created_by: req.user.id
        })
        .select()
        .single();

      if (insertError || !createdTemplate) {
        console.error('Error creating consent template:', insertError);
        return res.status(500).json({ error: 'Failed to create consent template' });
      }

      return res.status(201).json({
        success: true,
        message: 'Consent template created successfully',
        template: convertObjectToCamelCase(createdTemplate)
      });
    } catch (error) {
      console.error('Unexpected error creating consent template:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Delete consent autofill template
 * DELETE /api/consent/templates/:templateId
 * @access Private (Admin)
 */
router.delete('/templates/:templateId',
  authenticateToken,
  authorizeRoles(['admin']),
  sanitizeInputs,
  async (req: Request, res: Response) => {
    try {
      const { templateId } = req.params;

      if (!templateId || templateId.trim().length === 0) {
        return res.status(400).json({ error: 'Template ID is required' });
      }

      const { data: existingTemplate, error: fetchError } = await supabase
        .from('consent_document_templates')
        .select('id, template_name')
        .eq('id', templateId.trim())
        .maybeSingle();

      if (fetchError) {
        console.error('Error validating consent template before delete:', fetchError);
        return res.status(500).json({ error: 'Failed to validate consent template' });
      }

      if (!existingTemplate) {
        return res.status(404).json({ error: 'Consent template not found' });
      }

      const { error: deleteError } = await supabase
        .from('consent_document_templates')
        .delete()
        .eq('id', templateId.trim());

      if (deleteError) {
        console.error('Error deleting consent template:', deleteError);
        return res.status(500).json({ error: 'Failed to delete consent template' });
      }

      return res.status(200).json({
        success: true,
        message: 'Consent template deleted successfully',
        deletedId: templateId.trim()
      });
    } catch (error) {
      console.error('Unexpected error deleting consent template:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Get all consent documents with pagination and filtering
 * GET /api/consent/documents
 * @access Private (Admin, Recruiter)
 */
router.get('/documents',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  // apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      // Extract pagination and filter parameters from query
      const {
        page = '1',
        limit = '10',
        search = '',
        fileNameFilter = '',
        uploaderFilter = '',
        statusFilter = '',
        recipientTypeFilter = '',
        dateFilter = ''
      } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
        fileNameFilter?: string;
        uploaderFilter?: string;
        statusFilter?: string;
        recipientTypeFilter?: string;
        dateFilter?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build the base query
      let baseQuery = supabase
        .from('consent_documents')
        .select('*');

      // Handle search for uploader emails/names separately since we can't JOIN with auth.users
      let uploaderUserIds: string[] = [];
      if (search && search.trim().length > 0) {
        try {
          // Search for users whose email or name contains the search term
          const { data: matchingUsers, error: userSearchError } = await supabase.auth.admin.listUsers();
          
          if (!userSearchError && matchingUsers?.users) {
            const searchTerm = search.trim().toLowerCase();
            uploaderUserIds = matchingUsers.users
              .filter(user => {
                const email = user.email?.toLowerCase() || '';
                const name = user.user_metadata?.name?.toLowerCase() || '';
                const fullName = user.user_metadata?.full_name?.toLowerCase() || '';
                
                return email.includes(searchTerm) || 
                       name.includes(searchTerm) || 
                       fullName.includes(searchTerm);
              })
              .map(user => user.id);
          }
        } catch (error) {
          console.error('Error searching users:', error);
          // Continue with document search even if user search fails
        }
      }

      // Apply other filters (except recipientTypeFilter and search which we handle separately)
      baseQuery = applyConsentDocumentFilters(baseQuery, {
        search: uploaderUserIds.length > 0 ? '' : search, // Don't apply search in filter if we're handling uploader search
        fileNameFilter,
        uploaderFilter,
        statusFilter,
        recipientTypeFilter: '', // Don't apply this filter at DB level
        dateFilter
      });

      // If we found matching uploaders, add them to the query
      if (uploaderUserIds.length > 0 && search && search.trim().length > 0) {
        // Combine document field search with uploader search
        const searchTerm = search.trim();
        baseQuery = baseQuery.or(`file_name.ilike.%${searchTerm}%,file_path.ilike.%${searchTerm}%,uploaded_by.in.(${uploaderUserIds.join(',')})`);
      } else if (uploaderUserIds.length > 0) {
        // Only uploader search (no document field search)
        baseQuery = baseQuery.in('uploaded_by', uploaderUserIds);
      }

      // Get total count (unfiltered)
      const { count: totalCount, error: countError } = await supabase
        .from('consent_documents')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('Error getting total count:', countError);
        return res.status(500).json({ error: 'Failed to get total count of consent documents' });
      }

      // Get filtered count
      let filteredCountQuery = supabase
        .from('consent_documents')
        .select('*', { count: 'exact', head: true });

      filteredCountQuery = applyConsentDocumentFilters(filteredCountQuery, {
        search: uploaderUserIds.length > 0 ? '' : search, // Don't apply search in filter if we're handling uploader search
        fileNameFilter,
        uploaderFilter,
        statusFilter,
        recipientTypeFilter: '', // Don't apply this filter at DB level
        dateFilter
      });

      // Apply the same uploader search logic to filtered count query
      if (uploaderUserIds.length > 0 && search && search.trim().length > 0) {
        const searchTerm = search.trim();
        filteredCountQuery = filteredCountQuery.or(`file_name.ilike.%${searchTerm}%,file_path.ilike.%${searchTerm}%,uploaded_by.in.(${uploaderUserIds.join(',')})`);
      } else if (uploaderUserIds.length > 0) {
        filteredCountQuery = filteredCountQuery.in('uploaded_by', uploaderUserIds);
      }

      const { count: filteredCount, error: filteredCountError } = await filteredCountQuery;

      if (filteredCountError) {
        console.error('Error getting filtered count:', filteredCountError);
        return res.status(500).json({ error: 'Failed to get filtered count of consent documents' });
      }

      // Apply pagination and execute main query
      const { data: documents, error } = await baseQuery
        .range(offset, offset + limitNum - 1)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching consent documents:', error);
        return res.status(500).json({ error: 'Failed to fetch consent documents' });
      }

      if (!documents || documents.length === 0) {
        return res.json({
          documents: [],
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

      // Get uploader details and process recipient type for each document
      const documentsWithUploaders = await Promise.all(
        documents.map(async (doc) => {
          let uploaderName = 'Unknown';
          let uploaderEmail = '';
          let consentTemplate: { id: string; template_name: string } | null = null;
          
          try {
            const { data: user } = await supabase.auth.admin.getUserById(doc.uploaded_by);
            if (user?.user) {
              uploaderEmail = user.user.email || '';
              uploaderName = user.user.user_metadata?.name || 
                           user.user.user_metadata?.full_name || 
                           uploaderEmail.split('@')[0];
            }
          } catch (error) {
            console.error('Error fetching uploader details:', error);
          }

          if (doc.template_id) {
            const { data: templateData, error: templateError } = await supabase
              .from('consent_document_templates')
              .select('id, template_name')
              .eq('id', doc.template_id)
              .maybeSingle();

            if (templateError) {
              console.error('Error fetching consent template summary:', templateError);
            } else if (templateData) {
              consentTemplate = templateData;
            }
          }

          // Get recipient statistics and type for this document
          const { data: recipientStats, error: statsError } = await supabase
            .from('consent_records')
            .select('status, consentable_type')
            .eq('document_id', doc.id);

          let totalRecipients = 0;
          let completedRecipients = 0;
          let recipientType = null;
          
          if (!statsError && recipientStats && recipientStats.length > 0) {
            totalRecipients = recipientStats.length;
            completedRecipients = recipientStats.filter(record => record.status === 'completed').length;
            // Since each document is for one recipient type, just get the first one
            recipientType = recipientStats[0].consentable_type;
          }

          return {
            ...doc,
            recipient_type: recipientType,
            total_recipients: totalRecipients,
            completed_recipients: completedRecipients,
            uploader: {
              id: doc.uploaded_by,
              email: uploaderEmail,
              name: uploaderName
            },
            consent_template: consentTemplate
          };
        })
      );

      // Calculate pagination metadata
      const totalFiltered = filteredCount || 0;
      const totalPages = Math.ceil(totalFiltered / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      // Apply recipient type filter if provided
      let filteredDocuments = documentsWithUploaders;
      if (recipientTypeFilter && recipientTypeFilter.trim().length > 0) {
        filteredDocuments = documentsWithUploaders.filter(doc => 
          doc.recipient_type === recipientTypeFilter.trim()
        );
      }

      // Convert snake_case to camelCase for frontend
      const formattedDocuments = filteredDocuments.map(doc => convertObjectToCamelCase(doc));

      return res.status(200).json({
        documents: formattedDocuments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount || 0,
          totalFiltered: filteredDocuments.length,
          totalPages: Math.ceil(filteredDocuments.length / limitNum),
          hasNextPage: pageNum < Math.ceil(filteredDocuments.length / limitNum),
          hasPrevPage: pageNum > 1
        }
      });
    } catch (error) {
      console.error('Unexpected error fetching consent documents:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Get consent records for a specific document with pagination and filtering
 * GET /api/consent/records/:documentId
 * @access Private (Admin, Recruiter)
 */
router.get('/records/:documentId',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  // apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      
      // Extract pagination and filter parameters from query
      const {
        page = '1',
        limit = '10',
        search = '',
        statusFilter = '',
        typeFilter = '',
        nameFilter = '',
        dateFilter = ''
      } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
        statusFilter?: string;
        typeFilter?: string;
        nameFilter?: string;
        dateFilter?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Check if document exists
      const { data: document, error: docError } = await supabase
        .from('consent_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        return res.status(404).json({ error: 'Consent document not found' });
      }

      let documentWithTemplate: Record<string, unknown> = { ...document };
      if (document.template_id) {
        const { data: templateData, error: templateError } = await supabase
          .from('consent_document_templates')
          .select('id, template_name')
          .eq('id', document.template_id)
          .maybeSingle();

        if (templateError) {
          console.error('Error fetching consent template for document:', templateError);
        } else if (templateData) {
          documentWithTemplate = {
            ...documentWithTemplate,
            consent_template: templateData
          };
        }
      }

      // Build the base query
      let baseQuery = supabase
        .from('consent_records')
        .select('*')
        .eq('document_id', documentId);

      // Apply filters
      baseQuery = applyConsentRecordFilters(baseQuery, {
        search,
        statusFilter,
        typeFilter,
        nameFilter,
        dateFilter
      });

      // Get total count (unfiltered)
      const { count: totalCount, error: countError } = await supabase
        .from('consent_records')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId);

      if (countError) {
        console.error('Error getting total count:', countError);
        return res.status(500).json({ error: 'Failed to get total count of consent records' });
      }

      // Get filtered count
      let filteredCountQuery = supabase
        .from('consent_records')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId);

      filteredCountQuery = applyConsentRecordFilters(filteredCountQuery, {
        search,
        statusFilter,
        typeFilter,
        nameFilter,
        dateFilter
      });

      const { count: filteredCount, error: filteredCountError } = await filteredCountQuery;

      if (filteredCountError) {
        console.error('Error getting filtered count:', filteredCountError);
        return res.status(500).json({ error: 'Failed to get filtered count of consent records' });
      }

      // Apply pagination and execute main query
      const { data: records, error } = await baseQuery
        .range(offset, offset + limitNum - 1)
        .order('sent_at', { ascending: false });

      if (error) {
        console.error('Error fetching consent records:', error);
        return res.status(500).json({ error: 'Failed to fetch consent records' });
      }

      // Get entity details for each record
      const recordsWithDetails = await Promise.all(
        (records || []).map(async (record) => {
          let entityName = 'Unknown';
          let entityEmail = '';
          
          try {
            if (record.consentable_type === 'client') {
              const { data: client } = await supabase
                .from('clients')
                .select('company_name, email_address1')
                .eq('id', record.consentable_id)
                .single();
              
              if (client) {
                entityName = client.company_name;
                entityEmail = client.email_address1;
              }
            } else if (record.consentable_type === 'jobseeker_profile') {
              const { data: jobseeker } = await supabase
                .from('jobseeker_profiles')
                .select('first_name, last_name, email')
                .eq('id', record.consentable_id)
                .single();
              
              if (jobseeker) {
                entityName = `${jobseeker.first_name} ${jobseeker.last_name}`;
                entityEmail = jobseeker.email;
              }
            }
          } catch (error) {
            console.error('Error fetching entity details:', error);
          }

          return {
            ...record,
            entityName,
            entityEmail
          };
        })
      );

      // Calculate pagination metadata
      const totalFiltered = filteredCount || 0;
      const totalPages = Math.ceil(totalFiltered / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      // Convert snake_case to camelCase for frontend
      const formattedRecords = recordsWithDetails.map(record => convertObjectToCamelCase(record));

      return res.status(200).json({
        document: convertObjectToCamelCase(documentWithTemplate),
        records: formattedRecords,
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
      console.error('Unexpected error fetching consent records:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Create a new consent request
 * POST /api/consent/request
 * @access Private (Super Admin only)
 */
router.post('/request',
  authenticateToken,
  requireSuperAdmin,
  sanitizeInputs,
  emailNotifier({
    onSuccessEmail: async (req, res) => {
      const records = res.locals.consentRecords;
      const document = res.locals.consentDocument;
      const clientURL = process.env.CLIENT_URL || 'http://localhost:5173';
      
      if (!records || !document) return null;

      const emailPromises = records.map(async (record: any) => {
        let recipientName = 'Unknown';
        let recipientEmail = '';
        
        try {
          if (record.consentable_type === 'client') {
            const { data: client } = await supabase
              .from('clients')
              .select('company_name, email_address1')
              .eq('id', record.consentable_id)
              .single();
            
            if (client) {
              recipientName = client.company_name;
              recipientEmail = client.email_address1;
            }
          } else if (record.consentable_type === 'jobseeker_profile') {
            const { data: jobseeker } = await supabase
              .from('jobseeker_profiles')
              .select('first_name, last_name, email')
              .eq('id', record.consentable_id)
              .single();
            
            if (jobseeker) {
              recipientName = `${jobseeker.first_name} ${jobseeker.last_name}`;
              recipientEmail = jobseeker.email;
            }
          }
        } catch (error) {
          console.error('Error fetching recipient details:', error);
        }

        if (!recipientEmail) return null;

        const consentUrl = `${clientURL}/consent?token=${record.consent_token}`;
        const emailContent = generateConsentEmail(recipientName, document.file_name, consentUrl);
        
        return {
          to: recipientEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        };
      });

      const emails = await Promise.all(emailPromises);
      return emails.filter((email: any) => email !== null);
    }
  }),
  activityLogger({
    onSuccess: (req, res) => ({
      actionType: 'create_consent_request',
      actionVerb: 'created',
      primaryEntityType: 'consent_document',
      primaryEntityId: res.locals.consentDocument?.id,
      primaryEntityName: res.locals.consentDocument?.file_name || req.body.fileName || 'Consent Document',
      displayMessage: `Created consent request "${res.locals.consentDocument?.file_name || req.body.fileName || 'Consent Document'}" for ${res.locals.recipientCount || 0} recipients`,
      category: 'consent_management',
      priority: 'normal',
      metadata: {
        fileName: res.locals.consentDocument?.file_name || req.body.fileName,
        recipientCount: res.locals.recipientCount,
        recipientType: req.body.recipientType,
        consentMode: req.body.consentMode || 'standard',
        templateId: req.body.templateId || null
      }
    })
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const {
        fileName: rawFileName,
        filePath: rawFilePath,
        recipientIds,
        recipientType,
        consentMode: rawConsentMode,
        templateId: rawTemplateId,
        autofillFields: rawAutofillFields
      } = req.body;

      // Validate required fields
      if (!recipientIds || !recipientType) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
        return res.status(400).json({ error: 'Recipients must be a non-empty array' });
      }

      if (!['client', 'jobseeker_profile'].includes(recipientType)) {
        return res.status(400).json({ error: 'Invalid recipient type' });
      }

      let consentMode: ConsentMode;
      try {
        consentMode = parseConsentMode(rawConsentMode);
      } catch (error) {
        return res.status(400).json({
          error: error instanceof Error ? error.message : 'Invalid consent mode'
        });
      }

      let fileName = typeof rawFileName === 'string' ? rawFileName : '';
      let filePath = typeof rawFilePath === 'string' ? rawFilePath : '';
      let templateId: string | null = null;
      let autofillFields: NormalizedConsentAutofillField[] = [];
      if (consentMode === 'standard') {
        if (!fileName || !filePath) {
          return res.status(400).json({ error: 'Missing required fields' });
        }
      } else {
        if (typeof rawTemplateId === 'string' && rawTemplateId.trim().length > 0) {
          templateId = rawTemplateId.trim();

          const { data: selectedTemplate, error: templateError } = await supabase
            .from('consent_document_templates')
            .select('id, file_name, file_path, field_mappings, is_active')
            .eq('id', templateId)
            .maybeSingle();

          if (templateError) {
            console.error('Error validating consent template:', templateError);
            return res.status(500).json({ error: 'Failed to validate consent template' });
          }

          if (!selectedTemplate) {
            return res.status(400).json({ error: 'Selected consent template was not found' });
          }

          if (!selectedTemplate.is_active) {
            return res.status(400).json({ error: 'Selected consent template is inactive' });
          }

          fileName = selectedTemplate.file_name;
          filePath = selectedTemplate.file_path;

          try {
            autofillFields = parseAutofillFields(selectedTemplate.field_mappings);
          } catch (error) {
            return res.status(400).json({
              error: error instanceof Error ? error.message : 'Invalid template field setup'
            });
          }
        } else {
          if (!fileName || !filePath) {
            return res.status(400).json({
              error: 'Auto-fill mode requires a selected template'
            });
          }

          try {
            autofillFields = parseAutofillFields(rawAutofillFields);
          } catch (error) {
            return res.status(400).json({
              error: error instanceof Error ? error.message : 'Invalid template field setup'
            });
          }
        }

        if (!fileName.toLowerCase().endsWith('.pdf')) {
          return res.status(400).json({
            error: 'Auto-fill mode supports PDF documents only'
          });
        }
      }

      // Create consent document
      const { data: consentDocument, error: docError } = await supabase
        .from('consent_documents')
        .insert({
          file_name: fileName,
          file_path: filePath,
          consent_mode: consentMode,
          autofill_fields: autofillFields,
          template_id: templateId,
          uploaded_by: userId,
          is_active: true
        })
        .select()
        .single();

      if (docError) {
        console.error('Error creating consent document:', docError);
        return res.status(500).json({ error: 'Failed to create consent document' });
      }

      // Create consent records for each recipient
      const consentRecords = recipientIds.map(recipientId => ({
        document_id: consentDocument.id,
        consentable_id: recipientId,
        consentable_type: recipientType,
        status: 'pending',
        consent_token: generateConsentToken()
      }));

      const { data: records, error: recordsError } = await supabase
        .from('consent_records')
        .insert(consentRecords)
        .select();

      if (recordsError) {
        console.error('Error creating consent records:', recordsError);
        // Clean up document if records creation failed
        await supabase.from('consent_documents').delete().eq('id', consentDocument.id);
        return res.status(500).json({ error: 'Failed to create consent records' });
      }

      // Store data for activity logging and email notification
      res.locals.consentDocument = consentDocument;
      res.locals.consentRecords = records;
      res.locals.recipientCount = recipientIds.length;

      // Console log the unique consent links for testing
      console.log('\n🔗 CONSENT LINKS GENERATED:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      records.forEach((record: any, index: number) => {
        const clientURL = process.env.CLIENT_URL || 'http://localhost:5173';
        const consentUrl = `${clientURL}/consent?token=${record.consent_token}`;
        console.log(`${index + 1}. ${record.entityName || 'Unknown'} (${record.entityEmail || 'No Email'}):`);
        console.log(`   🌐 ${consentUrl}`);
        console.log(`   🎫 Token: ${record.consent_token}`);
        console.log('');
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📧 Total ${records.length} consent emails should be sent.\n`);

      return res.status(201).json({
        success: true,
        message: 'Consent request created successfully',
        document: convertObjectToCamelCase(consentDocument),
        recordCount: records?.length || 0
      });
    } catch (error) {
      console.error('Unexpected error creating consent request:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Resend consent emails
 * POST /api/consent/resend
 * @access Private (Admin, Recruiter)
 */
router.post('/resend',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  sanitizeInputs,
  emailNotifier({
    onSuccessEmail: async (req, res) => {
      const records = res.locals.consentRecordsWithDetails;
      const clientURL = process.env.CLIENT_URL || 'http://localhost:5173';
      
      if (!records) return null;

      const emails = records.map((record: any) => {
        if (!record.entityEmail) return null;

        const consentUrl = `${clientURL}/consent?token=${record.consent_token}`;
        const emailContent = generateConsentEmail(record.entityName, record.document_name, consentUrl);
        
        return {
          to: record.entityEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        };
      });

      return emails.filter((email: any) => email !== null);
    }
  }),
  activityLogger({
    onSuccess: (req, res) => ({
      actionType: 'resend_consent_request',
      actionVerb: 'resent',
      primaryEntityType: 'consent_record',
      primaryEntityId: undefined,
      primaryEntityName: `${req.body.recordIds?.length || 0} consent emails`,
      displayMessage: `Resent ${req.body.recordIds?.length || 0} consent emails`,
      category: 'consent_management',
      priority: 'normal',
      metadata: {
        recordIds: req.body.recordIds,
        recordCount: req.body.recordIds?.length || 0
      }
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const { recordIds } = req.body;

      // Validate required fields
      if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
        return res.status(400).json({ error: 'Record IDs must be a non-empty array' });
      }

      // Get the consent records with document details
      const { data: records, error: recordsError } = await supabase
        .from('consent_records')
        .select(`
          *,
          consent_documents!inner(
            id,
            file_name,
            file_path,
            consent_mode,
            autofill_fields,
            template_id,
            version,
            created_at,
            is_active
          )
        `)
        .in('id', recordIds);

      if (recordsError) {
        console.error('Error fetching consent records:', recordsError);
        return res.status(500).json({ error: 'Failed to fetch consent records' });
      }

      if (!records || records.length === 0) {
        return res.status(404).json({ error: 'No consent records found' });
      }

      // Get entity details for each record for email sending
      const recordsWithDetails = await Promise.all(
        records.map(async (record) => {
          let entityName = 'Unknown';
          let entityEmail = '';
          
          try {
            if (record.consentable_type === 'client') {
              const { data: client } = await supabase
                .from('clients')
                .select('company_name, email_address1')
                .eq('id', record.consentable_id)
                .single();
              
              if (client) {
                entityName = client.company_name;
                entityEmail = client.email_address1;
              }
            } else if (record.consentable_type === 'jobseeker_profile') {
              const { data: jobseeker } = await supabase
                .from('jobseeker_profiles')
                .select('first_name, last_name, email')
                .eq('id', record.consentable_id)
                .single();
              
              if (jobseeker) {
                entityName = `${jobseeker.first_name} ${jobseeker.last_name}`;
                entityEmail = jobseeker.email;
              }
            }
          } catch (error) {
            console.error('Error fetching entity details:', error);
          }

          return {
            ...record,
            entityName,
            entityEmail,
            document_name: record.consent_documents.file_name
          };
        })
      );

      // Update sent_at timestamp for the records
      const { error: updateError } = await supabase
        .from('consent_records')
        .update({ sent_at: new Date().toISOString() })
        .in('id', recordIds);

      if (updateError) {
        console.error('Error updating consent records:', updateError);
        return res.status(500).json({ error: 'Failed to update consent records' });
      }

      // Store data for email notification
      res.locals.consentRecordsWithDetails = recordsWithDetails;

      // Console log the resent consent links for testing
      console.log('\n🔄 CONSENT LINKS RESENT:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      recordsWithDetails.forEach((record: any, index: number) => {
        const clientURL = process.env.CLIENT_URL || 'http://localhost:5173';
        const consentUrl = `${clientURL}/consent?token=${record.consent_token}`;
        console.log(`${index + 1}. ${record.entityName || 'Unknown'} (${record.entityEmail || 'No Email'}):`);
        console.log(`   🌐 ${consentUrl}`);
        console.log(`   🎫 Token: ${record.consent_token}`);
        console.log(`   📄 Document: ${record.consent_documents?.file_name || 'Unknown'}`);
        console.log('');
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📧 Total ${recordsWithDetails.length} consent emails should be resent.\n`);

      return res.status(200).json({
        success: true,
        message: `Successfully resent ${records.length} consent emails`,
        resentCount: records.length
      });
    } catch (error) {
      console.error('Unexpected error resending consent emails:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * View consent document (Public endpoint)
 * GET /api/consent/view?token=<consent_token>
 * @access Public
 */
router.get('/view', // apiRateLimiter,
  async (req: Request, res: Response) => {
  try {
    const { token } = req.query as { token?: string };

    if (!token) {
      return res.status(400).json({ error: 'Consent token is required' });
    }

    // Find the consent record by token
    const { data: record, error: recordError } = await supabase
      .from('consent_records')
      .select(`
        *,
        consent_documents!inner(
          id,
          file_name,
          file_path,
          consent_mode,
          autofill_fields,
          template_id,
          version,
          created_at,
          is_active
        )
      `)
      .eq('consent_token', token)
      .single();

    if (recordError || !record) {
      console.log(`❌ CONSENT VIEW FAILED: Invalid token "${token}"`);
      return res.status(404).json({ error: 'Invalid or expired consent token' });
    }

    // Log successful consent view access
    console.log(`\n👀 CONSENT LINK ACCESSED:`);
    console.log(`📧 Entity: ${record.entityName || 'Unknown'} (${record.entityEmail || 'No Email'})`);
    console.log(`📄 Document: ${record.consent_documents?.file_name || 'Unknown'}`);
    console.log(`🎫 Token: ${token}`);
    console.log(`📊 Status: ${record.status}`);
    console.log(`🌐 URL: ${req.protocol}://${req.get('host')}${req.originalUrl}\n`);

    // Check if document is still active
    if (!record.consent_documents.is_active) {
      return res.status(400).json({ error: 'This consent document is no longer active' });
    }

    // Get entity details based on type
    let entityName = 'Unknown';
    let entityEmail = '';
    
    try {
      if (record.consentable_type === 'client') {
        const { data: client } = await supabase
          .from('clients')
          .select('company_name, email_address1')
          .eq('id', record.consentable_id)
          .single();
        
        if (client) {
          entityName = client.company_name;
          entityEmail = client.email_address1;
        }
      } else if (record.consentable_type === 'jobseeker_profile') {
        const { data: jobseeker } = await supabase
          .from('jobseeker_profiles')
          .select('first_name, last_name, email')
          .eq('id', record.consentable_id)
          .single();
        
        if (jobseeker) {
          entityName = `${jobseeker.first_name} ${jobseeker.last_name}`;
          entityEmail = jobseeker.email;
        }
      }
    } catch (error) {
      console.error('Error fetching entity details:', error);
    }

    const shouldUseFilledDocument = record.status === 'completed' && !!record.filled_document_file_path;
    const viewFilePath = shouldUseFilledDocument
      ? record.filled_document_file_path
      : record.consent_documents.file_path;
    const viewFileName = shouldUseFilledDocument
      ? (record.filled_document_file_name || record.consent_documents.file_name)
      : record.consent_documents.file_name;

    return res.status(200).json({
      success: true,
      data: {
        recordId: record.id,
        status: record.status,
        completedAt: record.completed_at,
        consentedName: record.consented_name,
        document: {
          id: record.consent_documents.id,
          fileName: viewFileName,
          filePath: viewFilePath,
          templateFilePath: record.consent_documents.file_path,
          filledFilePath: record.filled_document_file_path,
          consentMode: record.consent_documents.consent_mode,
          autofillFields: record.consent_documents.autofill_fields,
          templateId: record.consent_documents.template_id,
          version: record.consent_documents.version,
          createdAt: record.consent_documents.created_at
        },
        entity: {
          name: entityName,
          email: entityEmail,
          type: record.consentable_type
        }
      }
    });
  } catch (error) {
    console.error('Unexpected error viewing consent:', error);
    return res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

/**
 * Submit consent (Public endpoint)
 * POST /api/consent/submit
 * @access Public
 */
router.post('/submit', 
  // apiRateLimiter,
  sanitizeInputs,
  activityLogger({
    onSuccess: (req, res) => {
      const entityData = res.locals.entityData;
      const recordData = res.locals.recordData;
      
      return {
        actionType: 'user_consent_given',
        actionVerb: 'provided consent',
        primaryEntityType: recordData?.consentable_type === 'client' ? 'client' : 'jobseeker_profile',
        primaryEntityId: recordData?.consentable_id,
        primaryEntityName: entityData?.name || 'Unknown',
        secondaryEntityType: 'consent_document',
        secondaryEntityId: recordData?.document_id,
        secondaryEntityName: recordData?.document?.file_name || 'Unknown Document',
        displayMessage: `${entityData?.name || 'Unknown'} provided digital consent for "${recordData?.document?.file_name || 'Unknown Document'}"`,
        category: 'consent_management',
        priority: 'normal',
        metadata: {
          consentedName: req.body.consentedName,
          entityType: recordData?.consentable_type,
          documentVersion: recordData?.document?.version,
          ipAddress: (() => {
            const forwarded = req.headers['x-forwarded-for'];
            const realIP = req.headers['x-real-ip'];
            const cfConnectingIP = req.headers['cf-connecting-ip'];
            
            if (forwarded) {
              const forwardedArray = Array.isArray(forwarded) ? forwarded : forwarded.split(',');
              return forwardedArray[0].trim();
            }
            if (realIP) return Array.isArray(realIP) ? realIP[0] : realIP;
            if (cfConnectingIP) return Array.isArray(cfConnectingIP) ? cfConnectingIP[0] : cfConnectingIP;
            return req.ip || req.socket.remoteAddress || 'unknown';
          })()
        }
      };
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const { token, consentedName } = req.body;

      if (!token || !consentedName) {
        return res.status(400).json({ error: 'Token and consented name are required' });
      }

      if (typeof consentedName !== 'string' || consentedName.trim().length < 2) {
        return res.status(400).json({ error: 'Please provide a valid full name' });
      }

      // Find the consent record by token
      const { data: record, error: recordError } = await supabase
        .from('consent_records')
        .select(`
          *,
          consent_documents!inner(
            id,
            file_name,
            file_path,
            consent_mode,
            autofill_fields,
            template_id,
            version,
            created_at,
            is_active
          )
        `)
        .eq('consent_token', token)
        .single();

      if (recordError || !record) {
        console.log(`❌ CONSENT SUBMIT FAILED: Invalid token "${token}"`);
        return res.status(404).json({ error: 'Invalid or expired consent token' });
      }

      // Log consent submission attempt
      console.log(`\n✍️ CONSENT SUBMISSION ATTEMPT:`);
      console.log(`📧 Entity: ${record.entityName || 'Unknown'} (${record.entityEmail || 'No Email'})`);
      console.log(`📄 Document: ${record.consent_documents?.file_name || 'Unknown'}`);
      console.log(`🎫 Token: ${token}`);
      console.log(`📊 Current Status: ${record.status}`);
      console.log(`✏️ Consented Name: "${consentedName}"`);

      // Check if document is still active
      if (!record.consent_documents.is_active) {
        console.log(`❌ DOCUMENT INACTIVE\n`);
        return res.status(400).json({ error: 'This consent document is no longer active' });
      }

      // Check if consent already provided
      if (record.status === 'completed') {
        console.log(`❌ CONSENT ALREADY COMPLETED\n`);
        return res.status(400).json({ 
          error: 'Consent has already been provided for this document',
          alreadyCompleted: true
        });
      }

      // Get entity details for activity logging
      let entityName = 'Unknown';
      let entityEmail = '';
      
      try {
        if (record.consentable_type === 'client') {
          const { data: client } = await supabase
            .from('clients')
            .select('company_name, email_address1')
            .eq('id', record.consentable_id)
            .single();
          
          if (client) {
            entityName = client.company_name;
            entityEmail = client.email_address1;
          }
        } else if (record.consentable_type === 'jobseeker_profile') {
          const { data: jobseeker } = await supabase
            .from('jobseeker_profiles')
            .select('first_name, last_name, email')
            .eq('id', record.consentable_id)
            .single();
          
          if (jobseeker) {
            entityName = `${jobseeker.first_name} ${jobseeker.last_name}`;
            entityEmail = jobseeker.email;
          }
        }
      } catch (error) {
        console.error('Error fetching entity details:', error);
      }

      // Get client IP address with fallbacks
      const getClientIP = (req: Request): string => {
        // Check various headers for real IP (in order of preference)
        const forwarded = req.headers['x-forwarded-for'];
        const realIP = req.headers['x-real-ip'];
        const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
        
        if (forwarded) {
          // x-forwarded-for can contain multiple IPs, get the first one
          const forwardedArray = Array.isArray(forwarded) ? forwarded : forwarded.split(',');
          return forwardedArray[0].trim();
        }
        
        if (realIP) {
          return Array.isArray(realIP) ? realIP[0] : realIP;
        }
        
        if (cfConnectingIP) {
          return Array.isArray(cfConnectingIP) ? cfConnectingIP[0] : cfConnectingIP;
        }
        
        // Fallback to Express req.ip (works with trust proxy)
        return req.ip || req.socket.remoteAddress || 'unknown';
      };

      const clientIP = getClientIP(req);
      const completedAt = new Date().toISOString();
      let filledDocumentFilePath: string | null = null;
      let filledDocumentFileName: string | null = null;

      if (record.consent_documents.consent_mode === 'autofill') {
        let autofillFields: NormalizedConsentAutofillField[];

        try {
          autofillFields = parseAutofillFields(record.consent_documents.autofill_fields);
        } catch (error) {
          console.error('Invalid template field setup on consent document:', error);
          return res.status(500).json({
            error: 'Consent template setup is invalid. Please contact the recruiter.'
          });
        }

        try {
          const generatedPdf = await generateFilledConsentPdf({
            templateFilePath: record.consent_documents.file_path,
            originalFileName: record.consent_documents.file_name,
            recordId: record.id,
            consentedName: consentedName.trim(),
            completedAt,
            autofillFields
          });

          filledDocumentFilePath = generatedPdf.filePath;
          filledDocumentFileName = generatedPdf.fileName;
        } catch (error) {
          console.error('Failed to generate recipient-specific consent PDF:', error);
          return res.status(500).json({
            error: 'Failed to generate the completed consent document'
          });
        }
      }

      const updatePayload: Record<string, unknown> = {
        status: 'completed',
        completed_at: completedAt,
        consented_name: consentedName.trim(),
        ip_address: clientIP,
        filled_document_file_path: filledDocumentFilePath,
        filled_document_file_name: filledDocumentFileName
      };

      // Update the consent record
      const { data: updatedRecord, error: updateError } = await supabase
        .from('consent_records')
        .update(updatePayload)
        .eq('id', record.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating consent record:', updateError);
        return res.status(500).json({ error: 'Failed to record consent' });
      }

      // Log successful consent submission
      console.log(`✅ CONSENT SUCCESSFULLY SUBMITTED!`);
      console.log(`📧 Entity: ${entityName} (${entityEmail})`);
      console.log(`📄 Document: ${record.consent_documents?.file_name || 'Unknown'}`);
      console.log(`✏️ Consented Name: "${consentedName.trim()}"`);
      console.log(`📅 Completed At: ${completedAt}`);
      console.log(`🌐 IP Address: ${clientIP}\n`);

      // Store data for activity logging
      res.locals.entityData = { name: entityName, email: entityEmail };
      res.locals.recordData = {
        ...record,
        document: record.consent_documents
      };

      return res.status(200).json({
        success: true,
        message: 'Consent recorded successfully',
        data: {
          recordId: updatedRecord.id,
          completedAt: updatedRecord.completed_at,
          consentedName: updatedRecord.consented_name,
          consentMode: record.consent_documents.consent_mode,
          templateId: record.consent_documents.template_id,
          filledDocument: filledDocumentFilePath ? {
            filePath: filledDocumentFilePath,
            fileName: filledDocumentFileName
          } : null
        }
      });
    } catch (error) {
      console.error('Unexpected error submitting consent:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

// Get consent records by consentable_id (for jobseeker profile or client view)
router.get(
  '/entity-records/:consentableId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { consentableId } = req.params;
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        statusFilter = '', 
        consentableType = 'jobseeker_profile' 
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      // Build the base query with JOIN to get document details
      let query = supabase
        .from('consent_records')
        .select(`
          *,
          consent_documents!inner (
            id,
            file_name,
            file_path,
            consent_mode,
            autofill_fields,
            template_id,
            uploaded_by,
            created_at,
            updated_at,
            version,
            is_active
          )
        `)
        .eq('consentable_id', consentableId)
        .eq('consentable_type', consentableType);

      // Apply filters
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      if (search) {
        query = query.or(`consent_documents.file_name.ilike.%${search}%,consented_name.ilike.%${search}%`);
      }

      // Get total count for pagination
      const { count: totalCount } = await supabase
        .from('consent_records')
        .select('*', { count: 'exact', head: true })
        .eq('consentable_id', consentableId)
        .eq('consentable_type', consentableType);

      // Get paginated results
      const { data: records, error } = await query
        .order('sent_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

      if (error) {
        console.error('Error fetching consent records:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch consent records',
          error: error.message
        });
      }

      const totalPages = Math.ceil((totalCount || 0) / Number(limit));

      res.json({
        success: true,
        records: records || [],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount || 0,
          totalPages,
          hasNextPage: Number(page) < totalPages,
          hasPrevPage: Number(page) > 1
        }
      });

    } catch (error) {
      console.error('Error in consent records endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Removed /clients and /jobseekers endpoints - now using existing client and jobseeker APIs

export default router;
