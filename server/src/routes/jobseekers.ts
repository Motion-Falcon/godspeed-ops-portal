import { Router } from 'express';
import { authenticateToken, isAdminOrRecruiter } from '../middleware/auth.js';
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
  updated_by_user_id?: string;
}

// Interface for the simplified JobSeekerProfile list view (matches frontend expectation)
interface JobSeekerProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  status: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  location?: string;
  experience?: string;
  documents?: DocumentRecord[];
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
      .select<string, DbJobseekerProfile>('id, user_id, first_name, last_name, email, verification_status, created_at, city, province, experience, documents'); // Select necessary fields
      
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
      experience: profile.experience,
      location: extractLocation(profile),
      documents: profile.documents?.map((doc: DocumentRecord) => ({
        ...doc,
        aiValidation: null
      })) || []
    }));

    // Collect all document IDs across all profiles for bulk AI validation fetching
    const allDocumentIds: string[] = [];
    dbProfiles.forEach(profile => {
      if (profile.documents && profile.documents.length > 0) {
        profile.documents
          .filter(doc => doc.id)
          .forEach(doc => doc.id && allDocumentIds.push(doc.id));
      }
    });

    // If we have documents to validate, fetch their validation data
    if (allDocumentIds.length > 0) {
      const { data: aiValidations, error: aiError } = await supabaseAdmin
        .from('ai_validation')
        .select('document_id, ai_response, document_status')
        .in('document_id', allDocumentIds);
        
      if (aiError) {
        console.error('Error fetching AI validation data for profiles list:', aiError);
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
        formattedProfiles.forEach(profile => {
          if (profile.documents && profile.documents.length > 0) {
            profile.documents = profile.documents.map((doc: DocumentRecord) => {
              if (doc.id && validationMap[doc.id]) {
                return {
                  ...doc,
                  aiValidation: validationMap[doc.id]
                };
              }
              return doc; // Keep aiValidation: null from earlier
            });
          }
        });
      }
    }
      
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
router.get('/profile/:id', async (req, res) => {
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
router.put('/profile/:id/status', async (req, res) => {
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
router.put('/profile/:id/update', async (req, res) => {
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

    console.log(updateData);
    // Send profile data to AI verification service
    try {
      console.log(`Sending updated profile data to AI verification service at: ${aiVerificationUrl}`);
      
      // Create payload with user_id included
      const verificationPayload = {
        ...updateData,
        user_id: existingProfile.user_id // Add the user_id to the payload
      };
      
      const verificationResponse = await fetch(aiVerificationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
router.delete('/profile/:id', isAdminOrRecruiter, async (req, res) => {
  try {
    const { id } = req.params;

    // First check if the profile exists and get the user_id
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('jobseeker_profiles')
      .select('id, user_id')
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

    // Store the user_id before deleting the profile
    const userId = profile.user_id;

    // Use the admin client to bypass RLS for the delete operation
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
      const { data: userData, error: userDataError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (!userDataError && userData?.user) {
        const existingUserMetadata = userData.user.user_metadata || {};
        
        // Create merged metadata with hasProfile set to false
        const mergedMetadata = {
          ...existingUserMetadata,
          hasProfile: false
        };
        
        // Update user metadata with merged data
        const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { 
            user_metadata: mergedMetadata
          }
        );
        
        if (metadataError) {
          console.error('Error updating user metadata to remove hasProfile flag:', metadataError);
        } else {
          console.log(`Successfully updated hasProfile flag to false for user ${userId}`);
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
 * @desc Get all jobseeker profile drafts
 * @access Private (Admin, Recruiter)
 */
router.get('/drafts', isAdminOrRecruiter, async (req, res) => {
  try {
    // Get all drafts, not just for this user
    const { data: drafts, error } = await supabaseAdmin
      .from('jobseeker_profile_drafts')
      .select('*')
      .order('last_updated', { ascending: false });

    if (error) {
      console.error('Error fetching drafts:', error);
      return res.status(500).json({ error: 'Failed to fetch drafts' });
    }

    // Transform drafts format to match client expectations
    const formattedDrafts = drafts.map(draft => {
      // Extract name from form_data if available
      const firstName = draft.form_data?.firstName || '';
      const lastName = draft.form_data?.lastName || '';
      const name = firstName && lastName ? `${firstName} ${lastName}` : draft.title || 'Untitled Draft';
      const email = draft.email || draft.form_data?.email || '';
      
      // Create a formatted draft object
      const formattedDraft: {
        id: string;
        userId: string;
        email: string;
        lastUpdated: string;
        currentStep: number;
        createdAt: string;
        createdByUserId: string;
        updatedAt: string;
        updatedByUserId: string;
        creatorDetails: {
          id: string;
          email: string | undefined;
          name: string;
          userType: string;
          createdAt: string;
        } | null;
        updaterDetails: {
          id: string;
          email: string | undefined;
          name: string; 
          userType: string;
          updatedAt: string;
        } | null;
      } = {
        id: draft.id,
        userId: draft.user_id,
        email: email,
        lastUpdated: draft.last_updated,
        currentStep: draft.current_step,
        createdAt: draft.created_at,
        createdByUserId: draft.created_by_user_id,
        updatedAt: draft.updated_at,
        updatedByUserId: draft.updated_by_user_id,
        creatorDetails: null,
        updaterDetails: null
      };

      // If we have a creator user ID, fetch their details
      if (draft.created_by_user_id) {
        // Use an IIFE to execute this async code in a sync map
        (async () => {
          try {
            const { data: creatorData, error: creatorError } = await supabaseAdmin
              .auth.admin.getUserById(draft.created_by_user_id);
              
            if (!creatorError && creatorData.user) {
              formattedDraft.creatorDetails = {
                id: creatorData.user.id,
                email: creatorData.user.email,
                name: creatorData.user.user_metadata?.name || 'Unknown',
                userType: creatorData.user.user_metadata?.user_type || 'Unknown',
                createdAt: creatorData.user.created_at
              };
            }
          } catch (error) {
            console.error('Error fetching creator details for draft:', error);
            // Don't fail if we can't get creator info
          }
        })();
      }

      // If we have an updater user ID that's different from the creator, fetch their details
      if (draft.updated_by_user_id && draft.updated_by_user_id !== draft.created_by_user_id) {
        // Use an IIFE to execute this async code in a sync map
        (async () => {
          try {
            const { data: updaterData, error: updaterError } = await supabaseAdmin
              .auth.admin.getUserById(draft.updated_by_user_id);
              
            if (!updaterError && updaterData.user) {
              formattedDraft.updaterDetails = {
                id: updaterData.user.id,
                email: updaterData.user.email,
                name: updaterData.user.user_metadata?.name || 'Unknown',
                userType: updaterData.user.user_metadata?.user_type || 'Unknown',
                updatedAt: draft.updated_at
              };
            }
          } catch (error) {
            console.error('Error fetching updater details for draft:', error);
            // Don't fail if we can't get updater info
          }
        })();
      } else if (draft.updated_by_user_id === draft.created_by_user_id && formattedDraft.creatorDetails) {
        // If same person created and updated, use the creator's details
        formattedDraft.updaterDetails = {
          id: formattedDraft.creatorDetails.id,
          email: formattedDraft.creatorDetails.email,
          name: formattedDraft.creatorDetails.name,
          userType: formattedDraft.creatorDetails.userType,
          updatedAt: draft.updated_at
        };
      }
      
      return formattedDraft;
    });

    // Wait for async operations to complete before sending response
    await Promise.all(formattedDrafts.map(async (draft) => {
      // Fetch creator details
      if (draft.createdByUserId && !draft.creatorDetails) {
        try {
          const { data: creatorData, error: creatorError } = await supabaseAdmin
            .auth.admin.getUserById(draft.createdByUserId);
            
          if (!creatorError && creatorData.user) {
            draft.creatorDetails = {
              id: creatorData.user.id,
              email: creatorData.user.email,
              name: creatorData.user.user_metadata?.name || 'Unknown',
              userType: creatorData.user.user_metadata?.user_type || 'Unknown',
              createdAt: creatorData.user.created_at
            };
          }
        } catch (error) {
          console.error('Error fetching creator details:', error);
        }
      }
      
      // Fetch updater details if different from creator
      if (draft.updatedByUserId && !draft.updaterDetails) {
        // Skip if updater is same as creator and we already have creator details
        if (draft.updatedByUserId === draft.createdByUserId && draft.creatorDetails) {
          draft.updaterDetails = {
            id: draft.creatorDetails.id,
            email: draft.creatorDetails.email,
            name: draft.creatorDetails.name,
            userType: draft.creatorDetails.userType,
            updatedAt: draft.updatedAt
          };
        } else {
          try {
            const { data: updaterData, error: updaterError } = await supabaseAdmin
              .auth.admin.getUserById(draft.updatedByUserId);
              
            if (!updaterError && updaterData.user) {
              draft.updaterDetails = {
                id: updaterData.user.id,
                email: updaterData.user.email,
                name: updaterData.user.user_metadata?.name || 'Unknown',
                userType: updaterData.user.user_metadata?.user_type || 'Unknown',
                updatedAt: draft.updatedAt
              };
            }
          } catch (error) {
            console.error('Error fetching updater details:', error);
          }
        }
      }
    }));

    res.json(formattedDrafts);
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