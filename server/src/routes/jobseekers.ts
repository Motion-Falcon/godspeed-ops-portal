import { Router } from 'express';
import { authenticateToken, isAdminOrRecruiter } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';
// Do not import the ANON client here, we'll create a service client
// import { supabase } from '../utils/supabaseClient.js'; 
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Get AI verification service URL from environment variables
const aiVerificationUrl = process.env.AI_VERIFICATION_URL || 'https://ai-verification-ff5a17fb5c4a.herokuapp.com/analyze-profile-documents';

// Type definition for the document structure within the JSONB column
interface DocumentRecord {
  documentType: string;
  documentTitle?: string;
  documentPath?: string;
  documentFileName?: string;
  documentNotes?: string;
  id?: string;
  // Add new field for AI validation response
  aiValidation?: AIValidationResponse | null;
}

// Interface for the AI validation response
interface AIValidationResponse {
  document_authentication_percentage: number;
  is_tampered: boolean;
  is_blurry: boolean;
  is_text_clear: boolean;
  is_resubmission_required: boolean;
  notes: string;
  document_status?: string;
}

// Interface for position candidate results from the database function
interface PositionCandidateResult {
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile?: string;
  bio?: string;
  experience?: string;
  weekend_availability?: boolean;
  availability?: string;
  similarity_score: number;
  is_available: boolean;
}

// Interface for formatted position candidate (for frontend consumption)
interface FormattedPositionCandidate {
  id: string;
  candidateId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  mobile?: string;
  bio?: string;
  experience?: string;
  weekendAvailability?: boolean;
  availability?: string;
  similarityScore: number;
  isAvailable: boolean;
  status: string;
}

// Interface matching the actual database schema for jobseeker_profiles
// Derived from the structure used in /api/profile/submit
interface DbJobseekerProfile {
  id: string; // UUID primary key
  user_id: string; // UUID foreign key to auth.users
  first_name: string;
  last_name: string;
  dob: string;
  email: string;
  mobile?: string;
  license_number?: string;
  passport_number?: string;
  sin_number?: string;
  sin_expiry?: string;
  work_permit_uci?: string;
  work_permit_expiry?: string;
  business_number?: string;
  corporation_name?: string;
  street?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  work_preference?: string;
  bio?: string; // Brief professional description (max 100 chars)
  license_type?: string;
  experience?: string;
  manual_driving?: 'Yes' | 'No' | 'NA';
  availability?: 'Full-Time' | 'Part-Time';
  weekend_availability?: boolean;
  payrate_type?: 'Hourly' | 'Daily' | 'Monthly';
  bill_rate?: string;
  pay_rate?: string;
  payment_method?: string;
  hst_gst?: string;
  cash_deduction?: string;
  overtime_enabled?: boolean;
  overtime_hours?: string;
  overtime_bill_rate?: string;
  overtime_pay_rate?: string;
  employee_id?: string; // Employee identification number
  documents?: DocumentRecord[];
  verification_status?: 'pending' | 'verified' | 'rejected';
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
  updated_by_user_id?: string;
  rejection_reason?: string;
}

// Interface for the selected fields in the list view query
interface DbJobseekerProfileListView {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  verification_status?: 'pending' | 'verified' | 'rejected';
  created_at: string;
  city?: string;
  province?: string;
  experience?: string;
  mobile?: string;
  employee_id?: string;
  created_by_user_id?: string;
  updated_by_user_id?: string;
  updated_at: string;
  sin_number?: string;
  sin_expiry?: string;
  work_permit_uci?: string;
  work_permit_expiry?: string;
}

// Interface for the simplified JobSeekerProfile list view (matches frontend expectation)
interface JobSeekerProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  status: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  location?: string;
  experience?: string;
  documents?: DocumentRecord[];
  employeeId?: string; // Employee identification number
  sinNumber?: string;
  sinExpiry?: string;
  workPermitUci?: string;
  workPermitExpiry?: string;
}

// Interface for the detailed JobSeekerProfile view (matches frontend expectation)
interface JobSeekerDetailedProfile extends JobSeekerProfile {
  phone?: string;
  updatedAt: string;
  // Add other fields expected by the frontend detail view
  // For now, we'll derive what we can from DbJobseekerProfile
  bio?: string;
  resume?: string;
  experience?: string; // Simplified for now
  // These are complex structures not directly in jobseeker_profiles
  education?: any[];
  experienceList?: any[]; 
  // Add the documents field to match backend response
  documents?: DocumentRecord[]; 
  rejectionReason?: string;
}

// Initialize a Supabase client with the SERVICE_KEY for backend operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('CRITICAL: Missing Supabase URL or Service Key for jobseekers route.');
  // Optional: throw an error or exit if this is critical
}

// Create a Supabase client instance specifically for this route using the service key
// This bypasses RLS policies, relying on the middleware for access control.
const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!); 

const router = Router();

// Helper function to generate a UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Apply only authentication middleware globally
router.use(authenticateToken);
// Remove the global isAdminOrRecruiter middleware and apply it to specific routes

/**
 * Formats the full name from first and last name.
 */
function formatName(profile: DbJobseekerProfile): string;
function formatName(profile: DbJobseekerProfileListView): string;
function formatName(profile: DbJobseekerProfile | DbJobseekerProfileListView): string {
  return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown';
}

/**
 * Extracts a location string from city and province.
 */
function extractLocation(profile: DbJobseekerProfile): string | undefined;
function extractLocation(profile: DbJobseekerProfileListView): string | undefined;
function extractLocation(profile: DbJobseekerProfile | DbJobseekerProfileListView): string | undefined {
  const parts = [profile.city, profile.province].filter(Boolean); // Filter out null/undefined
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * @route GET /api/jobseekers
 * @desc Get all jobseeker profiles (simplified view) with server-side pagination and filtering
 * @access Private (Admin, Recruiter)
 */
router.get('/', isAdminOrRecruiter, async (req, res) => {
  try {
    // Extract pagination and filter parameters from query
    const { 
      page = '1', 
      limit = '10', 
      search = '',
      nameFilter = '',
      emailFilter = '', 
      phoneFilter = '',
      locationFilter = '',
      experienceFilter = '',
      statusFilter = '',
      employeeIdFilter = '',
      creatorFilter = '', 
      updaterFilter = '',
      dateFilter = '',
      createdDateFilter = '',
      sinNumberFilter = '',
      sinExpiryFilter = '',
      workPermitUciFilter = '',
      workPermitExpiryFilter = '',
      sinExpiryStatusFilter = '',
      workPermitExpiryStatusFilter = ''
    } = req.query as {
      page?: string;
      limit?: string;
      search?: string;
      nameFilter?: string;
      emailFilter?: string;
      phoneFilter?: string;
      locationFilter?: string;
      experienceFilter?: string;
      statusFilter?: string;
      employeeIdFilter?: string;
      creatorFilter?: string;
      updaterFilter?: string;
      dateFilter?: string;
      createdDateFilter?: string;
      sinNumberFilter?: string;
      sinExpiryFilter?: string;
      workPermitUciFilter?: string;
      workPermitExpiryFilter?: string;
      sinExpiryStatusFilter?: string;
      workPermitExpiryStatusFilter?: string;
    };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build the base query with all necessary fields
    let baseQuery = supabaseAdmin
      .from('jobseeker_profiles')
      .select(`
        id, 
        user_id, 
        first_name, 
        last_name, 
        email, 
        verification_status, 
        created_at, 
        city, 
        province, 
        experience, 
        mobile, 
        employee_id,
        created_by_user_id,
        updated_by_user_id,
        updated_at,
        sin_number,
        sin_expiry,
        work_permit_uci,
        work_permit_expiry
      `);

    // Apply all filters at database level
    baseQuery = applyFilters(baseQuery, {
      search,
      nameFilter,
      emailFilter,
      phoneFilter,
      locationFilter,
      experienceFilter,
      statusFilter,
      employeeIdFilter,
      creatorFilter,
      updaterFilter,
      dateFilter,
      createdDateFilter,
      sinNumberFilter,
      sinExpiryFilter,
      workPermitUciFilter,
      workPermitExpiryFilter,
      sinExpiryStatusFilter,
      workPermitExpiryStatusFilter
    });

    // Get total count (unfiltered)
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('jobseeker_profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error getting total count:', countError);
      return res.status(500).json({ error: 'Failed to get total count of profiles' });
    }

    // Get filtered count
    let countQuery = supabaseAdmin
      .from('jobseeker_profiles')
      .select('*', { count: 'exact', head: true });

    countQuery = applyFilters(countQuery, {
      search,
      nameFilter,
      emailFilter,
      phoneFilter,
      locationFilter,
      experienceFilter,
      statusFilter,
      employeeIdFilter,
      creatorFilter,
      updaterFilter,
      dateFilter,
      createdDateFilter,
      sinNumberFilter,
      sinExpiryFilter,
      workPermitUciFilter,
      workPermitExpiryFilter,
      sinExpiryStatusFilter,
      workPermitExpiryStatusFilter
    });

    const { count: filteredCount, error: filteredCountError } = await countQuery;

    if (filteredCountError) {
      console.error('Error getting filtered count:', filteredCountError);
      return res.status(500).json({ error: 'Failed to get filtered count of profiles' });
    }

    // Apply pagination and execute main query
    const { data: dbProfiles, error } = await baseQuery
      .range(offset, offset + limitNum - 1)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching from jobseeker_profiles:', error);
      return res.status(500).json({ error: 'Failed to fetch jobseeker profiles from database' });
    }
    
    if (!dbProfiles || dbProfiles.length === 0) {
      return res.json({
        profiles: [],
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

    // Transform database records to frontend format (no client-side filtering)
    const formattedProfiles: JobSeekerProfile[] = dbProfiles.map((profile: DbJobseekerProfileListView) => ({
      id: profile.id,
      userId: profile.user_id,
      name: formatName(profile),
      email: profile.email,
      phoneNumber: profile.mobile || null, // Use mobile from profile directly
      status: profile.verification_status || 'pending',
      createdAt: profile.created_at,
      experience: profile.experience,
      location: extractLocation(profile),
      employeeId: profile.employee_id,
      sinNumber: profile.sin_number,
      sinExpiry: profile.sin_expiry,
      workPermitUci: profile.work_permit_uci,
      workPermitExpiry: profile.work_permit_expiry,
    }));

    // Calculate pagination metadata
    const totalFiltered = filteredCount || 0;
    const totalPages = Math.ceil(totalFiltered / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;
      
    res.json({
      profiles: formattedProfiles,
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
    console.error('Unexpected error fetching jobseeker profiles:', error);
    res.status(500).json({ error: 'An unexpected error occurred while fetching jobseeker profiles' });
  }
});

/**
 * Helper function to apply filters to a Supabase query
 */
function applyFilters(query: any, filters: {
  search?: string;
  nameFilter?: string;
  emailFilter?: string;
  phoneFilter?: string;
  locationFilter?: string;
  experienceFilter?: string;
  statusFilter?: string;
  employeeIdFilter?: string;
  creatorFilter?: string;
  updaterFilter?: string;
  dateFilter?: string;
  createdDateFilter?: string;
  sinNumberFilter?: string;
  sinExpiryFilter?: string;
  workPermitUciFilter?: string;
  workPermitExpiryFilter?: string;
  sinExpiryStatusFilter?: string;
  workPermitExpiryStatusFilter?: string;
}) {
  const {
    search,
    nameFilter,
    emailFilter,
    phoneFilter,
    locationFilter,
    experienceFilter,
    statusFilter,
    employeeIdFilter,
    creatorFilter,
    updaterFilter,
    dateFilter,
    createdDateFilter,
    sinNumberFilter,
    sinExpiryFilter,
    workPermitUciFilter,
    workPermitExpiryFilter,
    sinExpiryStatusFilter,
    workPermitExpiryStatusFilter
  } = filters;

  // Global search across multiple fields
  if (search && search.trim().length > 0) {
    const searchTerm = search.trim();
    query = query.or(`verification_status.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,mobile.ilike.%${searchTerm}%,experience.ilike.%${searchTerm}%,employee_id.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,province.ilike.%${searchTerm}%`);
  }

  // Individual column filters
  if (nameFilter && nameFilter.trim().length > 0) {
    const nameTerm = nameFilter.trim();
    query = query.or(`first_name.ilike.%${nameTerm}%,last_name.ilike.%${nameTerm}%`);
  }

  if (emailFilter && emailFilter.trim().length > 0) {
    query = query.ilike('email', `%${emailFilter.trim()}%`);
  }

  if (phoneFilter && phoneFilter.trim().length > 0) {
    query = query.ilike('mobile', `%${phoneFilter.trim()}%`);
  }

  if (locationFilter && locationFilter.trim().length > 0) {
    const locationTerm = locationFilter.trim();
    query = query.or(`city.ilike.%${locationTerm}%,province.ilike.%${locationTerm}%`);
  }

  if (experienceFilter && experienceFilter !== 'all' && experienceFilter.trim().length > 0) {
    query = query.ilike('experience', `%${experienceFilter.trim()}%`);
  }

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('verification_status', statusFilter);
  }

  if (employeeIdFilter && employeeIdFilter.trim().length > 0) {
    query = query.ilike('employee_id', `%${employeeIdFilter.trim()}%`);
  }

  // Date filters
  if (dateFilter) {
    const filterDate = new Date(dateFilter);
    const nextDay = new Date(filterDate);
    nextDay.setDate(nextDay.getDate() + 1);
    query = query.gte('updated_at', filterDate.toISOString()).lt('updated_at', nextDay.toISOString());
  }

  if (createdDateFilter) {
    const filterDate = new Date(createdDateFilter);
    const nextDay = new Date(filterDate);
    nextDay.setDate(nextDay.getDate() + 1);
    query = query.gte('created_at', filterDate.toISOString()).lt('created_at', nextDay.toISOString());
  }

  // SIN Number filter
  if (sinNumberFilter && sinNumberFilter.trim().length > 0) {
    query = query.ilike('sin_number', `%${sinNumberFilter.trim()}%`);
  }

  // SIN Expiry filter
  if (sinExpiryFilter && sinExpiryFilter.trim().length > 0) {
    const filterDate = new Date(sinExpiryFilter);
    const nextDay = new Date(filterDate);
    nextDay.setDate(nextDay.getDate() + 1);
    query = query.gte('sin_expiry', filterDate.toISOString()).lt('sin_expiry', nextDay.toISOString());
  }

  // Work Permit UCI filter
  if (workPermitUciFilter && workPermitUciFilter.trim().length > 0) {
    query = query.ilike('work_permit_uci', `%${workPermitUciFilter.trim()}%`);
  }

  // Work Permit Expiry filter
  if (workPermitExpiryFilter && workPermitExpiryFilter.trim().length > 0) {
    const filterDate = new Date(workPermitExpiryFilter);
    const nextDay = new Date(filterDate);
    nextDay.setDate(nextDay.getDate() + 1);
    query = query.gte('work_permit_expiry', filterDate.toISOString()).lt('work_permit_expiry', nextDay.toISOString());
  }

  // SIN Expiry Status filter
  if (sinExpiryStatusFilter && sinExpiryStatusFilter !== 'all') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (sinExpiryStatusFilter) {
      case 'expired':
        query = query.lt('sin_expiry', today.toISOString());
        break;
      case 'expiring-30':
        const in30Days = new Date(today);
        in30Days.setDate(in30Days.getDate() + 30);
        query = query.gte('sin_expiry', today.toISOString()).lte('sin_expiry', in30Days.toISOString());
        break;
      case 'expiring-60':
        const in60Days = new Date(today);
        in60Days.setDate(in60Days.getDate() + 60);
        query = query.gte('sin_expiry', today.toISOString()).lte('sin_expiry', in60Days.toISOString());
        break;
      case 'expiring-90':
        const in90Days = new Date(today);
        in90Days.setDate(in90Days.getDate() + 90);
        query = query.gte('sin_expiry', today.toISOString()).lte('sin_expiry', in90Days.toISOString());
        break;
      case 'expiring-after-90':
        const after90Days = new Date(today);
        after90Days.setDate(after90Days.getDate() + 90);
        query = query.gt('sin_expiry', after90Days.toISOString());
        break;
    }
  }

  // Work Permit Expiry Status filter
  if (workPermitExpiryStatusFilter && workPermitExpiryStatusFilter !== 'all') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (workPermitExpiryStatusFilter) {
      case 'expired':
        query = query.lt('work_permit_expiry', today.toISOString());
        break;
      case 'expiring-30':
        const in30Days = new Date(today);
        in30Days.setDate(in30Days.getDate() + 30);
        query = query.gte('work_permit_expiry', today.toISOString()).lte('work_permit_expiry', in30Days.toISOString());
        break;
      case 'expiring-60':
        const in60Days = new Date(today);
        in60Days.setDate(in60Days.getDate() + 60);
        query = query.gte('work_permit_expiry', today.toISOString()).lte('work_permit_expiry', in60Days.toISOString());
        break;
      case 'expiring-90':
        const in90Days = new Date(today);
        in90Days.setDate(in90Days.getDate() + 90);
        query = query.gte('work_permit_expiry', today.toISOString()).lte('work_permit_expiry', in90Days.toISOString());
        break;
      case 'expiring-after-90':
        const after90Days = new Date(today);
        after90Days.setDate(after90Days.getDate() + 90);
        query = query.gt('work_permit_expiry', after90Days.toISOString());
        break;
    }
  }

  // Note: creatorFilter and updaterFilter would require JOINs with auth.users
  // For now, we'll skip these as they require more complex queries
  // TODO: Implement these filters with proper JOINs or stored procedures

  return query;
}

/**
 * @route GET /api/jobseekers/:id
 * @desc Get a specific jobseeker profile (detailed view)
 * @access Public (Owner, Admin, Recruiter)
 */
router.get('/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Use the admin client to bypass RLS
    // First try to find by profile ID, then by user_id if not found
    let profile: DbJobseekerProfile | null = null;
    let error: any = null;

    // Try finding by profile ID first
    const { data: profileById, error: profileByIdError } = await supabaseAdmin
      .from('jobseeker_profiles')
      .select<string, DbJobseekerProfile>('*')
      .eq('id', id)
      .maybeSingle();

    if (profileByIdError) {
      console.error('Error fetching profile by ID:', profileByIdError);
      return res.status(500).json({ error: 'Failed to fetch detailed jobseeker profile' });
    }

    if (profileById) {
      profile = profileById;
    } else {
      // If not found by profile ID, try finding by user_id
      const { data: profileByUserId, error: profileByUserIdError } = await supabaseAdmin
        .from('jobseeker_profiles')
        .select<string, DbJobseekerProfile>('*')
        .eq('user_id', id)
        .maybeSingle();

      if (profileByUserIdError) {
        console.error('Error fetching profile by user_id:', profileByUserIdError);
        return res.status(500).json({ error: 'Failed to fetch detailed jobseeker profile' });
      }

      profile = profileByUserId;
    }
      
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Convert snake_case keys to camelCase for the entire profile object
    const formattedProfile: { [key: string]: any } = {};
    Object.entries(profile).forEach(([key, value]) => {
      const camelKey = key.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
      formattedProfile[camelKey] = value;
    });
    
    // If profile has documents, fetch AI validation data for each document
    if (profile.documents && profile.documents.length > 0) {
      // First, initialize all documents with null aiValidation
      formattedProfile.documents = profile.documents.map((doc: DocumentRecord) => ({
        ...doc,
        aiValidation: null
      }));

      // Extract document IDs
      const documentIds = profile.documents
        .filter(doc => doc.id) // Filter out documents without an ID
        .map(doc => doc.id);
      
      if (documentIds.length > 0) {
        // Fetch AI validation data for these documents
        const { data: aiValidations, error: aiError } = await supabaseAdmin
          .from('ai_validation')
          .select('document_id, ai_response, document_status')
          .in('document_id', documentIds);
          
        if (aiError) {
          console.error('Error fetching AI validation data:', aiError);
          // Don't fail the whole request if we can't get validation data
        } else if (aiValidations && aiValidations.length > 0) {
          // Create a map of document_id to validation data for quick lookup
          const validationMap = aiValidations.reduce((map, validation) => {
            map[validation.document_id] = {
              ...validation.ai_response,
              document_status: validation.document_status
            };
            return map;
          }, {} as { [key: string]: any });
          
          // Update documents with validation data where available
          formattedProfile.documents = formattedProfile.documents.map((doc: DocumentRecord) => {
            if (doc.id && validationMap[doc.id]) {
              return {
                ...doc,
                aiValidation: validationMap[doc.id]
              };
            }
            return doc; // Already has aiValidation: null from earlier
          });
        }
      }
    } 
    
    // Fetch creator details if created_by_user_id exists
    if (profile.created_by_user_id) {
      try {
        const { data: creatorData, error: creatorError } = await supabaseAdmin
          .auth.admin.getUserById(profile.created_by_user_id);
          
        if (!creatorError && creatorData.user) {
          // Add creator details to the formatted profile
          formattedProfile.creatorDetails = {
            id: creatorData.user.id,
            email: creatorData.user.email,
            name: creatorData.user.user_metadata?.name || 'Unknown',
            userType: creatorData.user.user_metadata?.user_type || 'Unknown',
            createdAt: creatorData.user.created_at
          };
        }
      } catch (creatorError) {
        console.error('Error fetching creator details:', creatorError);
        // Don't fail the whole request if creator details can't be fetched
      }
    }
    
    // Fetch updater details if updated_by_user_id exists
    if (profile.updated_by_user_id) {
      try {
        const { data: updaterData, error: updaterError } = await supabaseAdmin
          .auth.admin.getUserById(profile.updated_by_user_id);
          
        if (!updaterError && updaterData.user) {
          // Add updater details to the formatted profile
          formattedProfile.updaterDetails = {
            id: updaterData.user.id,
            email: updaterData.user.email,
            name: updaterData.user.user_metadata?.name || 'Unknown',
            userType: updaterData.user.user_metadata?.user_type || 'Unknown',
            updatedAt: profile.updated_at
          };
        }
      } catch (updaterError) {
        console.error('Error fetching updater details:', updaterError);
        // Don't fail the whole request if updater details can't be fetched
      }
    }
      
    res.json(formattedProfile);

  } catch (error) {
    console.error('Unexpected error fetching detailed jobseeker profile:', error);
    res.status(500).json({ error: 'An unexpected error occurred while fetching detailed jobseeker profile' });
  }
});

/**
 * @route PUT /api/jobseekers/:id/status
 * @desc Update a jobseeker profile status
 * @access Public (Owner, Admin, Recruiter)
 */
router.put('/profile/:id/status', 
  activityLogger({
    onSuccess: (req, res) => {
      const currentProfile = res.locals.currentProfile || {};
      const updatedProfile = res.locals.updatedProfile || {};
      const { status, rejectionReason } = req.body;
      
      // Determine the specific action type based on the status
      let actionType: "verify_jobseeker" | "reject_jobseeker" | "pending_jobseeker" = 'pending_jobseeker';
      let actionVerb = 'updated';
      
      if (status === 'verified') {
        actionType = 'verify_jobseeker';
        actionVerb = 'verified';
      } else if (status === 'rejected') {
        actionType = 'reject_jobseeker';
        actionVerb = 'rejected';
      } else if (status === 'pending') {
        actionType = 'pending_jobseeker';
        actionVerb = 'set to pending';
      }
      
      const profileName = currentProfile.first_name && currentProfile.last_name 
        ? `${currentProfile.first_name} ${currentProfile.last_name}`.trim()
        : currentProfile.email || 'Unknown';
      
      return {
        actionType,
        actionVerb,
        primaryEntityType: 'jobseeker',
        primaryEntityId: req.params.id,
        primaryEntityName: profileName,
        displayMessage: `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} jobseeker profile for ${profileName}${
          status === 'rejected' && rejectionReason ? ` with reason: ${rejectionReason}` : ''
        }${
          status === 'verified' && updatedProfile.employee_id ? ` and assigned employee code ${updatedProfile.employee_id}` : ''
        }`,
        category: 'candidate_management' as const,
        priority: status === 'rejected' ? 'high' as const : 'normal' as const,
        status: 'completed',
        metadata: {
          profileId: req.params.id,
          oldStatus: currentProfile.verification_status,
          newStatus: status,
          rejectionReason: status === 'rejected' ? rejectionReason : null,
          employeeCodeAssigned: status === 'verified' && updatedProfile.employee_id ? updatedProfile.employee_id : null,
          email: currentProfile.email
        }
      };
    }
  }),
  async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    // Validate the status
    if (!['pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // If status is 'rejected', rejectionReason is required
    if (status === 'rejected' && (!rejectionReason || rejectionReason.trim() === '')) {
      return res.status(400).json({ error: 'Rejection reason is required when setting status to rejected' });
    }

    // Get current profile to check existing status and employee_id
    const { data: currentProfile, error: fetchError } = await supabaseAdmin
      .from('jobseeker_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching current profile:', fetchError);
      if (fetchError.code === 'PGRST116') { 
        return res.status(404).json({ error: 'Profile not found' });
      }
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    // Store current profile for activity logger
    res.locals.currentProfile = currentProfile;

    // Prepare update data
    const updateData: any = { 
      verification_status: status,
      updated_at: new Date().toISOString() 
    };

    // Generate employee code if status is being set to 'verified' and no employee_id exists
    if (status === 'verified' && !currentProfile.employee_id) {
      try {
        // Get the highest existing employee code to determine the next number
        const { data: existingCodes, error: codeError } = await supabaseAdmin
          .from('jobseeker_profiles')
          .select('employee_id')
          .not('employee_id', 'is', null)
          .like('employee_id', 'GS%')
          .order('employee_id', { ascending: false })
          .limit(1);

        if (codeError) {
          console.error('Error fetching existing employee codes:', codeError);
          // Continue without generating code if we can't fetch existing codes
        } else {
          let nextNumber = 1; // Default starting number

          if (existingCodes && existingCodes.length > 0) {
            const highestCode = existingCodes[0].employee_id;
            if (highestCode && highestCode.startsWith('GS')) {
              // Extract the numeric part and increment
              const numericPart = highestCode.substring(2); // Remove 'GS' prefix
              const currentNumber = parseInt(numericPart, 10);
              if (!isNaN(currentNumber)) {
                nextNumber = currentNumber + 1;
              }
            }
          }

          // Format the employee code as GS + 6-digit number (e.g., GS000001)
          const employeeCode = `GS${nextNumber.toString().padStart(6, '0')}`;
          updateData.employee_id = employeeCode;
          
          console.log(`Generated employee code: ${employeeCode} for profile ${id}`);
        }
      } catch (codeGenerationError) {
        console.error('Error generating employee code:', codeGenerationError);
        // Continue with the status update even if code generation fails
      }
    }

    // Only set rejection_reason when status is rejected
    if (status === 'rejected') {
      updateData.rejection_reason = rejectionReason;
    } else {
      // Clear rejection_reason if status is not rejected
      updateData.rejection_reason = null;
    }

    // Use the admin client to bypass RLS for the update
    const { data, error } = await supabaseAdmin
      .from('jobseeker_profiles')
      .update(updateData)
      .eq('id', id)
      .select<string, DbJobseekerProfile>() // Specify type for select
      .single();

    if (error) {
      console.error('Error updating profile status in database:', error);
      // Handle specific Supabase error for not found during update
      if (error.code === 'PGRST116') { 
        return res.status(404).json({ error: 'Profile not found to update status' });
      }
      return res.status(500).json({ error: 'Failed to update profile status' });
    }

    if (!data) { // Should be redundant due to error handling
      return res.status(404).json({ error: 'Profile not found after update attempt' });
    }

    // Store updated profile for activity logger
    res.locals.updatedProfile = data;

    // Format the updated profile to match the detailed frontend expectation
    const updatedDbProfile = data;
    const formattedProfile: JobSeekerDetailedProfile = {
      id: updatedDbProfile.id,
      userId: updatedDbProfile.user_id,
      name: formatName(updatedDbProfile),
      email: updatedDbProfile.email,
      phoneNumber: updatedDbProfile.mobile || null,
      phone: updatedDbProfile.mobile,
      status: updatedDbProfile.verification_status || status, // Use the new status
      createdAt: updatedDbProfile.created_at,
      updatedAt: updatedDbProfile.updated_at,
      location: extractLocation(updatedDbProfile),
      bio: updatedDbProfile.license_type || updatedDbProfile.work_preference || undefined,
      // Add type to doc in find callback
      resume: updatedDbProfile.documents?.find((doc: DocumentRecord) => doc.documentType === 'resume')?.documentPath || undefined,
      experience: updatedDbProfile.experience,
      // Include documents in the updated response as well
      documents: updatedDbProfile.documents || [],
      education: [],
      experienceList: [],
      // Include rejection reason in the response
      rejectionReason: updatedDbProfile.rejection_reason
    };

    // Include employee code in success message if one was generated
    let message = 'Profile status updated successfully';
    if (status === 'verified' && updateData.employee_id) {
      message += ` and employee code ${updateData.employee_id} has been assigned`;
    }

    res.json({ 
      message, 
      profile: formattedProfile // Return the formatted updated profile
    });

  } catch (error) {
    console.error('Unexpected error updating jobseeker status:', error);
    res.status(500).json({ error: 'An unexpected error occurred while updating profile status' });
  }
});

/**
 * @route PUT /api/jobseekers/:id/update
 * @desc Update a jobseeker profile
 * @access Public (Owner, Admin, Recruiter)
 */
router.put('/profile/:id/update', 
  activityLogger({
    onSuccess: (req, res) => {
      // Get the updated profile data from the response
      const updatedProfile = res.locals.updatedProfile || {};
      const profileData = req.body;
      
      return {
        actionType: 'update_jobseeker',
        actionVerb: 'updated',
        primaryEntityType: 'jobseeker',
        primaryEntityId: req.params.id,
        primaryEntityName: updatedProfile.first_name && updatedProfile.last_name 
          ? `${updatedProfile.first_name} ${updatedProfile.last_name}`.trim()
          : profileData.firstName && profileData.lastName 
            ? `${profileData.firstName} ${profileData.lastName}`.trim()
            : updatedProfile.email || profileData.email || 'Unknown',
        displayMessage: `Updated jobseeker profile for ${
          updatedProfile.first_name && updatedProfile.last_name 
            ? `${updatedProfile.first_name} ${updatedProfile.last_name}`.trim()
            : profileData.firstName && profileData.lastName 
              ? `${profileData.firstName} ${profileData.lastName}`.trim()
              : updatedProfile.email || profileData.email || 'Unknown'
        }`,
        category: 'candidate_management',
        priority: 'normal',
        status: 'completed',
        metadata: {
          profileId: req.params.id,
          updatedFields: Object.keys(profileData).filter(key => key !== 'documents'),
          hasDocuments: !!(profileData.documents && profileData.documents.length > 0),
          email: updatedProfile.email || profileData.email
        }
      };
    }
  }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const profileData = req.body;

      // First check if the profile exists
      const { data: existingProfile, error: fetchError } = await supabaseAdmin
        .from('jobseeker_profiles')
        .select('id, user_id, email')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        console.error('Error fetching profile for update:', fetchError);
        if (fetchError.code === 'PGRST116') { 
          return res.status(404).json({ error: 'Profile not found' });
        }
        return res.status(500).json({ error: 'Failed to verify profile existence' });
      }
      
      if (!existingProfile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Check if updated email already exists in another profile
      if (profileData.email && profileData.email !== existingProfile.email) {
        const { data: emailExists, error: emailCheckError } = await supabaseAdmin
          .from('jobseeker_profiles')
          .select('id')
          .eq('email', profileData.email)
          .neq('id', id)  // Exclude the current profile
          .maybeSingle();

        if (emailCheckError) {
          console.error('Error checking email uniqueness:', emailCheckError);
          return res.status(500).json({ error: 'Failed to validate email uniqueness' });
        }

        if (emailExists) {
          return res.status(409).json({ 
            error: 'A profile with this email already exists',
            field: 'email'
          });
        }
      }

      // Get current profile documents to compare with updated documents
      const { data: currentProfile, error: docFetchError } = await supabaseAdmin
        .from('jobseeker_profiles')
        .select('documents')
        .eq('id', id)
        .single();
      
      if (docFetchError) {
        console.error('Error fetching current documents:', docFetchError);
        // Continue with update, but log the error
      }

      // Handle document IDs - update IDs only when document path changes
      if (profileData.documents && currentProfile?.documents) {
        const currentDocuments = currentProfile.documents;
        
        // Create a map of existing document IDs to document objects for quick lookup
        const existingDocsMap = new Map();
        currentDocuments.forEach((doc: DocumentRecord) => {
          if (doc.id) {
            existingDocsMap.set(doc.id, doc);
          }
        });
        
        // Update document IDs whenever any document metadata changes
        profileData.documents = profileData.documents.map((doc: any) => {
          // If doc has an ID and it exists in current documents
          if (doc.id && existingDocsMap.has(doc.id)) {
            const oldDoc = existingDocsMap.get(doc.id);
            
            // Check if any metadata has changed
            const hasMetadataChanged = 
              doc.documentPath !== oldDoc.documentPath || 
              doc.documentType !== oldDoc.documentType || 
              doc.documentTitle !== oldDoc.documentTitle || 
              doc.documentFileName !== oldDoc.documentFileName || 
              doc.documentNotes !== oldDoc.documentNotes;
            
            if (hasMetadataChanged) {
              // Document metadata changed, generate new ID
              const newId = generateUUID();
              const changedFields = [];
              
              if (doc.documentPath !== oldDoc.documentPath) changedFields.push('path');
              if (doc.documentType !== oldDoc.documentType) changedFields.push('type');
              if (doc.documentTitle !== oldDoc.documentTitle) changedFields.push('title');
              if (doc.documentFileName !== oldDoc.documentFileName) changedFields.push('fileName');
              if (doc.documentNotes !== oldDoc.documentNotes) changedFields.push('notes');
              
              console.log(`Document metadata changed - Old ID: ${doc.id}, New ID: ${newId}, Changed fields: ${changedFields.join(', ')}`);
              
              return {
                ...doc,
                id: newId // Generate a new UUID for the updated document
              };
            }
          }
          // No changes or new document, keep as is
          return doc;
        });
      }

      // Prepare profile data for update - convert camelCase to snake_case
      const updateData: { [key: string]: any } = {};
      
      // Handle each field appropriately, mapping camelCase to snake_case
      if (profileData.firstName) updateData.first_name = profileData.firstName;
      if (profileData.lastName) updateData.last_name = profileData.lastName;
      if (profileData.dob) updateData.dob = profileData.dob;
      if (profileData.email) updateData.email = profileData.email;
      if (profileData.mobile) updateData.mobile = profileData.mobile;
      if (profileData.licenseNumber) updateData.license_number = profileData.licenseNumber;
      if (profileData.passportNumber) updateData.passport_number = profileData.passportNumber;
      if (profileData.sinNumber) updateData.sin_number = profileData.sinNumber;
      if (profileData.sinExpiry) updateData.sin_expiry = profileData.sinExpiry;
      if (profileData.workPermitUci) updateData.work_permit_uci = profileData.workPermitUci;
      if (profileData.workPermitExpiry) updateData.work_permit_expiry = profileData.workPermitExpiry;
      if (profileData.businessNumber) updateData.business_number = profileData.businessNumber;
      if (profileData.corporationName) updateData.corporation_name = profileData.corporationName;
      if (profileData.street) updateData.street = profileData.street;
      if (profileData.city) updateData.city = profileData.city;
      if (profileData.province) updateData.province = profileData.province;
      if (profileData.postalCode) updateData.postal_code = profileData.postalCode;
      if (profileData.workPreference) updateData.work_preference = profileData.workPreference;
      if (profileData.bio) updateData.bio = profileData.bio;
      if (profileData.licenseType) updateData.license_type = profileData.licenseType;
      if (profileData.experience) updateData.experience = profileData.experience;
      if (profileData.manualDriving) updateData.manual_driving = profileData.manualDriving;
      if (profileData.availability) updateData.availability = profileData.availability;
      if (profileData.weekendAvailability !== undefined) updateData.weekend_availability = profileData.weekendAvailability;
      if (profileData.payrateType) updateData.payrate_type = profileData.payrateType;
      if (profileData.billRate) updateData.bill_rate = profileData.billRate;
      if (profileData.payRate) updateData.pay_rate = profileData.payRate;
      if (profileData.paymentMethod) updateData.payment_method = profileData.paymentMethod;
      if (profileData.hstGst) updateData.hst_gst = profileData.hstGst;
      if (profileData.cashDeduction) updateData.cash_deduction = profileData.cashDeduction;
      if (profileData.overtimeEnabled !== undefined) updateData.overtime_enabled = profileData.overtimeEnabled;
      if (profileData.overtimeHours) updateData.overtime_hours = profileData.overtimeHours;
      if (profileData.overtimeBillRate) updateData.overtime_bill_rate = profileData.overtimeBillRate;
      if (profileData.overtimePayRate) updateData.overtime_pay_rate = profileData.overtimePayRate;
      if (profileData.employeeId) updateData.employee_id = profileData.employeeId;
      
      // Handle documents array if present
      if (profileData.documents) {
        updateData.documents = profileData.documents;
      }
      
      // Always update the updated_at timestamp
      updateData.updated_at = new Date().toISOString();

      // Update the profile in the database
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('jobseeker_profiles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return res.status(500).json({ error: 'Failed to update profile' });
      }

      // Store the updated profile for activity logging
      res.locals.updatedProfile = updatedProfile;

      console.log(updateData);
      // Send profile data to AI verification service
      try {
        console.log(`Sending updated profile data to AI verification service at: ${aiVerificationUrl}`);
        
        // Create payload with user_id included
        const verificationPayload = {
          ...updateData,
          user_id: existingProfile.user_id // Add the user_id to the payload
        };
         // Extract the authorization header from the original request
         const authHeader = req.headers.authorization;
         console.log('authHeader', authHeader);
         const headers: Record<string, string> = {
           'Content-Type': 'application/json',
         };
         
         // Add the bearer token if available
         if (authHeader) {
           headers['Authorization'] = authHeader;
         }
        const verificationResponse = await fetch(aiVerificationUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(verificationPayload),
        });
        
        if (verificationResponse.ok) {
          const verificationResult = await verificationResponse.json();
          console.log('AI verification service response:', verificationResult);
        } else {
          console.error('AI verification service error:', verificationResponse.status, await verificationResponse.text());
        }
      } catch (verificationError) {
        console.error('Error sending data to AI verification service:', verificationError);
        // Don't block profile update if verification service fails
      }

      res.json({ 
        message: 'Profile updated successfully',
        profile: updatedProfile
      });

    } catch (error) {
      console.error('Unexpected error updating jobseeker profile:', error);
      res.status(500).json({ error: 'An unexpected error occurred while updating the profile' });
    }
  });

/**
 * @route DELETE /api/jobseekers/:id
 * @desc Delete a specific jobseeker profile
 * @access Private (Admin, Recruiter)
 */
router.delete(
  '/profile/:id',
  authenticateToken,
  isAdminOrRecruiter,
  activityLogger({
    onSuccess: (req, res) => {
      const jobseekerProfile = res.locals.jobseekerProfile;
      return {
        actionType: 'delete_jobseeker',
        actionVerb: 'deleted',
        primaryEntityType: 'jobseeker',
        primaryEntityId: req.params.id,
        primaryEntityName: jobseekerProfile ? 
          `${jobseekerProfile.first_name || ''} ${jobseekerProfile.last_name || ''}`.trim() || jobseekerProfile.email || `Jobseeker ${req.params.id}` :
          `Jobseeker ${req.params.id}`,
        displayMessage: `Deleted jobseeker profile ${jobseekerProfile ? `for ${jobseekerProfile.first_name || ''} ${jobseekerProfile.last_name || ''}`.trim() || jobseekerProfile.email : req.params.id}`,
        category: 'candidate_management',
        priority: 'normal',
        status: 'completed',
        metadata: {
          profileId: req.params.id,
          deletedProfile: jobseekerProfile ? {
            firstName: jobseekerProfile.first_name,
            lastName: jobseekerProfile.last_name,
            email: jobseekerProfile.email,
            phoneNumber: jobseekerProfile.phone_number,
            status: jobseekerProfile.status
          } : null
        }
      };
    }
  }),
  async (req, res) => {
    try {
      const { id } = req.params;

      // First, get the jobseeker profile for activity logging
      const { data: jobseekerProfile, error: fetchError } = await supabaseAdmin
        .from('jobseeker_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching jobseeker profile:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch jobseeker profile' });
      }

      if (!jobseekerProfile) {
        return res.status(404).json({ error: 'Jobseeker profile not found' });
      }

      // Store the profile for activity logging
      res.locals.jobseekerProfile = jobseekerProfile;

      // Delete the jobseeker profile
      const { error: deleteError } = await supabaseAdmin
        .from('jobseeker_profiles')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting profile from database:', deleteError);
        return res.status(500).json({ error: 'Failed to delete jobseeker profile' });
      }

      // Update the user metadata to set hasProfile to false
      try {
        // Get existing user metadata to preserve other fields
        const { data: userData, error: userDataError } = await supabaseAdmin.auth.admin.getUserById(jobseekerProfile.user_id);
        
        if (!userDataError && userData?.user) {
          const existingUserMetadata = userData.user.user_metadata || {};
          
          // Create merged metadata with hasProfile set to false
          const mergedMetadata = {
            ...existingUserMetadata,
            hasProfile: false
          };
          
          // Update user metadata with merged data
          const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
            jobseekerProfile.user_id,
            { 
              user_metadata: mergedMetadata
            }
          );
          
          if (metadataError) {
            console.error('Error updating user metadata to remove hasProfile flag:', metadataError);
          } else {
            console.log(`Successfully updated hasProfile flag to false for user ${jobseekerProfile.user_id}`);
          }
        } else {
          console.error('Error fetching user data for updating metadata:', userDataError);
        }
      } catch (metadataError) {
        // Log error but don't fail the profile deletion
        console.error('Error updating user metadata to remove hasProfile flag:', metadataError);
      }

      res.json({ 
        message: 'Profile deleted successfully',
        deletedId: id
      });

    } catch (error) {
      console.error('Unexpected error deleting jobseeker profile:', error);
      res.status(500).json({ error: 'An unexpected error occurred while deleting the profile' });
    }
  });

/**
 * @route GET /api/jobseekers/drafts
 * @desc Get all jobseeker profile drafts with pagination and filtering
 * @access Private (Admin, Recruiter)
 */
router.get('/drafts', isAdminOrRecruiter, async (req, res) => {
  try {
    // Extract pagination and filter parameters from query
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string || '').trim();
    const emailFilter = (req.query.emailFilter as string || '').trim();
    const creatorFilter = (req.query.creatorFilter as string || '').trim();
    const updaterFilter = (req.query.updaterFilter as string || '').trim();
    const dateFilter = (req.query.dateFilter as string || '').trim();
    const createdDateFilter = (req.query.createdDateFilter as string || '').trim();

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Helper function to apply filters to a query
    const applyDraftFilters = (query: any) => {
      // Global search across multiple fields
      if (search) {
        const searchTerm = search.trim();
        query = query.or(`email.ilike.%${searchTerm}%`);
      }

      // Specific field filters
      if (emailFilter) {
        query = query.ilike('email', `%${emailFilter}%`);
      }

      // Date filters
      if (dateFilter) {
        const filterDate = new Date(dateFilter);
        const nextDay = new Date(filterDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.gte('updated_at', filterDate.toISOString()).lt('updated_at', nextDay.toISOString());
      }

      if (createdDateFilter) {
        const filterDate = new Date(createdDateFilter);
        const nextDay = new Date(filterDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.gte('created_at', filterDate.toISOString()).lt('created_at', nextDay.toISOString());
      }

      return query;
    };

    // Get total count (unfiltered)
    const { count: totalCount, error: totalCountError } = await supabaseAdmin
      .from('jobseeker_profile_drafts')
      .select('*', { count: 'exact', head: true });

    if (totalCountError) {
      console.error('Error getting total count of drafts:', totalCountError);
      return res.status(500).json({ error: 'Failed to get total count of drafts' });
    }

    // Get filtered count
    let filteredCountQuery = supabaseAdmin
      .from('jobseeker_profile_drafts')
      .select('*', { count: 'exact', head: true });

    filteredCountQuery = applyDraftFilters(filteredCountQuery);

    const { count: filteredCount, error: filteredCountError } = await filteredCountQuery;

    if (filteredCountError) {
      console.error('Error getting filtered count of drafts:', filteredCountError);
      return res.status(500).json({ error: 'Failed to get filtered count of drafts' });
    }

    // Build main query with selected fields
    const selectedFields = [
      'id',
      'user_id',
      'email',
      'last_updated',
      'created_at',
      'created_by_user_id',
      'updated_at',
      'updated_by_user_id'
    ].join(', ');

    let mainQuery = supabaseAdmin
      .from('jobseeker_profile_drafts')
      .select(selectedFields);

    // Apply filters to main query
    mainQuery = applyDraftFilters(mainQuery);

    // Apply pagination and execute query
    const { data: drafts, error } = await mainQuery
      .range(offset, offset + limit - 1)
      .order('last_updated', { ascending: false });

    if (error) {
      console.error('Error fetching drafts:', error);
      return res.status(500).json({ error: 'Failed to fetch drafts' });
    }

    if (!drafts || drafts.length === 0) {
      return res.json({
        drafts: [],
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalFiltered: filteredCount || 0,
          totalPages: Math.ceil((filteredCount || 0) / limit),
          hasNextPage: false,
          hasPrevPage: false
        }
      });
    }

    // Collect all user IDs to fetch their details
    const creatorIds = [...new Set(drafts.map((draft: any) => draft.created_by_user_id).filter(Boolean))];
    const updaterIds = [...new Set(drafts.map((draft: any) => draft.updated_by_user_id).filter(Boolean))];
    const allUserIds = [...new Set([...creatorIds, ...updaterIds])];

    // Fetch user details for all users
    const userDetailsMap: { [key: string]: any } = {};
    
    for (const userId of allUserIds) {
      try {
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (!userError && userData?.user) {
          const user = userData.user;
          userDetailsMap[userId] = {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Unknown',
            userType: user.user_metadata?.user_type || 'Unknown',
            createdAt: user.created_at,
            updatedAt: user.updated_at
          };
        }
      } catch (userFetchError) {
        console.error(`Error fetching user ${userId}:`, userFetchError);
        userDetailsMap[userId] = null;
      }
    }

    // Transform drafts format to match client expectations
    let formattedDrafts = drafts.map((draft: any) => {
      const formattedDraft = {
        id: draft.id,
        user_id: draft.user_id,
        email: draft.email || '',
        lastUpdated: draft.last_updated,
        createdAt: draft.created_at,
        createdByUserId: draft.created_by_user_id,
        updatedAt: draft.updated_at,
        updatedByUserId: draft.updated_by_user_id,
        creatorDetails: draft.created_by_user_id ? userDetailsMap[draft.created_by_user_id] || null : null,
        updaterDetails: draft.updated_by_user_id ? userDetailsMap[draft.updated_by_user_id] || null : null
      };

      return formattedDraft;
    });

    // Apply creator and updater filters (these need to be done after user details are fetched)
    if (creatorFilter) {
      formattedDrafts = formattedDrafts.filter(draft => {
        const creator = draft.creatorDetails;
        if (!creator) return false;
        const searchTerm = creatorFilter.toLowerCase();
        return (creator.name && creator.name.toLowerCase().includes(searchTerm)) ||
               (creator.email && creator.email.toLowerCase().includes(searchTerm));
      });
    }

    if (updaterFilter) {
      formattedDrafts = formattedDrafts.filter(draft => {
        const updater = draft.updaterDetails;
        if (!updater) return false;
        const searchTerm = updaterFilter.toLowerCase();
        return (updater.name && updater.name.toLowerCase().includes(searchTerm)) ||
               (updater.email && updater.email.toLowerCase().includes(searchTerm));
      });
    }

    // Note: If creator/updater filters are applied, the pagination might not be accurate
    // This is a limitation when filtering by related data that requires additional API calls
    const finalCount = (creatorFilter || updaterFilter) ? formattedDrafts.length : (filteredCount || 0);
    const totalPages = Math.ceil(finalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      drafts: formattedDrafts,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalFiltered: finalCount,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error('Unexpected error fetching drafts:', error);
    res.status(500).json({ error: 'An unexpected error occurred while fetching drafts' });
  }
});

/**
 * @route GET /api/jobseekers/drafts/:id
 * @desc Get a specific jobseeker profile draft
 * @access Private (Admin, Recruiter)
 */
router.get('/drafts/:id', isAdminOrRecruiter, async (req, res) => {
  try {
    const { id } = req.params;

    // Get draft by ID
    const { data: draft, error } = await supabaseAdmin
      .from('jobseeker_profile_drafts')
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

    return res.status(200).json({
      draft: draft.form_data,
      currentStep: draft.current_step,
      lastUpdated: draft.last_updated,
      email: draft.email,
    });
  } catch (error) {
    console.error('Unexpected error fetching draft by ID:', error);
    return res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

/**
 * @route POST /api/jobseekers/drafts
 * @desc Create a new jobseeker profile draft
 * @access Public (Owner, Admin, Recruiter)
 */
router.post('/drafts', async (req, res) => {
  try {

    const userId = req.user?.id;
    const draftData = req.body;
    const currentStep = draftData.currentStep || 1;
    
    // Extract email explicitly from both form data and top-level data
    let email = draftData.email || null;
    if (!email && draftData.form_data && draftData.form_data.email) {
      email = draftData.form_data.email;
    }
    
    // If an email is provided, check if it already exists in jobseeker_profiles
    if (email) {
      const { data: emailExists, error: emailCheckError } = await supabaseAdmin
        .from('jobseeker_profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (emailCheckError) {
        console.error('Error checking email existence in profiles:', emailCheckError);
      } else if (emailExists) {
        return res.status(409).json({
          error: 'A jobseeker profile already exists with this email. Please use a different email.',
          existingProfileId: emailExists.id
        });
      }

      // Also check if the email exists in another draft
      const { data: draftEmailExists, error: draftEmailCheckError } = await supabaseAdmin
        .from('jobseeker_profile_drafts')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (draftEmailCheckError) {
        console.error('Error checking email existence in drafts:', draftEmailCheckError);
      } else if (draftEmailExists) {
        return res.status(409).json({
          error: 'A draft with this email already exists.',
          existingDraftId: draftEmailExists.id
        });
      }
    }

    // Set the current timestamp
    const now = new Date().toISOString();

    // Create new draft with tracking fields
    const { data: newDraft, error } = await supabaseAdmin
      .from('jobseeker_profile_drafts')
      .insert([
        {
          user_id: userId,
          form_data: draftData,
          last_updated: now,
          current_step: currentStep,
          email: email, // Ensure email is saved
          created_at: now,
          created_by_user_id: userId,
          updated_at: now,
          updated_by_user_id: userId
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating draft:', error);
      return res.status(500).json({ error: 'Failed to create draft' });
    }

    return res.status(201).json({
      message: 'Draft created successfully',
      draft: {
        id: newDraft.id,
        lastUpdated: newDraft.last_updated,
        currentStep: newDraft.current_step,
        email: newDraft.email,
        createdAt: newDraft.created_at,
        createdByUserId: newDraft.created_by_user_id,
        updatedAt: newDraft.updated_at,
        updatedByUserId: newDraft.updated_by_user_id
      }
    });
  } catch (error) {
    console.error('Unexpected error creating draft:', error);
    return res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

/**
 * @route PUT /api/jobseekers/drafts/:id
 * @desc Update a jobseeker profile draft
 * @access Private (Admin, Recruiter)
 */
router.put('/drafts/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const draftData = req.body;
    const currentStep = draftData.currentStep || 1;

    // Extract email explicitly from both form data and top-level data
    let email = draftData.email || null;
    if (!email && draftData.form_data && draftData.form_data.email) {
      email = draftData.form_data.email;
    }

    // Check if draft exists
    const { data: existingDraft, error: checkError } = await supabaseAdmin
      .from('jobseeker_profile_drafts')
      .select('id, email, created_at, created_by_user_id')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking draft:', checkError);
      return res.status(500).json({ error: 'Failed to verify draft' });
    }

    if (!existingDraft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    // If email has changed, check if it exists in profiles or other drafts
    if (email && email !== existingDraft.email) {
      // Check profiles
      const { data: emailExists, error: emailCheckError } = await supabaseAdmin
        .from('jobseeker_profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (emailCheckError) {
        console.error('Error checking email existence in profiles:', emailCheckError);
      } else if (emailExists) {
        return res.status(409).json({
          error: 'A jobseeker profile already exists with this email. Please use a different email.',
          existingProfileId: emailExists.id
        });
      }

      // Check other drafts
      const { data: draftEmailExists, error: draftEmailCheckError } = await supabaseAdmin
        .from('jobseeker_profile_drafts')
        .select('id')
        .eq('email', email)
        .neq('id', id) // Exclude current draft
        .maybeSingle();

      if (draftEmailCheckError) {
        console.error('Error checking email existence in drafts:', draftEmailCheckError);
      } else if (draftEmailExists) {
        return res.status(409).json({
          error: 'A draft with this email already exists.',
          existingDraftId: draftEmailExists.id
        });
      }
    }

    // Set the current timestamp
    const now = new Date().toISOString();

    // Update draft
    const { data: updatedDraft, error: updateError } = await supabaseAdmin
      .from('jobseeker_profile_drafts')
      .update({
        form_data: draftData,
        last_updated: now,
        current_step: currentStep,
        email: email, // Ensure email is updated
        updated_at: now,
        updated_by_user_id: userId
        // Don't modify created_at and created_by_user_id on updates
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating draft:', updateError);
      return res.status(500).json({ error: 'Failed to update draft' });
    }

    return res.status(200).json({
      message: 'Draft updated successfully',
      draft: {
        id: updatedDraft.id,
        lastUpdated: updatedDraft.last_updated,
        currentStep: updatedDraft.current_step,
        email: updatedDraft.email,
        createdAt: updatedDraft.created_at,
        createdByUserId: updatedDraft.created_by_user_id,
        updatedAt: updatedDraft.updated_at,
        updatedByUserId: updatedDraft.updated_by_user_id
      }
    });
  } catch (error) {
    console.error('Unexpected error updating draft:', error);
    return res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

/**
 * @route DELETE /api/jobseekers/drafts/:id
 * @desc Delete a jobseeker profile draft
 * @access Private (Admin, Recruiter)
 */
router.delete('/drafts/:id', isAdminOrRecruiter, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if draft exists (without user check)
    const { data: existingDraft, error: checkError } = await supabaseAdmin
      .from('jobseeker_profile_drafts')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking draft:', checkError);
      return res.status(500).json({ error: 'Failed to verify draft' });
    }

    if (!existingDraft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    // Delete draft (without user check)
    const { error: deleteError } = await supabaseAdmin
      .from('jobseeker_profile_drafts')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting draft:', deleteError);
      return res.status(500).json({ error: 'Failed to delete draft' });
    }

    return res.status(200).json({
      message: 'Draft deleted successfully',
      deletedId: id
    });
  } catch (error) {
    console.error('Unexpected error deleting draft:', error);
    return res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

/**
 * @route GET /api/jobseekers/position-candidates/:positionId
 * @desc Get candidates for a specific position using vector similarity matching
 * @access Private (Admin, Recruiter)
 * @param {string} positionId - The ID of the position to find candidates for
 * @query {number} page - Page number for pagination (default: 1)
 * @query {number} limit - Number of candidates per page (default: 10)
 * @query {string} search - Search term for name, email, phone, experience, or bio
 * @query {string} nameFilter - Filter by candidate name
 * @query {string} emailFilter - Filter by candidate email
 * @query {string} phoneFilter - Filter by candidate phone number
 * @query {string} experienceFilter - Filter by candidate experience level
 * @query {string} availabilityFilter - Filter by availability (Full-Time, Part-Time)
 * @query {string} weekendAvailabilityFilter - Filter by weekend availability (true/false)
 * @query {string} cityFilter - Filter by candidate city
 * @query {string} provinceFilter - Filter by candidate province
 * @query {string} onlyAvailable - Show only available candidates (true/false)
 * @query {string} sortBy - Sort by field (similarity, name, experience)
 * @query {string} sortOrder - Sort order (asc, desc)
 * @returns {object} Paginated list of candidates with similarity scores and availability status
 * 
 * @example
 * GET /api/jobseekers/position-candidates/123?page=1&limit=10&onlyAvailable=true&sortBy=similarity
 * 
 * Response:
 * {
 *   "candidates": [...],
 *   "pagination": { "page": 1, "limit": 10, "total": 150, "totalFiltered": 25, ... },
 *   "positionId": "123",
 *   "position": { "id": "123", "title": "Software Developer", ... },
 *   "filters": { ... }
 * }
 */
router.get('/position-candidates/:positionId', isAdminOrRecruiter, async (req, res) => {
  try {
    const { positionId } = req.params;
    
    // Extract pagination and filter parameters from query
    const { 
      page = '1', 
      limit = '10',
      search = '',
      nameFilter = '',
      emailFilter = '', 
      phoneFilter = '',
      experienceFilter = '',
      availabilityFilter = '',
      weekendAvailabilityFilter = '',
      cityFilter = '',
      provinceFilter = '',
      onlyAvailable = 'false',
      sortBy = 'similarity', // similarity, name, experience
      sortOrder = 'desc' // asc, desc
    } = req.query as {
      page?: string;
      limit?: string;
      search?: string;
      nameFilter?: string;
      emailFilter?: string;
      phoneFilter?: string;
      experienceFilter?: string;
      availabilityFilter?: string;
      weekendAvailabilityFilter?: string;
      cityFilter?: string;
      provinceFilter?: string;
      onlyAvailable?: string;
      sortBy?: string;
      sortOrder?: string;
    };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Validate position ID
    if (!positionId) {
      return res.status(400).json({ error: 'Position ID is required' });
    }

    // Build filters object for the stored procedure
    const filters: { [key: string]: any } = {};
    
    if (experienceFilter && experienceFilter !== 'all') {
      filters.experience = experienceFilter;
    }
    
    if (availabilityFilter && availabilityFilter !== 'all') {
      filters.availability = availabilityFilter;
    }
    
    if (weekendAvailabilityFilter && weekendAvailabilityFilter !== 'all') {
      filters.weekend_availability = weekendAvailabilityFilter === 'true';
    }
    
    if (cityFilter && cityFilter.length >= 2) {
      filters.city = cityFilter;
    }
    
    if (provinceFilter && provinceFilter.length >= 2) {
      filters.province = provinceFilter;
    }
    
    if (onlyAvailable === 'true') {
      filters.only_available = 'true';
    }

    // Call the stored procedure with a large limit to get all matching candidates
    const { data: candidatesData, error: candidatesError } = await supabaseAdmin
      .rpc('find_matching_candidates', {
        p_position_id: positionId,
        p_filters: filters,
        p_limit: 10000000 // Large limit to get all candidates, then paginate in-memory
      });
    if (candidatesError) {
      console.error('Error calling get_position_candidates function:', candidatesError);
      return res.status(500).json({ 
        error: 'Failed to fetch position candidates',
        details: candidatesError.message 
      });
    }

    if (!candidatesData) {
      return res.json({
        candidates: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false
        },
        positionId
      });
    }

    // Transform the database results to match frontend expectations
    let formattedCandidates: FormattedPositionCandidate[] = candidatesData.map((candidate: PositionCandidateResult) => ({
      id: candidate.candidate_id,
      candidateId: candidate.candidate_id,
      firstName: candidate.first_name,
      lastName: candidate.last_name,
      name: `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Unknown',
      email: candidate.email,
      phoneNumber: candidate.mobile || null,
      mobile: candidate.mobile,
      bio: candidate.bio,
      experience: candidate.experience,
      weekendAvailability: candidate.weekend_availability,
      availability: candidate.availability,
      similarityScore: parseFloat(candidate.similarity_score.toString() || '0'),
      isAvailable: candidate.is_available,
      status: candidate.is_available ? 'available' : 'unavailable'
    }));

    // Apply client-side filters for computed/formatted fields (minimum 3 characters for performance)
    if (search && search.length >= 3) {
      formattedCandidates = formattedCandidates.filter(candidate => 
        candidate.name.toLowerCase().includes(search.toLowerCase()) ||
        candidate.email.toLowerCase().includes(search.toLowerCase()) ||
        (candidate.phoneNumber && candidate.phoneNumber.toLowerCase().includes(search.toLowerCase())) ||
        (candidate.experience && candidate.experience.toLowerCase().includes(search.toLowerCase())) ||
        (candidate.bio && candidate.bio.toLowerCase().includes(search.toLowerCase()))
      );
    }

    if (nameFilter && nameFilter.length >= 3) {
      formattedCandidates = formattedCandidates.filter(candidate => 
        candidate.name.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    if (emailFilter && emailFilter.length >= 3) {
      formattedCandidates = formattedCandidates.filter(candidate => 
        candidate.email.toLowerCase().includes(emailFilter.toLowerCase())
      );
    }

    if (phoneFilter && phoneFilter.length >= 3) {
      formattedCandidates = formattedCandidates.filter(candidate => 
        candidate.phoneNumber && candidate.phoneNumber.toLowerCase().includes(phoneFilter.toLowerCase())
      );
    }

    // Get total count after filtering
    const totalFiltered = formattedCandidates.length;

    // Apply pagination to the filtered results
    const paginatedCandidates = formattedCandidates.slice(offset, offset + limitNum);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalFiltered / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      candidates: paginatedCandidates,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: candidatesData.length, // Total before client-side filtering
        totalFiltered,
        totalPages,
        hasNextPage,
        hasPrevPage
      },
      positionId,
      filters: {
        search,
        nameFilter,
        emailFilter,
        phoneFilter,
        experienceFilter,
        availabilityFilter,
        weekendAvailabilityFilter,
        cityFilter,
        provinceFilter,
        onlyAvailable,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('Unexpected error fetching position candidates:', error);
    res.status(500).json({ 
      error: 'An unexpected error occurred while fetching position candidates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Check email availability (enhanced to check both profiles and drafts)
router.get('/api/profile/check-email', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email parameter is required' });
    }
    
    // First check if the email exists in the jobseeker_profiles table
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('jobseeker_profiles')
      .select('id')
      .eq('email', email)
      .limit(1);
      
    if (profileError) {
      console.error('Error checking email in profiles:', profileError);
      throw new Error('Database error checking email availability');
    }
    
    // If email exists in a profile, return not available with the profile ID
    if (profileData && profileData.length > 0) {
      return res.json({ 
        available: false, 
        email, 
        existingProfileId: profileData[0].id 
      });
    }
    
    // If not found in profiles, check in drafts
    const { data: draftData, error: draftError } = await supabaseAdmin
      .from('jobseeker_profile_drafts')
      .select('id')
      .eq('email', email)
      .limit(1);
      
    if (draftError) {
      console.error('Error checking email in drafts:', draftError);
      throw new Error('Database error checking email availability in drafts');
    }
    
    // If email exists in a draft, return not available with the draft ID
    if (draftData && draftData.length > 0) {
      return res.json({ 
        available: false, 
        email,
        existingDraftId: draftData[0].id 
      });
    }
    
    // If email doesn't exist in either profiles or drafts, it's available
    return res.json({ available: true, email });
    
  } catch (error) {
    console.error('Error checking email availability:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error checking email'
    });
  }
});

export default router; 