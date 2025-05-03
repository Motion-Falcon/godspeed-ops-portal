import { Router } from 'express';
import { authenticateToken, isAdminOrRecruiter } from '../middleware/auth.js';
// Do not import the ANON client here, we'll create a service client
// import { supabase } from '../utils/supabaseClient.js'; 
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Type definition for the document structure within the JSONB column
interface DocumentRecord {
  documentType: string;
  documentTitle?: string;
  documentPath?: string;
  documentFileName?: string;
  documentNotes?: string;
  id?: string;
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
  documents?: DocumentRecord[];
  verification_status?: 'pending' | 'verified' | 'rejected';
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
}

// Interface for the simplified JobSeekerProfile list view (matches frontend expectation)
interface JobSeekerProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  status: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  skills?: string[];
  location?: string;
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

// Apply only authentication middleware globally
router.use(authenticateToken);
// Remove the global isAdminOrRecruiter middleware and apply it to specific routes

/**
 * Formats the full name from first and last name.
 */
function formatName(profile: DbJobseekerProfile): string {
  return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown';
}

/**
 * Extracts a location string from city and province.
 */
function extractLocation(profile: DbJobseekerProfile): string | undefined {
  const parts = [profile.city, profile.province].filter(Boolean); // Filter out null/undefined
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * @route GET /api/jobseekers
 * @desc Get all jobseeker profiles (simplified view)
 * @access Private (Admin, Recruiter)
 */
router.get('/', isAdminOrRecruiter, async (req, res) => {
  try {
    // Use the admin client to bypass RLS
    const { data: dbProfiles, error } = await supabaseAdmin
      .from('jobseeker_profiles')
      // Specify the type for Supabase select for better type inference
      .select<string, DbJobseekerProfile>('id, user_id, first_name, last_name, email, verification_status, created_at, city, province, experience'); // Select necessary fields
      
    if (error) {
      console.error('Error fetching from jobseeker_profiles:', error);
      return res.status(500).json({ error: 'Failed to fetch jobseeker profiles from database' });
    }
    
    if (!dbProfiles) {
       return res.json([]); // Return empty array if no profiles found
    }

    // Transform database records to the simplified frontend format
    const formattedProfiles: JobSeekerProfile[] = dbProfiles.map((profile) => ({
      id: profile.id,
      userId: profile.user_id,
      name: formatName(profile),
      email: profile.email,
      status: profile.verification_status || 'pending',
      createdAt: profile.created_at,
      // Try to derive skills from experience field or leave empty
      skills: profile.experience ? [profile.experience] : [], 
      location: extractLocation(profile)
    }));
      
    res.json(formattedProfiles);

  } catch (error) {
    console.error('Unexpected error fetching jobseeker profiles:', error);
    res.status(500).json({ error: 'An unexpected error occurred while fetching jobseeker profiles' });
  }
});

/**
 * @route GET /api/jobseekers/:id
 * @desc Get a specific jobseeker profile (detailed view)
 * @access Public (Owner, Admin, Recruiter)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Use the admin client to bypass RLS
    const { data: profile, error } = await supabaseAdmin
      .from('jobseeker_profiles')
      .select<string, DbJobseekerProfile>('*') // Select all fields for detail view
      .eq('id', id)
      .single();
      
    if (error) {
      console.error('Error fetching profile from database:', error);
      // Handle specific Supabase error for not found
      if (error.code === 'PGRST116') { 
        return res.status(404).json({ error: 'Profile not found' });
      }
      return res.status(500).json({ error: 'Failed to fetch detailed jobseeker profile' });
    }
    
    if (!profile) { // Should be redundant due to error handling above, but safe check
       return res.status(404).json({ error: 'Profile not found' });
    }

    // Convert snake_case keys to camelCase for the entire profile object
    const formattedProfile: { [key: string]: any } = {};
    Object.entries(profile).forEach(([key, value]) => {
      const camelKey = key.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
      formattedProfile[camelKey] = value;
    });
    
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
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate the status
    if (!['pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // Use the admin client to bypass RLS for the update
    const { data, error } = await supabaseAdmin
      .from('jobseeker_profiles')
      .update({ 
        verification_status: status,
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select<string, DbJobseekerProfile>() // Specify type for select
      .single(); // Expecting a single record update

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

    // Format the updated profile to match the detailed frontend expectation
    const updatedDbProfile = data;
    const formattedProfile: JobSeekerDetailedProfile = {
      id: updatedDbProfile.id,
      userId: updatedDbProfile.user_id,
      name: formatName(updatedDbProfile),
      email: updatedDbProfile.email,
      phone: updatedDbProfile.mobile,
      status: updatedDbProfile.verification_status || status, // Use the new status
      createdAt: updatedDbProfile.created_at,
      updatedAt: updatedDbProfile.updated_at,
      skills: updatedDbProfile.experience ? [updatedDbProfile.experience] : [],
      location: extractLocation(updatedDbProfile),
      bio: updatedDbProfile.license_type || updatedDbProfile.work_preference || undefined,
      // Add type to doc in find callback
      resume: updatedDbProfile.documents?.find((doc: DocumentRecord) => doc.documentType === 'resume')?.documentPath || undefined,
      experience: updatedDbProfile.experience,
      // Include documents in the updated response as well
      documents: updatedDbProfile.documents || [],
      education: [],
      experienceList: [],
    };

    res.json({ 
      message: 'Profile status updated successfully', 
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
router.put('/:id/update', async (req, res) => {
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
router.delete('/:id', isAdminOrRecruiter, async (req, res) => {
  try {
    const { id } = req.params;

    // First check if the profile exists
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('jobseeker_profiles')
      .select('id')
      .eq('id', id)
      .single();
      
    if (fetchError) {
      console.error('Error fetching profile for deletion:', fetchError);
      if (fetchError.code === 'PGRST116') { 
        return res.status(404).json({ error: 'Profile not found' });
      }
      return res.status(500).json({ error: 'Failed to verify profile existence' });
    }
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Use the admin client to bypass RLS for the delete operation
    const { error: deleteError } = await supabaseAdmin
      .from('jobseeker_profiles')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting profile from database:', deleteError);
      return res.status(500).json({ error: 'Failed to delete jobseeker profile' });
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

export default router; 