import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import twilio from 'twilio';
import { activityLogger } from '../middleware/activityLogger.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || '';

// Check if Twilio credentials are available
const isTwilioConfigured = !!(
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_VERIFY_SERVICE_SID
);

const supabase = createClient(supabaseUrl, supabaseKey);
const router = express.Router();

// Ensure phone numbers are in E.164 format with leading '+' for external services and metadata
const normalizeToE164 = (phone?: string) => {
  if (!phone) return phone;
  const trimmed = String(phone).replace(/\s+/g, '');
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
};

// Send phone verification code
router.post('/send-verification', async (req, res) => {
  try {
    let { phoneNumber } = req.body;
    phoneNumber = normalizeToE164(phoneNumber);

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Check if Twilio is configured
    if (!isTwilioConfigured) {
      console.error('Twilio is not configured');
      return res.status(500).json({ error: 'Phone verification service is not available' });
    }

    // Send verification code using Twilio Verify
    try {
      const verification = await twilioClient.verify.v2
        .services(twilioVerifyServiceSid)
        .verifications.create({
          to: phoneNumber,
          channel: 'sms'
        });

      return res.status(200).json({
        message: 'Verification code sent successfully',
        status: verification.status
      });
    } catch (error) {
      console.error('Twilio verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send verification code';
      return res.status(400).json({ 
        error: 'Failed to send verification code',
        details: errorMessage
      });
    }
  } catch (error) {
    console.error('Send verification error:', error);
    return res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Verify phone verification code
router.post('/verify-otp', async (req, res) => {
  try {
    let { phoneNumber, code, userId } = req.body as { phoneNumber: string; code: string; userId?: string };
    phoneNumber = normalizeToE164(phoneNumber) as string;

    if (!phoneNumber || !code) {
      return res.status(400).json({ error: 'Phone number and verification code are required' });
    }

    // Check if Twilio is configured
    if (!isTwilioConfigured) {
      console.error('Twilio is not configured');
      return res.status(500).json({ error: 'Phone verification service is not available' });
    }

    // Verify the code using Twilio Verify
    try {
      const verificationCheck = await twilioClient.verify.v2
        .services(twilioVerifyServiceSid)
        .verificationChecks.create({
          to: phoneNumber,
          code
        });

      if (verificationCheck.status === 'approved') {
        // If userId is provided, update the user's phone data
        if (userId) {
          // Update the user's phone in auth.users table
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            userId,
            { phone: phoneNumber }
          );

          if (updateError) {
            console.error('Error updating user phone:', updateError);
          } else {
            // Also update the user_metadata to set phone_verified flag
            const { data: userData } = await supabase.auth.admin.getUserById(userId);
            
            if (userData?.user) {
              const currentMetadata = userData.user.user_metadata || {};
              
              const { error: metadataError } = await supabase.auth.admin.updateUserById(
                userId,
                {
                  user_metadata: {
                    ...currentMetadata,
                    phone_verified: true
                  }
                }
              );
              
              if (metadataError) {
                console.error('Error updating user metadata:', metadataError);
              }
            }
          }
        }

        return res.status(200).json({
          message: 'Phone number verified successfully',
          status: verificationCheck.status,
          verified: true
        });
      } else {
        return res.status(400).json({
          error: 'Invalid verification code',
          status: verificationCheck.status,
          verified: false
        });
      }
    } catch (error) {
      console.error('Twilio verification check error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify code';
      return res.status(400).json({ 
        error: 'Failed to verify code',
        details: errorMessage
      });
    }
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ error: 'Failed to verify code' });
  }
});

// Register a new user
router.post('/register',
  activityLogger({
    onSuccess: (req, res) => {
      // For registration, we need to create a mock system user context
      if (!req.user) {
        req.user = {
          id: '00000000-0000-0000-0000-000000000000', // System UUID
          email: 'system@allstaff.com',
          user_metadata: {
            name: 'System',
            user_type: 'admin'
          }
        } as any;
      }
      
      return {
        actionType: 'user_registration',
        actionVerb: 'registered',
        primaryEntityType: 'user',
        primaryEntityId: res.locals.newUser?.id,
        primaryEntityName: res.locals.newUser?.email || req.body.email,
        secondaryEntityType: 'user_profile',
        secondaryEntityId: res.locals.newUser?.id,
        secondaryEntityName: res.locals.newUser?.user_metadata?.name || req.body.name || 'Unknown',
        displayMessage: `New user registered: ${res.locals.newUser?.email || req.body.email}`,
        category: 'user_management',
        priority: 'normal',
        metadata: {
          userType: res.locals.newUser?.user_metadata?.user_type || 'jobseeker',
          email: res.locals.newUser?.email,
          name: res.locals.newUser?.user_metadata?.name,
          hasPhoneNumber: !!req.body.phoneNumber,
          registrationMethod: 'email_password'
        }
      };
    }
  }),
  async (req, res) => {
  try {
    const { email, password, name, phoneNumber } = req.body;
    const normalizedPhone = phoneNumber ? normalizeToE164(phoneNumber) : undefined;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

      // Determine user type based on email
      let userType = "jobseeker"; // Default type

      // Check for recruiter email pattern
      if (email.includes("@godspeedxp") || email.includes("@motionfalcon")) {
        userType = "recruiter";
      }

      // Create user metadata with phoneNumber if provided
      const userMetadata: Record<string, any> = {
        name,
        portal_name: process.env.PORTAL_NAME || 'Ops Portal',
        user_type: userType,
        // Ensure user_role exists for new users
        user_role:
          userType === "recruiter"
            ? ["recruiter"]
            : userType === "admin"
            ? ["admin"]
            : [],
        // Ensure hierarchy container exists for new users
        hierarchy: {
          org_id: null,
          team_id: null,
          manager_id: null,
          level: 0,
        },
        phone_verified: true,
      };

    // If phone number is provided, store it in metadata for now
    if (normalizedPhone) {
      userMetadata.phoneNumber = normalizedPhone;
    }

    const clientURL = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    
    // Register the user with email and password
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      phone: normalizedPhone,
      options: {
        data: userMetadata,
        emailRedirectTo: `${clientURL}/email-confirmed`,
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Check if user is null, which indicates the email already exists
    if (!data.user) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Re-assert metadata (and phone) after signUp to avoid provider defaults overwriting our values
    if (data.user) {
      const { user } = data;
      const currentMeta = (user as any).user_metadata || {};
      const updatedMeta = {
        ...currentMeta,
        phone_verified: true,
        ...(normalizedPhone ? { phoneNumber: normalizedPhone } : {})
      };
      try {
        await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: updatedMeta,
          ...(normalizedPhone ? { phone: normalizedPhone as any } : {})
        });
      } catch (metaUpdateErr) {
        console.error('Post-signup metadata update error:', metaUpdateErr);
      }
    }

    // Store user data for activity logging
    res.locals.newUser = data.user;

    return res.status(201).json({
      message: 'Registration successful. Please check your email for verification.',
      user: data.user,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    return res.status(200).json({
      message: 'Login successful',
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// New endpoint: Validate credentials without creating session (for 2FA flow)
router.post('/validate-credentials', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Determine if user is a recruiter or admin based on email
    const isRecruiterOrAdmin = (
      email.includes("@godspeedxp") ||
      email.includes("@motionfalcon") ||
      email.includes("@canhiresolutions") ||
      email.includes("@allstaff") ||
      email.includes("@hdgroup")
    ); // Add your admin email domain(s) here

    // For recruiters or admins, we validate credentials without creating a session
    if (isRecruiterOrAdmin) {
      // First, try to sign in to validate credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Check if the error is due to unconfirmed email
        if (error.message === 'Email not confirmed' || error.status === 400) {
          // Get user by email to return user data even if email is not confirmed
          const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
          if (!listError && users) {
            const user = users.find(u => u.email === email);
            if (user) {
              return res.status(200).json({
                message: 'Email not confirmed',
                requiresTwoFactor: false,
                emailVerified: false,
                user: user,
                email: email,
              });
            }
          }
        }
        return res.status(401).json({ error: error.message });
      }

      // Immediately sign out to invalidate the session
      await supabase.auth.signOut();

      // Return user data without session for 2FA flow
      return res.status(200).json({
        message: 'Credentials validated - 2FA required',
        requiresTwoFactor: true,
        user: data.user,
        // Don't return session data
      });
    }

    // For non-recruiters, proceed with normal login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Check if the error is due to unconfirmed email
      if (error.message === 'Email not confirmed' || error.status === 400) {
        // Get user by email to return user data even if email is not confirmed
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (!listError && users) {
          const user = users.find(u => u.email === email);
          if (user) {
            return res.status(200).json({
              message: 'Email not confirmed',
              requiresTwoFactor: false,
              emailVerified: false,
              user: user,
              email: email,
            });
          }
        }
      }
      return res.status(401).json({ error: error.message });
    }

    return res.status(200).json({
      message: 'Login successful',
      requiresTwoFactor: false,
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error('Validate credentials error:', error);
    return res.status(500).json({ error: 'Credential validation failed' });
  }
});

// Complete 2FA and create session
router.post('/complete-2fa', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Create the actual session after successful 2FA
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    return res.status(200).json({
      message: '2FA completed - Login successful',
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error('Complete 2FA error:', error);
    return res.status(500).json({ error: 'Failed to complete 2FA login' });
  }
});

// Logout user
router.post('/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Make sure we have the right clientURL with http/https
    const clientURL = process.env.CLIENT_URL || 'http://localhost:5173';
    
    // Ensure the clientURL doesn't have a trailing slash before appending the path
    const redirectURL = clientURL.endsWith('/')
      ? `${clientURL}reset-password`
      : `${clientURL}/reset-password`;
    
    // Send password reset email with redirect
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectURL,
    });

    if (error) {
      console.error('Password reset email error:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: 'Password reset email sent. Please check your inbox.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({ error: 'Failed to send reset password email' });
  }
});

// Update password
router.post('/update-password', async (req, res) => {
  try {
    const { password } = req.body;
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!password) {
      return res.status(400).json({ error: 'New password is required' });
    }

    // Check if we have a token
    if (!token) {
      return res.status(401).json({ error: 'Authentication token is required for password reset' });
    }
    
    // Get user ID from the token
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError) {
      console.error('User validation error:', userError);
      return res.status(401).json({ error: 'Invalid or expired reset token' });
    }
    
    if (!userData.user) {
      console.error('No user found with token');
      return res.status(401).json({ error: 'User not found' });
    }

    // Try with service role first (most reliable)
    try {
      const { error } = await supabase.auth.admin.updateUserById(
        userData.user.id,
        { password }
      );

      if (!error) {
        return res.status(200).json({
          message: 'Password updated successfully',
        });
      }
      
      // If service role update failed, log the error and try fallback
      console.error('Admin update failed:', error);
    } catch (adminError) {
      console.error('Admin client error:', adminError);
    }

    // Fallback to user context update
    try {
      const { error: userUpdateError } = await supabase.auth.updateUser({ 
        password 
      });
      
      if (userUpdateError) {
        console.error('User update error:', userUpdateError);
        return res.status(400).json({ error: userUpdateError.message });
      }
      
      return res.status(200).json({
        message: 'Password updated successfully',
      });
    } catch (userClientError) {
      console.error('User client error:', userClientError);
      return res.status(500).json({ error: 'Password update failed with user token' });
    }
  } catch (error) {
    console.error('Update password error:', error);
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

// Complete onboarding: set password (if provided), phone metadata, and mark onboarding complete
router.post('/complete-onboarding', 
  authenticateToken, 
  authorizeRoles(['admin', 'recruiter']),
  activityLogger({
    onSuccess: (req, res) => {
      const user = req.user;
      const userName = user?.user_metadata?.name || user?.email || 'Unknown';
      return {
        actionType: 'complete_onboarding',
        actionVerb: 'completed',
        primaryEntityType: 'user',
        primaryEntityId: user?.id,
        primaryEntityName: userName,
        displayMessage: `${userName} completed onboarding`,
        category: 'user_management',
        priority: 'normal',
        metadata: {
          hasPassword: !!req.body.password,
          hasPhone: !!req.body.phoneNumber,
          userType: user?.user_metadata?.user_type || 'unknown'
        }
      };
    }
  }),
  async (req, res) => {
  try {
    const { password } = req.body as { password?: string; phoneNumber?: string };
    const phoneNumberRaw = (req.body as any).phoneNumber as string | undefined;
    const phoneNumber = normalizeToE164(phoneNumberRaw);

    // Get current user from auth middleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Update password if provided
    if (password && password.length >= 8) {
      const { error: passErr } = await supabase.auth.admin.updateUserById(userId, { password });
      if (passErr) {
        return res.status(400).json({ error: 'Failed to set password' });
      }
    }

    // Merge metadata: set phone and flags
    const { data: current, error: getErr } = await supabase.auth.admin.getUserById(userId);
    if (getErr || !current?.user) {
      return res.status(400).json({ error: 'Failed to load user' });
    }
    const currentMeta = (current.user as any).user_metadata || {};
    const updatedMeta = {
      ...currentMeta,
      onboarding_complete: true,
      phone_verified: !!phoneNumber || currentMeta.phone_verified || false,
      ...(phoneNumber ? { phoneNumber } : {}),
    };

    // Update phone field and metadata atomically (two calls as required by API)
    if (phoneNumber) {
      await supabase.auth.admin.updateUserById(userId, { phone: phoneNumber as any });
    }
    const { error: metaErr } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: updatedMeta,
    });
    if (metaErr) {
      return res.status(400).json({ error: 'Failed to update profile' });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Complete onboarding error:', e);
    return res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const clientURL = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${clientURL}/email-confirmed`,
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: 'Verification email has been resent. Please check your inbox.',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// Get current user (protected route)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // User is already set in req by the authenticateToken middleware
    return res.status(200).json({ user: req.user });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Failed to get user' });
  }
});

// Check if email is available
router.get('/check-email', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    // Use existing SQL function to check if user exists by email
    const { data: userId, error } = await supabase.rpc(
      'get_user_id_by_email',
      { user_email: email }
    );
    
    if (error) {
      console.error('Error checking email availability:', error);
      return res.status(500).json({ error: 'Failed to check email availability' });
    }

    // If userId is not null, email is already taken
    const emailExists = userId !== null;
    
    return res.json({
      available: !emailExists,
      email: email,
      ...(emailExists && { existingUserId: userId })
    });
    
  } catch (error) {
    console.error('Error checking email availability:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if phone number is available
router.get('/check-phone', async (req, res) => {
  try {
    const { phone } = req.query;
    
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Phone parameter is required' });
    }

    // Use SQL function to check if user exists by phone number
    const { data: userId, error } = await supabase.rpc(
      'get_user_id_by_phone',
      { user_phone: phone }
    );
    
    if (error) {
      console.error('Error checking phone availability:', error);
      return res.status(500).json({ error: 'Failed to check phone availability' });
    }

    // If userId is not null, phone is already taken
    const phoneExists = userId !== null;
    
    return res.json({
      available: !phoneExists,
      phone: phone,
      ...(phoneExists && { existingUserId: userId }),
    });
  } catch (error) {
    console.error("Error checking phone availability:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/auth/send-confirmation-welcome
 *
 * Called by the client immediately after a jobseeker confirms their email.
 * Sends two emails:
 *   1. Welcome email — same template used when a recruiter creates the profile
 *   2. Employment Agreement — prompts the jobseeker to sign the agreement
 *
 * Idempotent: the `welcome_email_sent` flag in user_metadata prevents
 * duplicate sends. Jobseekers whose profiles were created by a recruiter
 * already have this flag set, so this endpoint is a no-op for them.
 */
router.post("/send-confirmation-welcome", authenticateToken, async (req, res) => {
  try {
    const user = req.user!;
    const userId = user.id;
    const meta = user.user_metadata || {};

    // Only for jobseekers
    if (meta.user_type !== "jobseeker") {
      return res.status(200).json({ skipped: true, reason: "not_a_jobseeker" });
    }

    // Already sent (recruiter-created flow or previous call)
    if (meta.welcome_email_sent === true) {
      return res.status(200).json({ skipped: true, reason: "already_sent" });
    }

    const email = user.email;
    if (!email) {
      return res.status(400).json({ error: "User has no email address" });
    }

    // Set flag immediately to prevent race-condition duplicate sends
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { ...meta, welcome_email_sent: true },
    });

    const clientUrl = (process.env.CLIENT_URL || "").replace(/\/$/, "");
    const firstName = (meta.name || "").split(" ")[0] || "there";
    const portalUrl = clientUrl;
    const userName = (meta.name as string) || "there";

    const sgMail = (await import("@sendgrid/mail")).default;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

    const { formatFromEmail } = await import("../middleware/emailNotifier.js");
    const fromEmail = formatFromEmail(process.env.DEFAULT_FROM_EMAIL as string);

    const { jobseekerWelcomeHtmlTemplate } = await import("../email-templates/jobseeker-welcome-html.js");
    const { jobseekerWelcomeTextTemplate } = await import("../email-templates/jobseeker-welcome-txt.js");

    const welcomeHtml = jobseekerWelcomeHtmlTemplate({ first_name: firstName, portal_url: portalUrl });
    const welcomeText = jobseekerWelcomeTextTemplate({ first_name: firstName, portal_url: portalUrl });

    // Build the list of email promises — always send welcome email
    const emailPromises: Promise<any>[] = [
      sgMail.send({
        to: email,
        from: fromEmail,
        subject: `Welcome to ${process.env.PORTAL_NAME || "Ops Portal"}`,
        html: welcomeHtml,
        text: welcomeText,
      }),
    ];

    // Create employment agreement consent record and queue the email
    try {
      const { data: employmentTemplate } = await supabase
        .from('consent_document_templates')
        .select('*')
        .eq('template_name', 'employmentAgreement')
        .eq('is_active', true)
        .single();

      if (employmentTemplate) {
        // Find or create the shared onboarding consent document
        let { data: onboardingDoc } = await supabase
          .from('consent_documents')
          .select('*')
          .eq('is_jobseeker_onboarding', true)
          .eq('template_id', employmentTemplate.id)
          .eq('is_active', true)
          .single();

        if (!onboardingDoc) {
          const { data: newDoc } = await supabase
            .from('consent_documents')
            .insert({
              file_name: employmentTemplate.file_name,
              file_path: employmentTemplate.file_path,
              consent_mode: 'autofill',
              autofill_fields: employmentTemplate.field_mappings,
              template_id: employmentTemplate.id,
              uploaded_by: userId,
              is_jobseeker_onboarding: true,
              is_active: true,
              version: 1
            })
            .select()
            .single();
          onboardingDoc = newDoc;
        }

        if (onboardingDoc) {
          // Check if a consent record already exists (e.g. recruiter-created)
          const { data: existingRecord } = await supabase
            .from('consent_records')
            .select('*')
            .eq('consentable_id', userId)
            .eq('consentable_type', 'user')
            .eq('document_id', onboardingDoc.id)
            .eq('is_jobseeker_onboarding', true)
            .single();

          let consentToken: string;

          if (existingRecord) {
            consentToken = existingRecord.consent_token;
          } else {
            const crypto = await import('crypto');
            consentToken = crypto.randomBytes(32).toString('hex');

            await supabase
              .from('consent_records')
              .insert({
                document_id: onboardingDoc.id,
                consentable_id: userId,
                consentable_type: 'user',
                status: 'pending',
                consent_token: consentToken,
                is_jobseeker_onboarding: true,
                sent_at: new Date().toISOString()
              });

            console.log(`[send-confirmation-welcome] Created onboarding consent record for user ${userId}`);
          }

          // Queue employment agreement email
          const { employmentAgreementHtmlTemplate, employmentAgreementTextTemplate } =
            await import("../email-templates/employment-agreement-html.js");

          const consentUrl = `${clientUrl}/consent?token=${consentToken}`;
          const loginUrl = `${clientUrl}/login`;

          emailPromises.push(
            sgMail.send({
              to: email,
              from: fromEmail,
              subject: "Action Required: Sign Your Employment Agreement",
              html: employmentAgreementHtmlTemplate({ recipientName: userName, consentUrl, loginUrl }),
              text: employmentAgreementTextTemplate({ recipientName: userName, consentUrl, loginUrl }),
            })
          );
        }
      } else {
        console.log("[send-confirmation-welcome] Employment agreement template not found, skipping");
      }
    } catch (consentError) {
      // Don't block welcome email if consent setup fails
      console.error("[send-confirmation-welcome] Error setting up employment agreement:", consentError);
    }

    // Send all queued emails
    const results = await Promise.allSettled(emailPromises);

    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason?.message);

    if (errors.length > 0) {
      console.error("[send-confirmation-welcome] Some emails failed:", errors);
    } else {
      console.log(`[send-confirmation-welcome] Welcome + employment agreement emails sent to ${email}`);
    }

    return res.status(200).json({ sent: true, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error("[send-confirmation-welcome] Error:", error);
    return res.status(500).json({ error: "Failed to send confirmation welcome emails" });
  }
});

/**
 * POST /api/auth/first-login-reminder
 *
 * Called by the client on first login when the jobseeker has NOT yet
 * completed their profile. Sends the "Complete Your Account Setup" email.
 *
 * Idempotent: the `setup_reminder_sent` flag in user_metadata prevents
 * duplicate sends. Skipped entirely if the user already has a profile
 * (hasProfile === true).
 */
router.post("/first-login-reminder", authenticateToken, async (req, res) => {
  try {
    const user = req.user!;
    const userId = user.id;
    const meta = user.user_metadata || {};

    // Only for jobseekers
    if (meta.user_type !== "jobseeker") {
      return res.status(200).json({ skipped: true, reason: "not_a_jobseeker" });
    }

    // Skip if the user already has a completed profile
    if (meta.hasProfile === true) {
      return res.status(200).json({ skipped: true, reason: "has_profile" });
    }

    // Already sent
    if (meta.setup_reminder_sent === true) {
      return res.status(200).json({ skipped: true, reason: "already_sent" });
    }

    const email = user.email;
    if (!email) {
      return res.status(400).json({ error: "User has no email address" });
    }

    // Set flag immediately to prevent race-condition duplicate sends
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { ...meta, setup_reminder_sent: true },
    });

    const clientUrl = (process.env.CLIENT_URL || "").replace(/\/$/, "");
    const firstName = (meta.name || "").split(" ")[0] || "there";
    const onboardingUrl = clientUrl + "/profile/create";

    const sgMail = (await import("@sendgrid/mail")).default;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

    const { formatFromEmail } = await import("../middleware/emailNotifier.js");
    const fromEmail = formatFromEmail(process.env.DEFAULT_FROM_EMAIL as string);

    const { onboardingReminderHtmlTemplate } = await import("../email-templates/onboarding-reminder-html.js");
    const { onboardingReminderTextTemplate } = await import("../email-templates/onboarding-reminder-txt.js");

    const onboardingHtml = onboardingReminderHtmlTemplate({ name: firstName, onboarding_url: onboardingUrl });
    const onboardingText = onboardingReminderTextTemplate({ name: firstName, onboarding_url: onboardingUrl });

    await sgMail.send({
      to: email,
      from: fromEmail,
      subject: "Complete Your Account Setup — Action Required",
      html: onboardingHtml,
      text: onboardingText,
    });

    console.log(`[first-login-reminder] Account setup reminder sent to ${email}`);
    return res.status(200).json({ sent: true });
  } catch (error) {
    console.error("[first-login-reminder] Error:", error);
    return res.status(500).json({ error: "Failed to send account setup reminder" });
  }
});

export default router;
