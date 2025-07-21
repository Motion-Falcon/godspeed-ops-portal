import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { apiRateLimiter, sanitizeInputs } from '../middleware/security.js';
import { activityLogger } from '../middleware/activityLogger.js';
import { emailNotifier } from '../middleware/emailNotifier.js';
import { timesheetHtmlTemplate } from '../email-templates/timesheet-html.js';
import { timesheetTextTemplate } from '../email-templates/timesheet-txt.js';
import dotenv from 'dotenv';

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

// Types for timesheet data
interface TimesheetData {
  jobseekerProfileId: string;
  jobseekerUserId: string;
  positionId?: string;
  weekStartDate: string;
  weekEndDate: string;
  dailyHours: Array<{ date: string; hours: number }>;
  totalRegularHours: number;
  totalOvertimeHours: number;
  regularPayRate: number;
  overtimePayRate: number;
  regularBillRate: number;
  overtimeBillRate: number;
  totalJobseekerPay: number;
  totalClientBill: number;
  overtimeEnabled: boolean;
  markup?: number;
  bonusAmount?: number;
  deductionAmount?: number;
  emailSent?: boolean;
  document?: string; // PDF file path or URL
  invoiceNumber?: string; // Auto-generated invoice number
}

interface VersionHistoryEntry {
  version: number;
  created_by: string;
  created_at: string;
  action: 'created' | 'updated';
}

interface DbTimesheetData {
  id?: string;
  jobseeker_profile_id: string;
  jobseeker_user_id: string;
  position_id?: string;
  week_start_date: string;
  week_end_date: string;
  daily_hours: Array<{ date: string; hours: number }>; // JSONB
  total_regular_hours: number;
  total_overtime_hours: number;
  regular_pay_rate: number;
  overtime_pay_rate: number;
  regular_bill_rate: number;
  overtime_bill_rate: number;
  total_jobseeker_pay: number;
  total_client_bill: number;
  overtime_enabled: boolean;
  markup?: number;
  bonus_amount?: number;
  deduction_amount?: number;
  email_sent: boolean;
  document?: string; // PDF file path or URL
  invoice_number?: string; // Auto-generated invoice number
  created_at?: string;
  created_by_user_id?: string;
  updated_at?: string;
  updated_by_user_id?: string;
  version?: number;
  version_history?: VersionHistoryEntry[];
}

/**
 * Convert snake_case to camelCase
 */
function snakeToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Transform timesheet data from camelCase to snake_case for database
 */
function transformToDbFormat(data: TimesheetData): Omit<DbTimesheetData, 'id' | 'created_at' | 'updated_at'> {
  return {
    jobseeker_profile_id: data.jobseekerProfileId,
    jobseeker_user_id: data.jobseekerUserId,
    position_id: data.positionId,
    week_start_date: data.weekStartDate,
    week_end_date: data.weekEndDate,
    daily_hours: data.dailyHours,
    total_regular_hours: data.totalRegularHours,
    total_overtime_hours: data.totalOvertimeHours,
    regular_pay_rate: data.regularPayRate,
    overtime_pay_rate: data.overtimePayRate,
    regular_bill_rate: data.regularBillRate,
    overtime_bill_rate: data.overtimeBillRate,
    total_jobseeker_pay: data.totalJobseekerPay,
    total_client_bill: data.totalClientBill,
    overtime_enabled: data.overtimeEnabled,
    markup: data.markup,
    bonus_amount: data.bonusAmount,
    deduction_amount: data.deductionAmount,
    email_sent: data.emailSent || false,
    document: data.document,
    invoice_number: data.invoiceNumber
  };
}

/**
 * Transform timesheet data from snake_case to camelCase for frontend
 */
function transformToFrontendFormat(data: DbTimesheetData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  Object.entries(data).forEach(([key, value]) => {
    const camelKey = snakeToCamelCase(key);
    result[camelKey] = value;
  });
  
  return result;
}

/**
 * Generate next available invoice number
 * GET /api/timesheets/generate-invoice-number
 * @access Private (Admin, Recruiter, Jobseeker)
 */
router.get('/generate-invoice-number', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter', 'jobseeker']),
  apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get the current maximum invoice number
      const { data: maxInvoiceData, error: maxInvoiceError } = await supabase
        .from('timesheets')
        .select('invoice_number')
        .not('invoice_number', 'is', null)
        .order('invoice_number', { ascending: false })
        .limit(1);

      if (maxInvoiceError) {
        console.error('Error fetching max invoice number:', maxInvoiceError);
        return res.status(500).json({ error: 'Failed to generate invoice number' });
      }

      let nextInvoiceNumber: string;

      if (!maxInvoiceData || maxInvoiceData.length === 0) {
        // No existing invoice numbers, start with 000001
        nextInvoiceNumber = '000001';
      } else {
        // Parse the current max invoice number and increment
        const currentMax = maxInvoiceData[0].invoice_number;
        const currentNumber = parseInt(currentMax, 10);
        const nextNumber = currentNumber + 1;
        nextInvoiceNumber = nextNumber.toString().padStart(6, '0');
      }

      // Verify this invoice number doesn't already exist (race condition protection)
      const { data: existingInvoice, error: existingError } = await supabase
        .from('timesheets')
        .select('id')
        .eq('invoice_number', nextInvoiceNumber)
        .maybeSingle();

      if (existingError) {
        console.error('Error checking existing invoice number:', existingError);
        return res.status(500).json({ error: 'Failed to validate invoice number' });
      }

      if (existingInvoice) {
        // If somehow this number exists, try the next one
        const nextNumber = parseInt(nextInvoiceNumber, 10) + 1;
        nextInvoiceNumber = nextNumber.toString().padStart(6, '0');
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
 * Get all timesheets with pagination and filtering
 * GET /api/timesheets
 * @access Private (Admin, Recruiter, Jobseeker - own timesheets only)
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
        jobseekerFilter = '',
        positionFilter = '',
        weekStartFilter = '',
        weekEndFilter = '',
        emailSentFilter = '',
        documentFilter = '',
        dateRangeStart = '',
        dateRangeEnd = ''
      } = req.query as {
        page?: string;
        limit?: string;
        searchTerm?: string;
        jobseekerFilter?: string;
        positionFilter?: string;
        weekStartFilter?: string;
        weekEndFilter?: string;
        emailSentFilter?: string;
        documentFilter?: string;
        dateRangeStart?: string;
        dateRangeEnd?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build the base query with joins for related data
      let baseQuery = supabase
        .from('timesheets')
        .select(`
          *,
          jobseeker_profiles!inner(id, first_name, last_name, email),
          positions(id, position_code, title, client)
        `);

      // Apply role-based filtering
      if (userType === 'jobseeker') {
        // Jobseekers can only see their own timesheets
        baseQuery = baseQuery.eq('jobseeker_user_id', userId);
      }
      // Admin and recruiter can see all timesheets (no additional filter needed)

      // Apply filters
      baseQuery = applyTimesheetFilters(baseQuery, {
        searchTerm,
        jobseekerFilter,
        positionFilter,
        weekStartFilter,
        weekEndFilter,
        emailSentFilter,
        documentFilter,
        dateRangeStart,
        dateRangeEnd
      });

      // Get total count (unfiltered for user's access level)
      let totalCountQuery = supabase
        .from('timesheets')
        .select('*', { count: 'exact', head: true });

      if (userType === 'jobseeker') {
        totalCountQuery = totalCountQuery.eq('jobseeker_user_id', userId);
      }

      const { count: totalCount, error: countError } = await totalCountQuery;

      if (countError) {
        console.error('Error getting total count:', countError);
        return res.status(500).json({ error: 'Failed to get total count of timesheets' });
      }

      // Get filtered count
      let filteredCountQuery = supabase
        .from('timesheets')
        .select(`
          *,
          jobseeker_profiles!inner(id, first_name, last_name, email),
          positions(id, position_code, title, client)
        `, { count: 'exact', head: true });

      if (userType === 'jobseeker') {
        filteredCountQuery = filteredCountQuery.eq('jobseeker_user_id', userId);
      }

      filteredCountQuery = applyTimesheetFilters(filteredCountQuery, {
        searchTerm,
        jobseekerFilter,
        positionFilter,
        weekStartFilter,
        weekEndFilter,
        emailSentFilter,
        documentFilter,
        dateRangeStart,
        dateRangeEnd
      });

      const { count: filteredCount, error: filteredCountError } = await filteredCountQuery;

      if (filteredCountError) {
        console.error('Error getting filtered count:', filteredCountError);
        return res.status(500).json({ error: 'Failed to get filtered count of timesheets' });
      }

      // Apply pagination and execute main query
      const { data: timesheets, error } = await baseQuery
        .range(offset, offset + limitNum - 1)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching timesheets:', error);
        return res.status(500).json({ error: 'Failed to fetch timesheets' });
      }

      if (!timesheets || timesheets.length === 0) {
        return res.json({
          timesheets: [],
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

      // Transform timesheets to frontend format
      const formattedTimesheets = timesheets.map(timesheet => {
        const formatted = transformToFrontendFormat(timesheet);
        
        // Add related data
        formatted.jobseekerProfile = timesheet.jobseeker_profiles;
        formatted.position = timesheet.positions;
        
        // Clean up the joined data from the main object
        delete formatted.jobseekerProfiles;
        delete formatted.positions;
        
        return formatted;
      });

      // Calculate pagination metadata
      const totalFiltered = filteredCount || 0;
      const totalPages = Math.ceil(totalFiltered / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      return res.status(200).json({
        timesheets: formattedTimesheets,
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
      console.error('Unexpected error fetching timesheets:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Helper function to apply filters to a Supabase query
 */
function applyTimesheetFilters(query: any, filters: {
  searchTerm?: string;
  jobseekerFilter?: string;
  positionFilter?: string;
  weekStartFilter?: string;
  weekEndFilter?: string;
  emailSentFilter?: string;
  documentFilter?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}) {
  const {
    searchTerm,
    jobseekerFilter,
    positionFilter,
    weekStartFilter,
    weekEndFilter,
    emailSentFilter,
    documentFilter,
    dateRangeStart,
    dateRangeEnd
  } = filters;

  // Global search across multiple fields
  if (searchTerm && searchTerm.trim().length > 0) {
    const searchTermTrimmed = searchTerm.trim();
    query = query.or(`jobseeker_profiles.name.ilike.%${searchTermTrimmed}%,jobseeker_profiles.email.ilike.%${searchTermTrimmed}%,positions.position_code.ilike.%${searchTermTrimmed}%,positions.title.ilike.%${searchTermTrimmed}%,positions.client_name.ilike.%${searchTermTrimmed}%`);
  }

  // Individual column filters
  if (jobseekerFilter && jobseekerFilter.trim().length > 0) {
    query = query.or(`jobseeker_profiles.name.ilike.%${jobseekerFilter.trim()}%,jobseeker_profiles.email.ilike.%${jobseekerFilter.trim()}%`);
  }

  if (positionFilter && positionFilter.trim().length > 0) {
    query = query.or(`positions.position_code.ilike.%${positionFilter.trim()}%,positions.title.ilike.%${positionFilter.trim()}%`);
  }

  if (weekStartFilter && weekStartFilter.trim().length > 0) {
    query = query.eq('week_start_date', weekStartFilter.trim());
  }

  if (weekEndFilter && weekEndFilter.trim().length > 0) {
    query = query.eq('week_end_date', weekEndFilter.trim());
  }

  if (emailSentFilter && emailSentFilter.trim().length > 0) {
    const emailSentBool = emailSentFilter.toLowerCase() === 'true';
    query = query.eq('email_sent', emailSentBool);
  }

  if (documentFilter && documentFilter.trim().length > 0) {
    query = query.eq('document', documentFilter.trim());
  }

  // Date range filters
  if (dateRangeStart && dateRangeStart.trim().length > 0) {
    query = query.gte('week_start_date', dateRangeStart.trim());
  }

  if (dateRangeEnd && dateRangeEnd.trim().length > 0) {
    query = query.lte('week_end_date', dateRangeEnd.trim());
  }

  return query;
}

/**
 * Get timesheet by ID
 * GET /api/timesheets/:id
 * @access Private (Admin, Recruiter, Jobseeker - own timesheets only)
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

      // Build query with joins
      let query = supabase
        .from('timesheets')
        .select(`
          *,
          jobseeker_profiles!inner(id, first_name, last_name, email),
          positions(id, position_code, title, client)
        `)
        .eq('id', id);

      // Apply role-based filtering
      if (userType === 'jobseeker') {
        query = query.eq('jobseeker_user_id', userId);
      }

      const { data: timesheet, error } = await query.single();

      if (error) {
        console.error('Error fetching timesheet:', error);
        return res.status(404).json({ error: 'Timesheet not found' });
      }

      // Transform to frontend format
      const formatted = transformToFrontendFormat(timesheet);
      formatted.jobseekerProfile = timesheet.jobseeker_profiles;
      formatted.position = timesheet.positions;
      
      // Clean up joined data
      delete formatted.jobseekerProfiles;
      delete formatted.positions;

      return res.status(200).json(formatted);
    } catch (error) {
      console.error('Unexpected error fetching timesheet:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Create a new timesheet
 * POST /api/timesheets
 * @access Private (Admin, Recruiter, Jobseeker - own timesheets only)
 */
router.post('/', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter', 'jobseeker']),
  sanitizeInputs,
  activityLogger({
    onSuccess: async (req: Request, res: Response) => {
      const timesheetData = req.body;
      const newTimesheet = res.locals.newTimesheet;
      
      // Get jobseeker name for display
      let jobseekerName = 'Unknown Jobseeker';
      if (timesheetData.jobseekerProfileId) {
        try {
          const { data: profile } = await supabase
            .from('jobseeker_profiles')
            .select('first_name, last_name')
            .eq('id', timesheetData.jobseekerProfileId)
            .single();
          if (profile) {
            jobseekerName = `${profile.first_name} ${profile.last_name}`;
          }
        } catch (error) {
          console.warn('Could not fetch jobseeker name for activity log');
        }
      }

      // Get position title for display
      let positionTitle = 'Unknown Position';
      if (timesheetData.positionId) {
        try {
          const { data: position } = await supabase
            .from('positions')
            .select('title, position_code')
            .eq('id', timesheetData.positionId)
            .single();
          if (position) {
            positionTitle = position.title || position.position_code;
          }
        } catch (error) {
          console.warn('Could not fetch position title for activity log');
        }
      }

      return {
        actionType: 'create_timesheet',
        actionVerb: 'created',
        primaryEntityType: 'timesheet',
        primaryEntityId: newTimesheet?.id,
        primaryEntityName: `Timesheet for week ${timesheetData.weekStartDate}`,
        secondaryEntityType: 'jobseeker',
        secondaryEntityId: timesheetData.jobseekerProfileId,
        secondaryEntityName: jobseekerName,
        tertiaryEntityType: 'position',
        tertiaryEntityId: timesheetData.positionId,
        tertiaryEntityName: positionTitle,
        displayMessage: `Created timesheet for ${jobseekerName} (${positionTitle}) - Week ${timesheetData.weekStartDate}`,
        category: 'financial',
        priority: 'normal' as const,
        metadata: {
          weekStartDate: timesheetData.weekStartDate,
          weekEndDate: timesheetData.weekEndDate,
          totalRegularHours: timesheetData.totalRegularHours,
          totalOvertimeHours: timesheetData.totalOvertimeHours,
          totalJobseekerPay: timesheetData.totalJobseekerPay,
          totalClientBill: timesheetData.totalClientBill,
          invoiceNumber: timesheetData.invoiceNumber
        }
      };
    }
  }),
  emailNotifier({
    onSuccessEmail: async (req: Request, res: Response) => {
      // Only send email if emailSent is true
      if (!req.body.emailSent) return null;

      const timesheetData = req.body;
      const newTimesheet = res.locals.newTimesheet;

      // Get jobseeker profile information
      const { data: jobseekerProfile } = await supabase
        .from('jobseeker_profiles')
        .select('first_name, last_name, email')
        .eq('id', timesheetData.jobseekerProfileId)
        .single();

      if (!jobseekerProfile || !jobseekerProfile.email) {
        console.log('[EmailNotifier] No jobseeker email found, skipping email send.');
        return null;
      }

      // Get position information
      const { data: position } = await supabase
        .from('positions')
        .select('title, client_name, city, province')
        .eq('id', timesheetData.positionId)
        .single();

      // Prepare variables for template
      const templateVars = {
        invoice_number: timesheetData.invoiceNumber || newTimesheet?.invoice_number,
        jobseeker_name: `${jobseekerProfile.first_name} ${jobseekerProfile.last_name}`,
        jobseeker_email: jobseekerProfile.email,
        position_title: position?.title || 'Unknown Position',
        week_start_date: timesheetData.weekStartDate,
        week_end_date: timesheetData.weekEndDate,
        daily_hours: timesheetData.dailyHours || [],
        total_regular_hours: timesheetData.totalRegularHours,
        total_overtime_hours: timesheetData.totalOvertimeHours,
        regular_pay_rate: timesheetData.regularPayRate,
        overtime_pay_rate: timesheetData.overtimePayRate,
        total_jobseeker_pay: timesheetData.totalJobseekerPay,
        overtime_enabled: timesheetData.overtimeEnabled,
        bonus_amount: timesheetData.bonusAmount,
        deduction_amount: timesheetData.deductionAmount,
        generated_date: new Date().toLocaleDateString()
      };

      console.log('[EmailNotifier] templateVars:', templateVars);

      // Use template functions
      const html = timesheetHtmlTemplate(templateVars);
      const text = timesheetTextTemplate(templateVars);

      // Extract subject (first line from text template)
      const [subjectLine, ...bodyLines] = text.split('\n');
      const subject = subjectLine.replace('Subject:', '').trim();

      return {
        to: jobseekerProfile.email,
        subject,
        text: bodyLines.join('\n').trim(),
        html,
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
      const timesheetData: TimesheetData = req.body;
      
      // Validate required fields
      const requiredFields = [
        'jobseekerProfileId', 'jobseekerUserId', 'positionId', 
        'weekStartDate', 'weekEndDate', 'dailyHours',
        'totalRegularHours', 'totalOvertimeHours', 'regularPayRate',
        'overtimePayRate', 'regularBillRate', 'overtimeBillRate',
        'totalJobseekerPay', 'totalClientBill', 'overtimeEnabled'
      ];

      for (const field of requiredFields) {
        if (timesheetData[field as keyof TimesheetData] === undefined || timesheetData[field as keyof TimesheetData] === null) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Role-based validation: jobseekers can only create their own timesheets
      if (userType === 'jobseeker' && timesheetData.jobseekerUserId !== userId) {
        return res.status(403).json({ error: 'You can only create timesheets for yourself' });
      }

      // Prepare timesheet data for database
      const dbTimesheetData: Omit<DbTimesheetData, 'id' | 'created_at' | 'updated_at'> = {
        ...transformToDbFormat(timesheetData),
        created_by_user_id: userId,
        updated_by_user_id: userId,
        version: 1,
        version_history: initializeVersionHistory(userId)
      };

      // Insert timesheet into database
      const { data: newTimesheet, error: insertError } = await supabase
        .from('timesheets')
        .insert([dbTimesheetData])
        .select('*')
        .single();

      if (insertError) {
        console.error('Error creating timesheet:', insertError);
        return res.status(500).json({ error: 'Failed to create timesheet' });
      }

      // Store for activity logging
      res.locals.newTimesheet = newTimesheet;

      // Transform response to frontend format
      const formatted = transformToFrontendFormat(newTimesheet);

      return res.status(201).json({
        success: true,
        message: 'Timesheet created successfully',
        timesheet: formatted
      });
    } catch (error) {
      console.error('Unexpected error creating timesheet:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Update an existing timesheet
 * PUT /api/timesheets/:id
 * @access Private (Admin, Recruiter, Jobseeker - own timesheets only)
 */
router.put('/:id', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter', 'jobseeker']),
  sanitizeInputs,
  activityLogger({
    onSuccess: async (req: Request, res: Response) => {
      const timesheetData = req.body;
      const updatedTimesheet = res.locals.updatedTimesheet;
      const { id } = req.params;
      
      // Get jobseeker name for display
      let jobseekerName = 'Unknown Jobseeker';
      if (timesheetData.jobseekerProfileId) {
        try {
          const { data: profile } = await supabase
            .from('jobseeker_profiles')
            .select('first_name, last_name')
            .eq('id', timesheetData.jobseekerProfileId)
            .single();
          if (profile) {
            jobseekerName = `${profile.first_name} ${profile.last_name}`;
          }
        } catch (error) {
          console.warn('Could not fetch jobseeker name for activity log');
        }
      }

      // Get position title for display
      let positionTitle = 'Unknown Position';
      if (timesheetData.positionId) {
        try {
          const { data: position } = await supabase
            .from('positions')
            .select('title, position_code')
            .eq('id', timesheetData.positionId)
            .single();
          if (position) {
            positionTitle = position.title || position.position_code;
          }
        } catch (error) {
          console.warn('Could not fetch position title for activity log');
        }
      }

      return {
        actionType: 'update_timesheet',
        actionVerb: 'updated',
        primaryEntityType: 'timesheet',
        primaryEntityId: id,
        primaryEntityName: `Timesheet for week ${timesheetData.weekStartDate}`,
        secondaryEntityType: 'jobseeker',
        secondaryEntityId: timesheetData.jobseekerProfileId,
        secondaryEntityName: jobseekerName,
        tertiaryEntityType: 'position',
        tertiaryEntityId: timesheetData.positionId,
        tertiaryEntityName: positionTitle,
        displayMessage: `Updated timesheet for ${jobseekerName} (${positionTitle}) - Week ${timesheetData.weekStartDate}`,
        category: 'financial',
        priority: 'normal' as const,
        metadata: {
          weekStartDate: timesheetData.weekStartDate,
          weekEndDate: timesheetData.weekEndDate,
          totalRegularHours: timesheetData.totalRegularHours,
          totalOvertimeHours: timesheetData.totalOvertimeHours,
          totalJobseekerPay: timesheetData.totalJobseekerPay,
          totalClientBill: timesheetData.totalClientBill,
          invoiceNumber: timesheetData.invoiceNumber
        }
      };
    }
  }),
  emailNotifier({
    onSuccessEmail: async (req: Request, res: Response) => {
      // Only send email if emailSent is true
      if (!req.body.emailSent) return null;

      const timesheetData = req.body;
      const updatedTimesheet = res.locals.updatedTimesheet;

      // Get jobseeker profile information
      const { data: jobseekerProfile } = await supabase
        .from('jobseeker_profiles')
        .select('first_name, last_name, email')
        .eq('id', timesheetData.jobseekerProfileId)
        .single();

      if (!jobseekerProfile || !jobseekerProfile.email) {
        console.log('[EmailNotifier] No jobseeker email found, skipping email send.');
        return null;
      }

      // Get position information
      const { data: position } = await supabase
        .from('positions')
        .select('title, client_name, city, province')
        .eq('id', timesheetData.positionId)
        .single();

      // Get client information
      let clientName = position?.client_name || 'Unknown Client';
      if (position?.client_name) {
        const { data: client } = await supabase
          .from('clients')
          .select('company_name')
          .eq('company_name', position.client_name)
          .single();
        if (client) {
          clientName = client.company_name;
        }
      }

      // Prepare variables for template
      const templateVars = {
        invoice_number: timesheetData.invoiceNumber || updatedTimesheet?.invoice_number,
        jobseeker_name: `${jobseekerProfile.first_name} ${jobseekerProfile.last_name}`,
        jobseeker_email: jobseekerProfile.email,
        position_title: position?.title || 'Unknown Position',
        week_start_date: timesheetData.weekStartDate,
        week_end_date: timesheetData.weekEndDate,
        daily_hours: timesheetData.dailyHours || [],
        total_regular_hours: timesheetData.totalRegularHours,
        total_overtime_hours: timesheetData.totalOvertimeHours,
        regular_pay_rate: timesheetData.regularPayRate,
        overtime_pay_rate: timesheetData.overtimePayRate,
        total_jobseeker_pay: timesheetData.totalJobseekerPay,
        overtime_enabled: timesheetData.overtimeEnabled,
        bonus_amount: timesheetData.bonusAmount,
        deduction_amount: timesheetData.deductionAmount,
        generated_date: new Date().toLocaleDateString(),
        is_updated: true
      };

      console.log('[EmailNotifier] templateVars (update):', templateVars);

      // Use template functions
      const html = timesheetHtmlTemplate(templateVars);
      const text = timesheetTextTemplate(templateVars);

      // Extract subject (first line from text template)
      const [subjectLine, ...bodyLines] = text.split('\n');
      const subject = subjectLine.replace('Subject:', '').trim();

      return {
        to: jobseekerProfile.email,
        subject,
        text: bodyLines.join('\n').trim(),
        html,
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
      const timesheetData: TimesheetData = req.body;
      
      // Check if timesheet exists and user has permission
      let existingQuery = supabase
        .from('timesheets')
        .select('id, jobseeker_user_id, week_start_date, position_id, version, version_history')
        .eq('id', id);

      if (userType === 'jobseeker') {
        existingQuery = existingQuery.eq('jobseeker_user_id', userId);
      }

      const { data: existingTimesheet, error: timesheetCheckError } = await existingQuery.maybeSingle();

      if (timesheetCheckError || !existingTimesheet) {
        return res.status(404).json({ error: 'Timesheet not found or access denied' });
      }

      // Role-based validation: jobseekers can only update their own timesheets
      if (userType === 'jobseeker' && timesheetData.jobseekerUserId !== userId) {
        return res.status(403).json({ error: 'You can only update your own timesheets' });
      }

      // Check for duplicate if assignment or week is being changed
      if (timesheetData.weekStartDate !== existingTimesheet.week_start_date || 
          timesheetData.positionId !== existingTimesheet.position_id) {
        
        const { data: duplicateTimesheet, error: duplicateCheckError } = await supabase
          .from('timesheets')
          .select('id')
          .eq('position_id', timesheetData.positionId)
          .eq('week_start_date', timesheetData.weekStartDate)
          .neq('id', id)
          .maybeSingle();

        if (duplicateCheckError) {
          console.error('Error checking for duplicate timesheet:', duplicateCheckError);
          return res.status(500).json({ error: 'Failed to validate timesheet uniqueness' });
        }

        if (duplicateTimesheet) {
          return res.status(409).json({ 
            error: 'Another timesheet for this position and week already exists',
            field: 'positionId'
          });
        }
      }

      // Prepare timesheet data for database update
      const newVersion = existingTimesheet.version + 1;
      const dbTimesheetData = {
        ...transformToDbFormat(timesheetData),
        updated_by_user_id: userId,
        updated_at: new Date().toISOString(),
        version: newVersion,
        version_history: addVersionToHistory(existingTimesheet.version_history || [], userId, newVersion)
      };

      // Update timesheet in database
      const { data: updatedTimesheet, error: updateError } = await supabase
        .from('timesheets')
        .update(dbTimesheetData)
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Error updating timesheet:', updateError);
        return res.status(500).json({ error: 'Failed to update timesheet' });
      }

      // Store for activity logging
      res.locals.updatedTimesheet = updatedTimesheet;

      // Transform response to frontend format
      const formatted = transformToFrontendFormat(updatedTimesheet);

      return res.status(200).json({
        success: true,
        message: 'Timesheet updated successfully',
        timesheet: formatted
      });
    } catch (error) {
      console.error('Unexpected error updating timesheet:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Delete a timesheet
 * DELETE /api/timesheets/:id
 * @access Private (Admin, Recruiter, Jobseeker - own timesheets only)
 */
router.delete('/:id', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter', 'jobseeker']),
  activityLogger({
    onSuccess: async (req: Request, res: Response) => {
      const { id } = req.params;
      const deletedTimesheet = res.locals.deletedTimesheet;
      
      // Get jobseeker name for display
      let jobseekerName = 'Unknown Jobseeker';
      if (deletedTimesheet?.jobseeker_user_id) {
        try {
          const { data: profile } = await supabase
            .from('jobseeker_profiles')
            .select('first_name, last_name')
            .eq('user_id', deletedTimesheet.jobseeker_user_id)
            .single();
          if (profile) {
            jobseekerName = `${profile.first_name} ${profile.last_name}`;
          }
        } catch (error) {
          console.warn('Could not fetch jobseeker name for activity log');
        }
      }

      // Get position title for display
      let positionTitle = 'Unknown Position';
      if (deletedTimesheet?.position_id) {
        try {
          const { data: position } = await supabase
            .from('positions')
            .select('title, position_code')
            .eq('id', deletedTimesheet.position_id)
            .single();
          if (position) {
            positionTitle = position.title || position.position_code;
          }
        } catch (error) {
          console.warn('Could not fetch position title for activity log');
        }
      }

      return {
        actionType: 'delete_timesheet',
        actionVerb: 'deleted',
        primaryEntityType: 'timesheet',
        primaryEntityId: id,
        primaryEntityName: `Timesheet for week ${deletedTimesheet?.week_start_date || 'Unknown'}`,
        secondaryEntityType: 'jobseeker',
        secondaryEntityId: deletedTimesheet?.jobseeker_profile_id,
        secondaryEntityName: jobseekerName,
        tertiaryEntityType: 'position',
        tertiaryEntityId: deletedTimesheet?.position_id,
        tertiaryEntityName: positionTitle,
        displayMessage: `Deleted timesheet for ${jobseekerName} (${positionTitle}) - Week ${deletedTimesheet?.week_start_date || 'Unknown'}`,
        category: 'financial',
        priority: 'high' as const,
        metadata: {
          weekStartDate: deletedTimesheet?.week_start_date,
          weekEndDate: deletedTimesheet?.week_end_date,
          totalRegularHours: deletedTimesheet?.total_regular_hours,
          totalOvertimeHours: deletedTimesheet?.total_overtime_hours,
          totalJobseekerPay: deletedTimesheet?.total_jobseeker_pay,
          totalClientBill: deletedTimesheet?.total_client_bill,
          invoiceNumber: deletedTimesheet?.invoice_number
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

      // Check if timesheet exists and user has permission
      let existingQuery = supabase
        .from('timesheets')
        .select('*')
        .eq('id', id);

      if (userType === 'jobseeker') {
        existingQuery = existingQuery.eq('jobseeker_user_id', userId);
      }

      const { data: existingTimesheet, error: timesheetCheckError } = await existingQuery.maybeSingle();

      if (timesheetCheckError || !existingTimesheet) {
        return res.status(404).json({ error: 'Timesheet not found or access denied' });
      }

      // Store for activity logging
      res.locals.deletedTimesheet = existingTimesheet;

      // Delete timesheet
      const { error: deleteError } = await supabase
        .from('timesheets')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting timesheet:', deleteError);
        return res.status(500).json({ error: 'Failed to delete timesheet' });
      }

      return res.status(200).json({
        success: true,
        message: 'Timesheet deleted successfully',
        deletedId: id
      });
    } catch (error) {
      console.error('Unexpected error deleting timesheet:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Get timesheets for a specific jobseeker
 * GET /api/timesheets/jobseeker/:jobseekerUserId
 * @access Private (Admin, Recruiter, Jobseeker - own timesheets only)
 */
router.get('/jobseeker/:jobseekerUserId', 
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
      const { jobseekerUserId } = req.params;

      // Role-based validation: jobseekers can only access their own timesheets
      if (userType === 'jobseeker' && jobseekerUserId !== userId) {
        return res.status(403).json({ error: 'You can only access your own timesheets' });
      }

      const { 
        page = '1', 
        limit = '10',
        weekStartFilter = '',
        weekEndFilter = ''
      } = req.query as {
        page?: string;
        limit?: string;
        weekStartFilter?: string;
        weekEndFilter?: string;
      };

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build query
      let query = supabase
        .from('timesheets')
        .select(`
          *,
          jobseeker_profiles!inner(id, first_name, last_name, email),
          positions(id, position_code, title, client)
        `)
        .eq('jobseeker_user_id', jobseekerUserId);

      // Apply date filters if provided
      if (weekStartFilter) {
        query = query.gte('week_start_date', weekStartFilter);
      }
      if (weekEndFilter) {
        query = query.lte('week_end_date', weekEndFilter);
      }

      // Get count
      let countQuery = supabase
        .from('timesheets')
        .select('*', { count: 'exact', head: true })
        .eq('jobseeker_user_id', jobseekerUserId);

      if (weekStartFilter) {
        countQuery = countQuery.gte('week_start_date', weekStartFilter);
      }
      if (weekEndFilter) {
        countQuery = countQuery.lte('week_end_date', weekEndFilter);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('Error getting count:', countError);
        return res.status(500).json({ error: 'Failed to get count of timesheets' });
      }

      // Execute main query with pagination
      const { data: timesheets, error } = await query
        .range(offset, offset + limitNum - 1)
        .order('week_start_date', { ascending: false });

      if (error) {
        console.error('Error fetching jobseeker timesheets:', error);
        return res.status(500).json({ error: 'Failed to fetch timesheets' });
      }

      // Transform timesheets
      const formattedTimesheets = (timesheets || []).map(timesheet => {
        const formatted = transformToFrontendFormat(timesheet);
        formatted.jobseekerProfile = timesheet.jobseeker_profiles;
        formatted.position = timesheet.positions;
        
        delete formatted.jobseekerProfiles;
        delete formatted.positions;
        
        return formatted;
      });

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limitNum);

      return res.status(200).json({
        timesheets: formattedTimesheets,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      });
    } catch (error) {
      console.error('Unexpected error fetching jobseeker timesheets:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Update timesheet document field
 * PATCH /api/timesheets/:id/document
 * @access Private (Admin, Recruiter, Jobseeker - own timesheets only)
 */
router.patch('/:id/document', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter', 'jobseeker']),
  sanitizeInputs,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const userType = req.user.user_metadata?.user_type;
      const { id } = req.params;
      const { document } = req.body;
      
      // Validate document field
      if (!document || typeof document !== 'string') {
        return res.status(400).json({ error: 'Document field is required and must be a string' });
      }

      // Check if timesheet exists and user has permission
      let existingQuery = supabase
        .from('timesheets')
        .select('id, jobseeker_user_id')
        .eq('id', id);

      if (userType === 'jobseeker') {
        existingQuery = existingQuery.eq('jobseeker_user_id', userId);
      }

      const { data: existingTimesheet, error: timesheetCheckError } = await existingQuery.maybeSingle();

      if (timesheetCheckError || !existingTimesheet) {
        return res.status(404).json({ error: 'Timesheet not found or access denied' });
      }

      // Update only the document field
      const { data: updatedTimesheet, error: updateError } = await supabase
        .from('timesheets')
        .update({
          document: document,
          updated_by_user_id: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Error updating timesheet document:', updateError);
        return res.status(500).json({ error: 'Failed to update timesheet document' });
      }

      // Transform response to frontend format
      const formatted = transformToFrontendFormat(updatedTimesheet);

      return res.status(200).json({
        success: true,
        message: 'Timesheet document updated successfully',
        timesheet: formatted
      });
    } catch (error) {
      console.error('Unexpected error updating timesheet document:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Create version history entry
 */
function createVersionEntry(userId: string, version: number, action: 'created' | 'updated'): VersionHistoryEntry {
  return {
    version,
    created_by: userId,
    created_at: new Date().toISOString(),
    action
  };
}

/**
 * Initialize version history for new timesheet
 */
function initializeVersionHistory(userId: string): VersionHistoryEntry[] {
  return [createVersionEntry(userId, 1, 'created')];
}

/**
 * Add version entry to existing history
 */
function addVersionToHistory(existingHistory: VersionHistoryEntry[], userId: string, newVersion: number): VersionHistoryEntry[] {
  return [...existingHistory, createVersionEntry(userId, newVersion, 'updated')];
}

export default router; 