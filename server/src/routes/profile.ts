import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { apiRateLimiter, sensitiveRateLimiter, csrfProtection, sanitizeInputs } from '../middleware/security.js';
import dotenv from 'dotenv';
import { encrypt, decrypt } from '../utils/encryption.js';
import { createLog } from '../utils/auditLogger.js';
import { ProfileData, Document, DbJobseekerProfile } from '../types.js';

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

// Define sensitive fields that need encryption/masking
const SENSITIVE_FIELDS = {
  sinNumber: true,
  licenseNumber: true,
  passportNumber: true,
  businessNumber: true
};

/**
 * Submit complete jobseeker profile with security measures
 * POST /api/profile/submit
 */
router.post('/submit', 
  authenticateToken, 
  sanitizeInputs,
  csrfProtection,
  sensitiveRateLimiter,
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

      // Encrypt sensitive data before storing
      const encryptedData = { ...profileData };
      Object.keys(SENSITIVE_FIELDS).forEach(field => {
        if (encryptedData[field]) {
          encryptedData[field] = encrypt(encryptedData[field]);
        }
      });

      // Prepare final profile data with proper field names
      const finalProfileData = {
        user_id: userId,
        first_name: encryptedData.firstName,
        last_name: encryptedData.lastName,
        dob: encryptedData.dob,
        email: encryptedData.email,
        mobile: encryptedData.mobile,
        license_number: encryptedData.licenseNumber,
        passport_number: encryptedData.passportNumber,
        sin_number: encryptedData.sinNumber,
        sin_expiry: encryptedData.sinExpiry,
        business_number: encryptedData.businessNumber,
        corporation_name: encryptedData.corporationName,
        // Address fields
        street: encryptedData.street,
        city: encryptedData.city,
        province: encryptedData.province,
        postal_code: encryptedData.postalCode,
        // Qualifications fields
        work_preference: encryptedData.workPreference,
        license_type: encryptedData.licenseType,
        experience: encryptedData.experience,
        manual_driving: encryptedData.manualDriving,
        availability: encryptedData.availability,
        weekend_availability: encryptedData.weekendAvailability,
        // Compensation fields
        payrate_type: encryptedData.payrateType,
        bill_rate: encryptedData.billRate,
        pay_rate: encryptedData.payRate,
        payment_method: encryptedData.paymentMethod,
        hst_gst: encryptedData.hstGst,
        cash_deduction: encryptedData.cashDeduction,
        overtime_enabled: encryptedData.overtimeEnabled,
        overtime_hours: encryptedData.overtimeHours,
        overtime_bill_rate: encryptedData.overtimeBillRate,
        overtime_pay_rate: encryptedData.overtimePayRate,
        // Document info - now stored as a JSONB array
        documents: encryptedData.documents || [],
        // Set verification status to pending
        verification_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Create or update profile in database
      const { data, error } = await supabase
        .from('jobseeker_profiles')
        .upsert([finalProfileData], { 
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error creating profile:', error);
        return res.status(500).json({ error: 'Failed to create profile' });
      }

      // Create audit log for profile submission (with PII masking)
      await createLog({
        userId,
        action: 'profile_submit',
        details: {
          email: profileData.email,
          licenseNumber: profileData.licenseNumber ? 'PRESENT' : 'MISSING',
          passportNumber: profileData.passportNumber ? 'PRESENT' : 'MISSING',
          sinNumber: profileData.sinNumber ? 'PRESENT' : 'MISSING'
        },
        sensitiveFields: {
          email: true,
          licenseNumber: true,
          passportNumber: true,
          sinNumber: true
        }
      }, supabase);

      // If there was a draft, we can delete it now
      await supabase
        .from('jobseeker_profile_drafts')
        .delete()
        .eq('user_id', userId);

      return res.status(200).json({ 
        success: true, 
        message: 'Profile created successfully' 
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

      // Create audit log for profile access
      await createLog({
        userId,
        action: 'profile_access',
        details: {
          accessedBy: userId
        }
      }, supabase);

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
        } else if (key.includes('_')) {
          // Convert snake_case to camelCase
          const camelKey = key.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase()) as keyof ProfileData;
          profileData[camelKey] = value;
          
          // Decrypt sensitive fields
          if (
            camelKey === 'sinNumber' || 
            camelKey === 'licenseNumber' || 
            camelKey === 'passportNumber' || 
            camelKey === 'businessNumber'
          ) {
            if (typeof value === 'string' && value) {
              profileData[camelKey] = decrypt(value) as string;
            }
          }
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
 * Update verification status (Admin/Recruiter only)
 * PATCH /api/profile/:profileId/verify
 */
router.patch('/:profileId/verify', 
  authenticateToken,
  sensitiveRateLimiter,
  csrfProtection,
  async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user has admin or recruiter role
      if (!req.user.user_metadata?.user_type || 
         (req.user.user_metadata.user_type !== 'admin' && 
          req.user.user_metadata.user_type !== 'recruiter')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { profileId } = req.params;
      const { status } = req.body;

      if (!status || !['pending', 'verified', 'rejected'].includes(status)) {
        return res.status(400).json({ 
          error: 'Invalid status. Must be one of: pending, verified, rejected' 
        });
      }

      // Update verification status
      const { data, error } = await supabase
        .from('jobseeker_profiles')
        .update({ 
          verification_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', profileId)
        .select('id, user_id');

      if (error) {
        console.error('Error updating verification status:', error);
        return res.status(500).json({ error: 'Failed to update verification status' });
      }

      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Create audit log for verification status change
      await createLog({
        userId: req.user.id,
        action: 'profile_verification_update',
        details: {
          profileId,
          previousStatus: 'pending', // Ideally we'd fetch this before update
          newStatus: status,
          updatedBy: req.user.id,
          targetUserId: data[0].user_id
        }
      }, supabase);

      return res.status(200).json({ 
        success: true,
        message: `Profile verification status updated to ${status}` 
      });
    } catch (error) {
      console.error('Verification status update error:', error);
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

      // Create audit log for draft save
      await createLog({
        userId,
        action: 'profile_draft_save',
        details: {
          currentStep,
          hasData: !!draftData
        }
      }, supabase);

      // Save draft to database
      const { data, error } = await supabase
        .from('jobseeker_profile_drafts')
        .upsert([
          {
            user_id: userId,
            form_data: draftData,
            last_updated: new Date().toISOString(),
            current_step: currentStep
          }
        ], {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving draft:', error);
        return res.status(500).json({ error: 'Failed to save draft' });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Draft saved successfully' 
      });
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
  apiRateLimiter,
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

      // Create audit log for draft access
      await createLog({
        userId,
        action: 'profile_draft_access',
        details: {
          draftExists: !!data
        }
      }, supabase);

      return res.status(200).json({ 
        draft: data ? data.form_data : null,
        currentStep: data ? data.current_step : 1,
        lastUpdated: data ? data.last_updated : null
      });
    } catch (error) {
      console.error('Draft fetch error:', error);
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
);

export default router; 