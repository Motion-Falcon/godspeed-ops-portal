import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { sanitizeInputs, apiRateLimiter } from '../middleware/security.js';
import { activityLogger } from '../middleware/activityLogger.js';
import { emailNotifier } from '../middleware/emailNotifier.js';
import { consentHtmlTemplate, generateConsentTextTemplate } from '../email-templates/consent-html.js';
import dotenv from 'dotenv';
import crypto from 'crypto';

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
 * Convert camelCase to snake_case
 */
function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
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
 * Get all consent documents with pagination and filtering
 * GET /api/consent/documents
 * @access Private (Admin, Recruiter)
 */
router.get('/documents',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  apiRateLimiter,
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
            }
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
  apiRateLimiter,
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
        document: convertObjectToCamelCase(document),
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
 * @access Private (Admin, Recruiter)
 */
router.post('/request',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
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
      primaryEntityName: req.body.fileName,
      displayMessage: `Created consent request "${req.body.fileName}" for ${res.locals.recipientCount || 0} recipients`,
      category: 'consent_management',
      priority: 'normal',
      metadata: {
        fileName: req.body.fileName,
        recipientCount: res.locals.recipientCount,
        recipientType: req.body.recipientType
      }
    })
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const { fileName, filePath, recipientIds, recipientType } = req.body;

      // Validate required fields
      if (!fileName || !filePath || !recipientIds || !recipientType) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
        return res.status(400).json({ error: 'Recipients must be a non-empty array' });
      }

      if (!['client', 'jobseeker_profile'].includes(recipientType)) {
        return res.status(400).json({ error: 'Invalid recipient type' });
      }

      // Create consent document
      const { data: consentDocument, error: docError } = await supabase
        .from('consent_documents')
        .insert({
          file_name: fileName,
          file_path: filePath,
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
router.get('/view', apiRateLimiter, async (req: Request, res: Response) => {
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

    return res.status(200).json({
      success: true,
      data: {
        recordId: record.id,
        status: record.status,
        completedAt: record.completed_at,
        consentedName: record.consented_name,
        document: {
          id: record.consent_documents.id,
          fileName: record.consent_documents.file_name,
          filePath: record.consent_documents.file_path,
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
  apiRateLimiter,
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

      // Update the consent record
      const { data: updatedRecord, error: updateError } = await supabase
        .from('consent_records')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          consented_name: consentedName.trim(),
          ip_address: clientIP
        })
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
      console.log(`📅 Completed At: ${new Date().toISOString()}`);
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
          consentedName: updatedRecord.consented_name
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
