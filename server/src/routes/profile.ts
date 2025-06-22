import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { apiRateLimiter, sensitiveRateLimiter, sanitizeInputs } from '../middleware/security.js';
import { activityLogger } from '../middleware/activityLogger.js';
import dotenv from 'dotenv';
import { ProfileData, Document, DbJobseekerProfile } from '../types.js';

dotenv.config();

const router = Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Get AI verification service URL from environment variables
const aiVerificationUrl = process.env.AI_VERIFICATION_URL || 'https://ai-verification-ff5a17fb5c4a.herokuapp.com/analyze-profile-documents';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Submit complete jobseeker profile with security measures
 * POST /api/profile/submit
 */
router.post('/submit', 
  authenticateToken, 
  sanitizeInputs,
  // sensitiveRateLimiter,
  activityLogger({
    onSuccess: (req, res) => ({
      actionType: 'create_jobseeker',
      actionVerb: 'created',
      primaryEntityType: 'jobseeker',
      primaryEntityId: res.locals.newProfile?.id,
      primaryEntityName: `${req.body.firstName} ${req.body.lastName}`,
      displayMessage: `Created jobseeker profile for "${req.body.firstName} ${req.body.lastName}"`,
      category: 'candidate_management',
      priority: 'normal',
      metadata: {
        email: req.body.email,
        mobile: req.body.mobile,
        licenseNumber: req.body.licenseNumber,
        passportNumber: req.body.passportNumber,
        workPreference: req.body.workPreference,
        accountCreated: res.locals.accountCreated || false
      }
    })
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const profileData = req.body;
      
      // Ensure required fields are present
      const requiredFields = ['firstName', 'lastName', 'dob', 'email', 'mobile'];
      for (const field of requiredFields) {
        if (!profileData[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Validate business logic - at least one ID must be present
      if (!profileData.licenseNumber && !profileData.passportNumber) {
        return res.status(400).json({ 
          error: 'Either license number or passport number is required' 
        });
      }

      // Check if the email already exists in jobseeker_profiles table
      const { data: existingProfileByEmail, error: emailCheckError } = await supabase
        .from('jobseeker_profiles')
        .select('id, email')
        .eq('email', profileData.email)
        .maybeSingle();

      if (emailCheckError) {
        console.error('Error checking for existing email:', emailCheckError);
        return res.status(500).json({ error: 'Failed to validate email uniqueness' });
      }

      // If we're creating a new profile and the email already exists, return an error
      if (existingProfileByEmail) {
        return res.status(409).json({ 
          error: 'A profile with this email already exists',
          field: 'email'
        });
      }

      // Response data - will contain user creation info if needed
      const responseData: {
        success: boolean;
        message: string;
        accountCreated?: boolean;
        email?: string;
        password?: string;
      } = {
        success: true,
        message: 'Profile created successfully'
      };

      // Check if a user account exists with the submitted email
      let profileUserId = ""; // Default to empty string
      let existingUserMetadata = {};
      
      try {
        // Execute a custom SQL query to find a user with the given email
        const { data: userByEmail, error: userLookupError } = await supabase.rpc(
          'get_user_id_by_email',
          { user_email: profileData.email }
        );

        if (userLookupError) {
          console.error('Error looking up user by email:', userLookupError);
          // Continue with profile creation using creator's ID
        } else if (userByEmail && userByEmail !== null) {
          // If a user with the provided email exists, use their ID
          profileUserId = userByEmail;
          console.log(`Found existing user account for email ${profileData.email}, using ID: ${profileUserId}`);
          
          // Get existing user metadata to merge with updates
          const { data: userData, error: userDataError } = await supabase.auth.admin.getUserById(profileUserId);
          if (!userDataError && userData?.user) {
            existingUserMetadata = userData.user.user_metadata || {};
          }
        } else {
          console.log(`No existing user account found for email ${profileData.email}, creating new account`);
          
          // Generate a random password that meets password validation requirements
          const generateSecurePassword = () => {
            // Ensure we have at least one of each required character type
            const uppercaseLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
            const lowercaseLetter = String.fromCharCode(97 + Math.floor(Math.random() * 26)); // a-z
            const number = Math.floor(Math.random() * 10).toString(); // 0-9
            
            // Generate 5 more random characters (can be any of uppercase, lowercase, or numbers)
            const remainingLength = 5;
            let remainingChars = '';
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            
            for (let i = 0; i < remainingLength; i++) {
              remainingChars += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            
            // Combine all parts and shuffle
            const unshuffled = uppercaseLetter + lowercaseLetter + number + remainingChars;
            const shuffled = unshuffled.split('').sort(() => 0.5 - Math.random()).join('');
            
            return shuffled;
          };
          
          // Replace the randomPassword generation with our new function
          const randomPassword = generateSecurePassword();
          
          // Create a new user account
          const { data: newUser, error: signupError } = await supabase.auth.signUp({
            email: profileData.email,
            password: randomPassword,
            options: {
              data: {
                name: `${profileData.firstName} ${profileData.lastName}`,
                user_type: 'jobseeker',
                hasProfile: true, // Set hasProfile flag for new users
                phoneNumber: profileData.mobile,
              },
            },
          });
          
          if (signupError) {
            console.error('Error creating user account:', signupError);
            profileUserId = userId; // Fallback to creator's ID
          } else if (newUser?.user) {
            profileUserId = newUser.user.id;
            existingUserMetadata = newUser.user.user_metadata || {};
            console.log(`Created new user account with ID: ${profileUserId}`);
            
            // Add account information to the response
            responseData.accountCreated = true;
            responseData.email = profileData.email;
            responseData.password = randomPassword;
            
            // Store account creation flag for activity logging
            res.locals.accountCreated = true;
          } else {
            console.error('User creation returned no user');
            profileUserId = userId; // Fallback to creator's ID
          }
        }
      } catch (userLookupError) {
        console.error('Error looking up user by email:', userLookupError);
        // Continue with profile creation using creator's ID
        profileUserId = userId;
      }
      
      // If no user ID is set, use creator's ID as fallback
      if (!profileUserId) {
        profileUserId = userId;
        console.log(`Using creator's ID as fallback: ${profileUserId}`);
      }

      // Prepare final profile data with proper field names
      const finalProfileData = {
        user_id: profileUserId, // This is now the jobseeker's ID if found, or creator's ID if not
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        dob: profileData.dob,
        email: profileData.email, // This will be the unique identifier
        mobile: profileData.mobile,
        license_number: profileData.licenseNumber,
        passport_number: profileData.passportNumber,
        sin_number: profileData.sinNumber,
        sin_expiry: profileData.sinExpiry,
        business_number: profileData.businessNumber,
        corporation_name: profileData.corporationName,
        // Address fields
        street: profileData.street,
        city: profileData.city,
        province: profileData.province,
        postal_code: profileData.postalCode,
        // Qualifications fields
        work_preference: profileData.workPreference,
        bio: profileData.bio,
        license_type: profileData.licenseType,
        experience: profileData.experience,
        manual_driving: profileData.manualDriving,
        availability: profileData.availability,
        weekend_availability: profileData.weekendAvailability,
        // Compensation fields
        payrate_type: profileData.payrateType,
        bill_rate: profileData.billRate,
        pay_rate: profileData.payRate,
        payment_method: profileData.paymentMethod,
        hst_gst: profileData.hstGst,
        cash_deduction: profileData.cashDeduction,
        overtime_enabled: profileData.overtimeEnabled,
        overtime_hours: profileData.overtimeHours,
        overtime_bill_rate: profileData.overtimeBillRate,
        overtime_pay_rate: profileData.overtimePayRate,
        // Employee identification - defaults to null
        employee_id: profileData.employeeId || null,
        // Document info - now stored as a JSONB array
        documents: profileData.documents || [],
        // Set verification status to pending
        verification_status: 'pending',
        // Add the user ID of the creator (typically a recruiter)
        created_by_user_id: userId, 
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by_user_id: userId
      };

      // Create a new profile in database
      const { data, error } = await supabase
        .from('jobseeker_profiles')
        .insert([finalProfileData])
        .select();

      if (error) {
        console.error('Error creating profile:', error);
        return res.status(500).json({ error: 'Failed to create profile' });
      }

      // Store the created profile for activity logging
      res.locals.newProfile = data && data.length > 0 ? data[0] : null;

      // Update user metadata to set hasProfile=true while preserving existing metadata
      try {
        const mergedMetadata = {
          ...existingUserMetadata,
          hasProfile: true,
          phoneNumber: profileData.mobile
        };
        
        // Update user metadata with merged data
        const { error: metadataError } = await supabase.auth.admin.updateUserById(
          profileUserId,
          { 
            user_metadata: mergedMetadata
          }
        );
        
        if (metadataError) {
          console.error('Error updating user metadata with hasProfile flag:', metadataError);
        } else {
          console.log(`Successfully updated hasProfile flag for user ${profileUserId}`);
        }
      } catch (metadataError) {
        // Log error but don't fail the profile creation
        console.error('Error updating user metadata with hasProfile flag:', metadataError);
      }

      console.log(`Profile created with user_id: ${profileUserId}, creator_id: ${userId}, email: ${profileData.email}`);

      // If there was a draft, we can delete it now
      await supabase
        .from('jobseeker_profile_drafts')
        .delete()
        .eq('user_id', userId);

      // Send profile data to AI verification service asynchronously
      // This allows the response to be sent back immediately without waiting for verification
      setTimeout(async () => {
        try {
          console.log(`Sending profile data to AI verification service at: ${aiVerificationUrl}`);
          
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
            body: JSON.stringify(finalProfileData),
          });
          
          if (verificationResponse.ok) {
            const verificationResult = await verificationResponse.json();
            console.log('AI verification service response:', verificationResult);
          } else {
            console.error('AI verification service error:', verificationResponse.status, await verificationResponse.text());
          }
        } catch (verificationError) {
          console.error('Error sending data to AI verification service:', verificationError);
        }
      }, 0);

      // Include the created profile data in the response
      return res.status(200).json({
        ...responseData,
        profile: data && data.length > 0 ? data[0] : null
      });
    } catch (error) {
      console.error('Profile creation error:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Get user profile with decrypted sensitive information
 * GET /api/profile
 */
router.get('/', 
  authenticateToken,
  apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;

      // Get profile from database
      const { data, error } = await supabase
        .from('jobseeker_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return res.status(500).json({ error: 'Failed to fetch profile' });
      }

      if (!data) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Decrypt sensitive fields and convert to camelCase
      const dbProfile = data as DbJobseekerProfile;
      const profileData: Partial<ProfileData> = {};
      
      // Convert all fields from snake_case to camelCase
      Object.entries(dbProfile).forEach(([key, value]) => {
        if (key === 'documents') {
          // Keep documents as is - they're already in camelCase in the JSONB
          profileData.documents = value as Document[];
        } else if (key === 'rejection_reason') {
          // Handle rejection reason specifically
          profileData.rejectionReason = value;
        } else if (key.includes('_')) {
          // Convert snake_case to camelCase
          const camelKey = key.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase()) as keyof ProfileData;
          profileData[camelKey] = value;
        } else {
          // For keys that are already camelCase (unlikely), pass them directly
          profileData[key as keyof ProfileData] = value;
        }
      });

      return res.status(200).json({ profile: profileData });
    } catch (error) {
      console.error('Profile fetch error:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Save partial profile data as draft
 * PUT /api/profile/draft
 */
router.put('/draft', 
  authenticateToken,
  sanitizeInputs,
  apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const draftData = req.body;
      const currentStep = req.body.currentStep || 1;
      const email = req.body.email || null; // Explicitly extract email

      // Check if draft already exists for this user
      const { data: existingDraft, error: checkError } = await supabase
        .from('jobseeker_profile_drafts')
        .select('id, created_at, created_by_user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking for existing draft:', checkError);
        return res.status(500).json({ error: 'Failed to check draft status' });
      }

      const now = new Date().toISOString();

      if (existingDraft) {
        // Update existing draft
        const { data, error } = await supabase
          .from('jobseeker_profile_drafts')
          .update({
            form_data: draftData,
            last_updated: now,
            current_step: currentStep,
            updated_at: now,
            updated_by_user_id: userId,
            email: email // Add email field explicitly
          })
          .eq('user_id', userId);

        if (error) {
          console.error('Error updating draft:', error);
          return res.status(500).json({ error: 'Failed to update draft' });
        }

        return res.status(200).json({ 
          success: true, 
          message: 'Draft updated successfully',
          lastUpdated: now,
          updatedAt: now,
          updatedByUserId: userId,
          email: email
        });
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from('jobseeker_profile_drafts')
          .insert([
            {
              user_id: userId,
              form_data: draftData,
              last_updated: now,
              current_step: currentStep,
              created_at: now,
              created_by_user_id: userId,
              updated_at: now,
              updated_by_user_id: userId,
              email: email,
            }
          ]);

        if (error) {
          console.error('Error creating draft:', error);
          return res.status(500).json({ error: 'Failed to save draft' });
        }

        return res.status(200).json({ 
          success: true, 
          message: 'Draft saved successfully',
          lastUpdated: now,
          createdAt: now,
          createdByUserId: userId,
          updatedAt: now,
          updatedByUserId: userId,
          email: email
        });
      }
    } catch (error) {
      console.error('Draft save error:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Get saved draft
 * GET /api/profile/draft
 */
router.get('/draft', 
  authenticateToken,
  // apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;

      // Get draft from database
      const { data, error } = await supabase
        .from('jobseeker_profile_drafts')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error fetching draft:', error);
        return res.status(500).json({ error: 'Failed to fetch draft' });
      }

      // Prepare draft data with ID included inside the draft object
      const draftData = data ? {
        ...data.form_data,
        id: data.id  // Include the ID inside the draft object
      } : null;

      return res.status(200).json({ 
        draft: draftData,
        currentStep: data ? data.current_step : 1,
        lastUpdated: data ? data.last_updated : null,
        // Include tracking fields in response
        createdAt: data ? data.created_at : null,
        createdByUserId: data ? data.created_by_user_id : null,
        updatedAt: data ? data.updated_at : null,
        updatedByUserId: data ? data.updated_by_user_id : null
      });
    } catch (error) {
      console.error('Draft fetch error:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

/**
 * Check if email is available (not already in use by a jobseeker profile)
 * GET /api/profile/check-email
 */
router.get('/check-email', 
  authenticateToken,
  // apiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { email } = req.query;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email parameter is required' });
      }
      
      // Check if the email already exists in jobseeker_profiles table
      const { data: existingProfile, error: lookupError } = await supabase
        .from('jobseeker_profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (lookupError) {
        console.error('Error checking email availability in profiles:', lookupError);
        return res.status(500).json({ error: 'Failed to check email availability' });
      }

      // If email exists in a profile, return not available with the profile ID
      if (existingProfile) {
        return res.status(200).json({ 
          available: false, 
          email: email,
          existingProfileId: existingProfile.id
        });
      }
      
      // If not found in profiles, check in drafts
      const { data: existingDraft, error: draftLookupError } = await supabase
        .from('jobseeker_profile_drafts')
        .select('id')
        .eq('email', email)
        .maybeSingle();
        
      if (draftLookupError) {
        console.error('Error checking email availability in drafts:', draftLookupError);
        return res.status(500).json({ error: 'Failed to check email availability in drafts' });
      }
      
      // If email exists in a draft, return not available with the draft ID
      if (existingDraft) {
        return res.status(200).json({ 
          available: false, 
          email: email,
          existingDraftId: existingDraft.id 
        });
      }

      // If email doesn't exist in either profiles or drafts, it's available
      return res.status(200).json({ 
        available: true,
        email: email
      });
    } catch (error) {
      console.error('Email check error:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

export default router; 